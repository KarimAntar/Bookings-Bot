import { GoogleGenAI } from "@google/genai";
import type { RuleStore } from "./rule-store";

const ACTION_SCHEMA = {
  type: "object",
  required: ["action", "response"],
  properties: {
    action: { type: "string", enum: ["add", "remove", "list", "unknown"] },
    payload: { type: "string" },
    response: { type: "string" }
  }
} as const;

export class RuleManager {
  private client: GoogleGenAI;
  
  constructor(apiKey: string, private model: string, private store: RuleStore) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async handleAdminMessage(message: string): Promise<string> {
    const rules = await this.store.getRules();
    const systemPrompt = `You are a helpful assistant that manages booking review rules. 
Current rules:
${rules.length === 0 ? "None" : rules.map((r, i) => `${i}: ${r}`).join('\n')}

Based on the admin's message, determine the action:
- add: include the rule text in 'payload'.
- remove: include the exact rule index as 'payload' (as a string number).
- list: no payload needed.
- unknown: for any unrelated conversation.
Provide a friendly conversational response explaining what you did in 'response'.`;

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: [{ text: message }] }],
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
    } else if (result.action === "remove" && result.payload) {
      const index = parseInt(result.payload, 10);
      if (!isNaN(index)) {
          const removed = await this.store.removeRule(index);
          if (!removed) return "I couldn't find a rule at that index to remove.";
      }
    }
    
    return result.response;
  }
}
