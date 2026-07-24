import { promises as fs } from "fs";
import * as path from "path";

export class RuleStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filepath: string) {}

  private async ensureDir(): Promise<void> {
    const dir = path.dirname(this.filepath);
    if (dir !== "." && dir !== "") {
      await fs.mkdir(dir, { recursive: true }).catch((err) => {
        if (err.code !== "EEXIST") throw err;
      });
    }
  }

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
      await this.ensureDir();
      await fs.writeFile(this.filepath, JSON.stringify(rules, null, 2));
    });
    this.queue = task.catch(() => {});
    return task;
  }

  async deleteRule(index: number): Promise<boolean> {
    let result = false;
    const task = this.queue.then(async () => {
      const rules = await this.getRules();
      if (index >= 0 && index < rules.length) {
        rules.splice(index, 1);
        await this.ensureDir();
        await fs.writeFile(this.filepath, JSON.stringify(rules, null, 2));
        result = true;
      }
    });
    this.queue = task.catch(() => {});
    await task;
    return result;
  }

  async updateRule(index: number, rule: string): Promise<boolean> {
    let result = false;
    const task = this.queue.then(async () => {
      const rules = await this.getRules();
      if (index >= 0 && index < rules.length) {
        rules[index] = rule;
        await this.ensureDir();
        await fs.writeFile(this.filepath, JSON.stringify(rules, null, 2));
        result = true;
      }
    });
    this.queue = task.catch(() => {});
    await task;
    return result;
  }
}
