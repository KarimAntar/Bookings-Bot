import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { promises as fs } from "fs";
import { RuleStore } from "../../src/rules/rule-store";

describe("RuleStore", () => {
  const filepath = "./test-rules.json";

  afterEach(async () => {
    try {
      await fs.unlink(filepath);
    } catch {}
  });

  test("returns empty array if file does not exist", async () => {
    const store = new RuleStore(filepath);
    expect(await store.getRules()).toEqual([]);
  });

  test("adds and lists rules", async () => {
    const store = new RuleStore(filepath);
    await store.addRule("Rule 1");
    await store.addRule("Rule 2");
    expect(await store.getRules()).toEqual(["Rule 1", "Rule 2"]);
  });

  test("deletes rule by index", async () => {
    const store = new RuleStore(filepath);
    await store.addRule("Rule 1");
    await store.addRule("Rule 2");
    const removed = await store.deleteRule(0);
    expect(removed).toBe(true);
    expect(await store.getRules()).toEqual(["Rule 2"]);
  });

  test("returns false when deleting invalid index", async () => {
    const store = new RuleStore(filepath);
    await store.addRule("Rule 1");
    expect(await store.deleteRule(99)).toBe(false);
  });

  test("updates rule by index", async () => {
    const store = new RuleStore(filepath);
    await store.addRule("Rule 1");
    const updated = await store.updateRule(0, "Updated Rule");
    expect(updated).toBe(true);
    expect(await store.getRules()).toEqual(["Updated Rule"]);
  });

  test("returns false when updating invalid index", async () => {
    const store = new RuleStore(filepath);
    await store.addRule("Rule 1");
    expect(await store.updateRule(99, "Updated Rule")).toBe(false);
  });

  test("adds rules concurrently without data loss", async () => {
    const store = new RuleStore(filepath);
    const rules = Array.from({ length: 10 }, (_, i) => "Rule ${i}");
    await Promise.all(rules.map((rule) => store.addRule(rule)));
    const savedRules = await store.getRules();
    expect(savedRules).toHaveLength(10);
  });
});
