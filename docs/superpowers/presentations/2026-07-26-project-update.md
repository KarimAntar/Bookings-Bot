# Bookings Bot: Project Update (July 2026)

## 1. Achievements (What we've built)

* **Multi-Screenshot Thread Combination:** The bot perfectly stitches together root messages and thread replies into a single continuous review session.
* **Advanced Vision Rules:** Upgraded Gemini's ability to read split booking forms and identify specific notes sections.
* **Dynamic Date Deadlines:** The backend automatically calculates precise business-day deadlines (skipping weekends) and enforces them safely.
* **Conversational Rule Manager:** Authorized admins can directly DM the bot to teach it custom overrides (e.g., SmartSetter note exemptions, Spanish speaker rejections).
* **Anti-Hallucination & Jailbreak Protection:** Massive safety nets added so the AI cannot hallucinate missing conditions, and agents cannot bypass rules by typing "approve it".
* **Robust Error Handling:** The bot now safely asks for missing screenshots if there is a Slack download delay, preventing silent crashes.

## 2. Current Limitations / Areas for Improvement

* **AI Vision Overload:** Gemini struggles when presented with 10+ overlapping, duplicate screenshots in long back-and-forth threads. We need to encourage agents to submit clean evidence upfront.
* **Screenshot Quality Dependency:** If agents submit full-page scrolling screenshots, the text compresses and the AI goes blind. We might need a way to auto-crop or strictly enforce image ratios.
* **Rule Conflict Resolution:** While we have an "Ultimate Override", complex overlapping custom rules (e.g., Exempt Notes vs Reject if Spanish) still push the boundaries of what the LLM can balance simultaneously without strict backend guards.
