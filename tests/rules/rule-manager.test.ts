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
          const hasImage = req.contents[0].parts.some((p: any) => p.inlineData);
          if (hasImage && text.includes("Look at this screenshot")) {
            return { text: JSON.stringify({ action: "add", payload: "Rule from image", response: "Added rule from image." }) };
          }
          if (text.includes("add")) {
            return { text: JSON.stringify({ action: "add", payload: "New rule", response: "Added rule." }) };
          } else if (text.includes("delete")) {
            return { text: JSON.stringify({ action: "delete", payload: "0", response: "Deleted rule." }) };
          } else if (text.includes("update")) {
            return { text: JSON.stringify({ action: "update", payload: "0|Updated rule", response: "Updated rule." }) };
          } else if (text.includes("list")) {
            return { text: JSON.stringify({ action: "list", response: "Here are the rules:" }) };
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

  test("lists rules with existing rules", async () => {
    const store = {
      getRules: async () => ["Rule 1", "Rule 2"],
      addRule: mock().mockResolvedValue(undefined),
      deleteRule: mock().mockResolvedValue(true),
      updateRule: mock().mockResolvedValue(true)
    };

    const manager = new RuleManager("fake-api-key", "gemini-3.5-flash-lite", store as unknown as RuleStore);

    const response = await manager.handleAdminMessage("Please list rules");
    expect(response).toBe("Here are the rules:\n\n0: Rule 1\n1: Rule 2");
  });

  test("lists rules with empty rules", async () => {
    const store = {
      getRules: async () => [],
      addRule: mock().mockResolvedValue(undefined),
      deleteRule: mock().mockResolvedValue(true),
      updateRule: mock().mockResolvedValue(true)
    };

    const manager = new RuleManager("fake-api-key", "gemini-3.5-flash-lite", store as unknown as RuleStore);

    const response = await manager.handleAdminMessage("Please list rules");
    expect(response).toBe("Here are the rules:\n\n(No rules currently saved.)");
  });
});
