import { GoogleGenAI } from "@google/genai";
import type { RuleStore } from "./rule-store";

const ACTION_SCHEMA = {
  type: "object",
  required: ["action", "response"],
  properties: {
    action: { type: "string", enum: ["add", "delete", "update", "list", "unknown"] },
    payload: { type: "string" },
    response: { type: "string" }
  }
} as const;

export class RuleManager {
  private client: GoogleGenAI;
  
  constructor(apiKey: string, private model: string, private store: RuleStore) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async handleAdminMessage(message: string, images?: { mimeType: string, data: Uint8Array }[]): Promise<string> {
    const rules = await this.store.getRules();
    const systemPrompt = `You are a helpful assistant that manages booking review rules. 
Current rules:
${rules.length === 0 ? "None" : rules.map((r, i) => `${i}: ${r}`).join('\n')}

Based on the admin's message, determine the action:
- add: include the rule text in 'payload'.
- delete: include the exact rule index as 'payload' (as a string number).
- update: include the exact rule index and new rule text in 'payload' (format: "index|new text").
- list: no payload needed.
- unknown: for any unrelated conversation.
Provide a friendly conversational response explaining what you did in 'response'.`;

    const parts: any[] = [{ text: message || "Please process the attached screenshots." }];
    if (images && images.length > 0) {
      for (const image of images) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType,
            data: Buffer.from(image.data).toString("base64")
          }
        });
      }
    }

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseJsonSchema: ACTION_SCHEMA,
        temperature: 0
      }
    });

    if (!response.text) return "I couldn't process that request.";
    const result = JSON.parse(response.text);
    
    if (result.action === "add" && result.payload) {
      await this.store.addRule(result.payload);
    } else if (result.action === "delete" && result.payload) {
      const index = parseInt(result.payload, 10);
      if (!isNaN(index)) {
          const removed = await this.store.deleteRule(index);
          if (!removed) return "I couldn't find a rule at that index to delete.";
      }
    } else if (result.action === "update" && result.payload) {
      const [indexStr, ...textParts] = result.payload.split("|");
      const index = parseInt(indexStr, 10);
      const text = textParts.join("|");
      if (!isNaN(index) && text) {
          const updated = await this.store.updateRule(index, text);
          if (!updated) return "I couldn't find a rule at that index to update.";
      }
    } else if (result.action === "list") {
      const currentRules = await this.store.getRules();
      return currentRules.length === 0
        ? result.response + "\n\n(No rules currently saved.)"
        : result.response + "\n\n" + currentRules.map((r, i) => `${i}: ${r}`).join('\n');
    }

    return result.response;
  }
}
