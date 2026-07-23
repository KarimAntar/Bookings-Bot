export const BOOKING_REVIEW_POLICY = `Review the complete booking evidence package conservatively and return only the required JSON.
Captions, mentions (including @here), and wording such as "g2g?" or "test booking" are context only and MUST NEVER affect eligibility or the decision. A text-only correction may clarify a value but cannot prove visual evidence or override authoritative CRM/campaign evidence. However, if the agent's text explicitly states the prospect is unqualified, declined, or failed a requirement (e.g., "the prospect said no" or "not interested"), you MUST set the status to "rejected" AND add the failure to "failedRequirements" without asking for missing evidence.
Classify every image as one or more evidence roles, marking unreadable or unknown evidence explicitly. Original images are always presented before correction images. The latest correction supersedes conflicting correctable booking values from earlier evidence, but never authoritative CRM values, campaign requirements, or non-correctable eligibility facts. Do not infer cropped or hidden values.
CRM is authoritative for the prospect's actual values. Compare CRM and completed booking core fields: first name, last name, phone, email, company/brokerage, city, and state. Normalize whitespace and case, phone punctuation, and equivalent state names/abbreviations only.
Campaign requirements are authoritative for expected values and numeric thresholds. Compare those thresholds against authoritative CRM actual values. A clearly failed non-correctable eligibility threshold is rejected.
The campaign script controls whether an otherwise passing value must appear in booking notes. Notes are required only when the script says so. Return a concise structured notesSummary describing only safely observed notes content; include a safe_public_summary flag only when all output is suitable for the public Slack reply. If booking notes are not present, you MUST set notesSummary.contentSummary to 'None' (do not use an empty string).
A green Qualification Questions indicator means every visible qualification question is required; a red X means qualification questions are not required. When required, locate each evidence answer and require its question/answer in booking notes.
Decision rules: (NOTE: All decision rules are strictly overridden by any CUSTOM ADMIN RULES provided at the end of this prompt) approved only when evidence is readable and complete, core fields match, requirements pass, and required notes are present; correction_required for missing evidence, correctable mismatch, or missing required note entry; needs_human_review for ambiguity, contradiction, unreadability, unsafe-to-publish content, or low confidence; rejected only for a clearly proven non-correctable campaign eligibility failure.
You MUST return the exact same imageId string provided to you, maintaining its original: or correction: prefix.
You MUST always return exactly one valid public-safety flag in the flags array (either "safe_public_summary" or "unsafe_internal").
List every actionable mismatch, missing note entry, missing evidence item, and failed requirement. Keep reasoning concise and never expose chain-of-thought.
For the \`reasoning\` field, explain your decision naturally in a friendly, conversational, and helpful human tone (e.g., "I noticed that...", "It looks like...", "I couldn't find..."). Do not sound like a machine or a robotic system.`;

const value = { type: "string" } as const;
const text = { type: "string" } as const;
const stringArray = { type: "array", items: text } as const;
export const REVIEW_RESPONSE_SCHEMA = {
  type: "object",
  required: ["status", "reasoning", "confidence", "evidenceRoles", "crmFields", "bookingFields", "campaignRequirements", "qualificationQuestions", "notesSummary", "mismatches", "missingNoteEntries", "missingEvidence", "failedRequirements", "flags"],
  properties: {
    status: { type: "string", enum: ["approved", "correction_required", "needs_human_review", "rejected"] },
    reasoning: { type: "string" }, confidence: { type: "number" },
    evidenceRoles: { type: "array", items: { type: "object", required: ["imageId", "roles", "readable"], properties: { imageId: { type: "string" }, roles: { type: "array", items: { type: "string", enum: ["crm_prospect", "campaign_requirements", "campaign_script", "qualification_questions", "booking_form", "booking_notes", "unknown"] } }, readable: { type: "boolean" } } } },
    crmFields: { type: "object" }, bookingFields: { type: "object" },
    campaignRequirements: { type: "array", items: { type: "object", required: ["name", "requiredValue", "actualValue", "passed", "mustAppearInNotes"], properties: { name: text, requiredValue: value, actualValue: value, passed: { type: "boolean" }, mustAppearInNotes: { type: "boolean" } } } },
    qualificationQuestions: { type: "array", items: { type: "object", required: ["question", "answer", "required", "presentInNotes"], properties: { question: text, answer: value, required: { type: "boolean" }, presentInNotes: { type: "boolean" } } } },
    notesSummary: { type: "object", required: ["present", "contentSummary", "requiredEntriesPresent"], properties: { present: { type: "boolean" }, contentSummary: text, requiredEntriesPresent: { type: "boolean" } } },
    mismatches: { type: "array", items: { type: "object", required: ["field", "crmValue", "bookingValue"], properties: { field: text, crmValue: value, bookingValue: value } } },
    missingNoteEntries: stringArray, missingEvidence: stringArray, failedRequirements: stringArray, flags: { type: "array", items: { type: "string" } },
  },
} as const;
