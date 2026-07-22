import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { promises as fs } from "fs";
import { RuleStore } from "../../src/rules/rule-store";

describe("RuleStore", () => {
  const filepath = "./test-rules.json";

  afterEach(async () => {
    try { await fs.unlink(filepath); } catch {}
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

  test("removes rule by index", async () => {
    const store = new RuleStore(filepath);
    await store.addRule("Rule 1");
    await store.addRule("Rule 2");
    const removed = await store.removeRule(0);
    expect(removed).toBe(true);
    expect(await store.getRules()).toEqual(["Rule 2"]);
  });

  test("returns false when removing invalid index", async () => {
    const store = new RuleStore(filepath);
    await store.addRule("Rule 1");
    expect(await store.removeRule(99)).toBe(false);
  });
});
