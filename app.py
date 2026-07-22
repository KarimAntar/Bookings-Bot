import os
import io
import json
import requests
import google.generativeai as genai
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from dotenv import load_dotenv
import gradio as gr
import threading

# Load environment variables
load_dotenv()

SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")
SLACK_APP_TOKEN = os.environ.get("SLACK_APP_TOKEN")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

# Initialize Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Initialize Slack app
app = App(token=SLACK_BOT_TOKEN)

BOOKING_REVIEW_PROMPT = """
You are an expert quality assurance bot for a booking platform.
Your job is to review screenshots of booking dashboards and determine if the booking should be approved, rejected, or needs human review.

Analyze the image carefully. Look for discrepancies, missing critical information, or signs of fraud.

If the user provided additional text, consider it as context:
{USER_TEXT}

Respond ONLY with a valid JSON object matching this schema. Do not include markdown formatting or backticks around the JSON.
{
  "status": "approved" | "needs human review" | "rejected",
  "reasoning": "A brief, 1-2 sentence explanation of why you made this decision."
}
"""

def get_status_emoji(status):
    if status == "approved":
        return "✅"
    elif status == "rejected":
        return "❌"
    elif status == "needs human review":
        return "⚠️"
    return "❓"

@app.event("message")
def handle_message_events(body, logger, say, client):
    event = body.get("event", {})

    # Ignore edits, deletions, and bot messages
    if event.get("subtype") or event.get("bot_id"):
        return

    # Check for files
    files = event.get("files", [])
    if not files:
        return

    # Filter for image files
    image_files = [f for f in files if f.get("mimetype", "").startswith("image/")]
    if not image_files:
        return

    channel_id = event["channel"]
    ts = event["ts"]

    # React with eyes
    try:
        client.reactions_add(channel=channel_id, timestamp=ts, name="eyes")
    except Exception as e:
        logger.error(f"Error adding reaction: {e}")

    user_text = event.get("text", "")

    for file in image_files:
        download_url = file.get("url_private_download")
        if not download_url:
            continue

        try:
            # Download image from Slack securely
            headers = {"Authorization": f"Bearer {SLACK_BOT_TOKEN}"}
            response = requests.get(download_url, headers=headers)
            response.raise_for_status()

            image_data = response.content
            mime_type = file.get("mimetype", "image/png")

            # Process with Gemini
            prompt_text = BOOKING_REVIEW_PROMPT.replace(
                "{USER_TEXT}",
                f"User provided context: {user_text}" if user_text else "No additional text provided."
            )

            # Define the schema
            generation_config = genai.types.GenerationConfig(
                response_mime_type="application/json"
            )

            model = genai.GenerativeModel('gemini-1.5-flash', generation_config=generation_config)

            # Send the image and prompt
            result = model.generate_content([
                prompt_text,
                {"mime_type": mime_type, "data": image_data}
            ])

            # Parse JSON
            try:
                parsed = json.loads(result.text)
                status = parsed.get("status", "needs human review")
                if status not in ["approved", "needs human review", "rejected"]:
                    status = "needs human review"
                reasoning = parsed.get("reasoning", "Model returned invalid format.")
            except json.JSONDecodeError:
                status = "needs human review"
                reasoning = f"Failed to parse model output: {result.text}"

            # Reply in thread
            emoji = get_status_emoji(status)
            reply_text = f"{emoji} *Booking Review Result:* {status.upper()}\n\n*Reasoning:*\n{reasoning}"

            say(text=reply_text, thread_ts=ts)

        except Exception as e:
            logger.error(f"Error processing image: {e}")
            say(text="⚠️ Sorry, I encountered an error while trying to process that image. Please review manually.", thread_ts=ts)

    # Change reaction to checkmark
    try:
        client.reactions_remove(channel=channel_id, timestamp=ts, name="eyes")
        client.reactions_add(channel=channel_id, timestamp=ts, name="white_check_mark")
    except Exception as e:
        logger.error(f"Error changing reaction: {e}")

def start_slack_bot():
    """Starts the Slack SocketMode handler in a background thread"""
    handler = SocketModeHandler(app, SLACK_APP_TOKEN)
    handler.start()

# --- Gradio UI (For Hugging Face Spaces) ---

def start_gradio():
    with gr.Blocks() as demo:
        gr.Markdown("# 🤖 Bookings QA Bot")
        gr.Markdown(
            "This bot is running in the background and listening to Slack via Socket Mode! \n\n"
            "Drop a screenshot of a booking in your Slack channel, and the bot will review it using Gemini 1.5 Flash."
        )
        status_text = gr.Textbox(value="🟢 Bot is active and listening to Slack events...", label="Status", interactive=False)

    # Launch Gradio on the port expected by HF Spaces (7860)
    demo.launch(server_name="0.0.0.0", server_port=7860)

if __name__ == "__main__":
    # Start the Slack bot in a background thread
    slack_thread = threading.Thread(target=start_slack_bot, daemon=True)
    slack_thread.start()
    print("Booking QA Bot is running in Socket Mode!")

    # Start the Gradio UI on the main thread (required for Hugging Face)
    start_gradio()
