import { promises as fs } from "fs";

export class RuleStore {
  private queue: Promise<void> = Promise.resolve();

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
    const task = this.queue.then(async () => {
      const rules = await this.getRules();
      rules.push(rule);
      await fs.writeFile(this.filepath, JSON.stringify(rules, null, 2));
    });
    this.queue = task.catch(() => {});
    return task;
  }

  async removeRule(index: number): Promise<boolean> {
    let result = false;
    const task = this.queue.then(async () => {
      const rules = await this.getRules();
      if (index >= 0 && index < rules.length) {
        rules.splice(index, 1);
        await fs.writeFile(this.filepath, JSON.stringify(rules, null, 2));
        result = true;
      }
    });
    this.queue = task.catch(() => {});
    await task;
    return result;
  }
}
