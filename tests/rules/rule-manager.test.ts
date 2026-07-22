import { expect, test, describe, mock } from "bun:test";
import { RuleManager } from "../../src/rules/rule-manager";
import type { RuleStore } from "../../src/rules/rule-store";

// We'll mock the actual GoogleGenAI module
mock.module("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mock().mockImplementation(async (req: any) => {
          const text = req.contents[0].parts[0].text;
          if (text.includes("add")) {
            return { text: JSON.stringify({ action: "add", payload: "New rule", response: "Added rule." }) };
          } else if (text.includes("delete")) {
            return { text: JSON.stringify({ action: "delete", payload: "0", response: "Deleted rule." }) };
          } else if (text.includes("update")) {
            return { text: JSON.stringify({ action: "update", payload: "0|Updated rule", response: "Updated rule." }) };
          }
          return { text: JSON.stringify({ action: "unknown", response: "Unknown." }) };
        })
      };
    }
  };
});

describe("RuleManager", () => {
  test("adds a rule and returns response", async () => {
    const store = {
      getRules: async () => [],
      addRule: mock().mockResolvedValue(undefined),
      deleteRule: mock().mockResolvedValue(true),
      updateRule: mock().mockResolvedValue(true)
    };

    const manager = new RuleManager("fake-api-key", "gemini-3.5-flash-lite", store as unknown as RuleStore);
    
    const response = await manager.handleAdminMessage("Please add a rule");
    expect(response).toBe("Added rule.");
    expect(store.addRule).toHaveBeenCalledWith("New rule");
  });

  test("deletes a rule and returns response", async () => {
    const store = {
      getRules: async () => ["Rule 1"],
      addRule: mock().mockResolvedValue(undefined),
      deleteRule: mock().mockResolvedValue(true),
      updateRule: mock().mockResolvedValue(true)
    };

    const manager = new RuleManager("fake-api-key", "gemini-3.5-flash-lite", store as unknown as RuleStore);
    
    const response = await manager.handleAdminMessage("Please delete rule 0");
    expect(response).toBe("Deleted rule.");
    expect(store.deleteRule).toHaveBeenCalledWith(0);
  });

  test("updates a rule and returns response", async () => {
    const store = {
      getRules: async () => ["Rule 1"],
      addRule: mock().mockResolvedValue(undefined),
      deleteRule: mock().mockResolvedValue(true),
      updateRule: mock().mockResolvedValue(true)
    };

    const manager = new RuleManager("fake-api-key", "gemini-3.5-flash-lite", store as unknown as RuleStore);
    
    const response = await manager.handleAdminMessage("Please update rule 0");
    expect(response).toBe("Updated rule.");
    expect(store.updateRule).toHaveBeenCalledWith(0, "Updated rule");
  });
});
