import {
  runLogisticsAgent,
  type LogisticsAnalysis,
} from "./index.js";

export class LogisticsConversation {
  private history: string[] = [];

  async send(message: string): Promise<LogisticsAnalysis> {
    const result = await runLogisticsAgent(message, this.history);

    // Only save the report after successful analysis
    this.history.push(message);

    return result;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }
}