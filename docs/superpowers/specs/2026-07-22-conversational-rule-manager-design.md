# Conversational Rule Manager Design

## Goal
Enable authorized admins to dynamically teach, edit, and delete custom review rules for the Bookings Bot through a natural language Direct Message (DM) interface. The bot will persistently store these rules and instantly apply them to all future booking reviews without requiring code changes or service restarts.

## Trigger and Scope
- The bot will listen to the `message.im` event (Direct Messages).
- Only Slack users whose IDs are listed in a new `ADMIN_USER_IDS` environment variable are authorized.
- Unauthorized users receive a polite rejection message.
- Admin messages are processed by a dedicated "Rule Manager" AI flow, completely separate from the image review flow.

## Rule Storage
- Rules are stored persistently in a local JSON file (e.g., `data/custom-rules.json`).
- The storage format maps a unique numeric ID to the text of the rule.
- The file is read from disk at the exact moment a booking review is triggered, ensuring real-time application of the latest rules.

## Conversational Rule Management (The DM Flow)
When an authorized admin sends a DM, the bot passes the admin's message and the current list of rules to Gemini using a strict JSON schema.

Gemini acts as an intent router and returns one of the following actions:
1. **ADD:** The admin wants to create a new rule. Gemini provides the clean, normalized text of the new rule.
2. **UPDATE:** The admin wants to modify an existing rule. Gemini identifies the rule ID and provides the updated text.
3. **DELETE:** The admin wants to remove a rule. Gemini identifies the rule ID to delete.
4. **LIST:** The admin is asking what rules currently exist.
5. **UNKNOWN/CHAT:** The message isn't related to rule management, or is unclear.

The bot executes the action against the JSON file, saves it, and replies to the admin in the DM confirming the change (e.g., "Added Rule #4: Always require a phone number for NY prospects.").

## Applying Rules to Reviews
- The `ReviewService` will be updated.
- Before calling Gemini to review a booking, it will read `data/custom-rules.json`.
- If custom rules exist, they will be formatted as a numbered list and appended to the `BOOKING_REVIEW_POLICY` system instruction under a clear heading: `### CUSTOM ADMIN RULES ###`.
- The core policy instructs Gemini that these custom rules supersede default behavior.

## Acceptance Scenarios
1. **Unauthorized Access:** A non-admin DMing the bot receives an access denied message.
2. **Add Rule:** Admin DMs a new rule. Bot confirms. The rule appears in the JSON file.
3. **Apply Rule:** The very next booking posted in a public channel is reviewed using the newly added rule.
4. **List Rules:** Admin asks "what are your rules?" Bot lists them with their IDs.
5. **Edit Rule:** Admin asks to change a rule. Bot updates the specific ID in the file and confirms.
6. **Delete Rule:** Admin asks to delete a rule. Bot removes it from the file and confirms.

