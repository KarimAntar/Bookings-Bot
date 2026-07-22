import { promises as fs } from "fs";

export class RuleStore {
  constructor(private readonly filepath: string) {}

  async getRules(): Promise<string[]> {
    try {
      const data = await fs.readFile(this.filepath, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async addRule(rule: string): Promise<void> {
    const rules = await this.getRules();
    rules.push(rule);
    await fs.writeFile(this.filepath, JSON.stringify(rules, null, 2));
  }

  async removeRule(index: number): Promise<boolean> {
    const rules = await this.getRules();
    if (index < 0 || index >= rules.length) return false;
    rules.splice(index, 1);
    await fs.writeFile(this.filepath, JSON.stringify(rules, null, 2));
    return true;
  }
}
