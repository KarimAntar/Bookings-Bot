import os
import json
import requests
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
import sys

from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from dotenv import load_dotenv

# Use the new Google GenAI SDK
from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN")
SLACK_APP_TOKEN = os.environ.get("SLACK_APP_TOKEN")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

if GEMINI_API_KEY:
    ai_client = genai.Client(api_key=GEMINI_API_KEY)
else:
    ai_client = None

if SLACK_BOT_TOKEN:
    app = App(token=SLACK_BOT_TOKEN)
else:
    app = None

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

if app:
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

                # Process with Gemini using new SDK
                prompt_text = BOOKING_REVIEW_PROMPT.replace(
                    "{USER_TEXT}",
                    f"User provided context: {user_text}" if user_text else "No additional text provided."
                )

                config = types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
                
                # We need to construct the payload according to the new SDK
                # It accepts bytes directly
                image_part = types.Part.from_bytes(
                    data=image_data,
                    mime_type=mime_type,
                )

                result = ai_client.models.generate_content(
                    model='gemini-1.5-flash',
                    contents=[prompt_text, image_part],
                    config=config
                )

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
    if app and SLACK_APP_TOKEN:
        try:
            print("Starting Slack SocketMode...")
            sys.stdout.flush()
            handler = SocketModeHandler(app, SLACK_APP_TOKEN)
            handler.start()
        except Exception as e:
            print(f"Failed to start Slack handler: {e}")

# --- Dummy Web Server (For Hugging Face Spaces Healthcheck) ---
class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        
        missing = []
        if not SLACK_BOT_TOKEN: missing.append("SLACK_BOT_TOKEN")
        if not SLACK_APP_TOKEN: missing.append("SLACK_APP_TOKEN")
        if not GEMINI_API_KEY: missing.append("GEMINI_API_KEY")
        
        if missing:
            message = f"<h1>🔴 ERROR: Missing secrets in Space settings: {', '.join(missing)}</h1>"
        else:
            message = "<h1>🟢 Bot is active and listening to Slack events via Socket Mode!</h1>"
            
        html = f"""
        <html>
        <head><title>Bookings QA Bot</title></head>
        <body style="font-family: sans-serif; padding: 2rem;">
            <h2>🤖 Bookings QA Bot</h2>
            {message}
        </body>
        </html>
        """
        self.wfile.write(html.encode('utf-8'))

    # Suppress HTTP logging
    def log_message(self, format, *args):
        pass

def run_server():
    server_address = ('0.0.0.0', 7860)
    httpd = HTTPServer(server_address, HealthCheckHandler)
    print("Health check server running on port 7860...")
    sys.stdout.flush()
    httpd.serve_forever()

if __name__ == "__main__":
    # Start the Slack bot in a background thread
    slack_thread = threading.Thread(target=start_slack_bot, daemon=True)
    slack_thread.start()
    
    # Launch basic web server on the main thread
    run_server()
