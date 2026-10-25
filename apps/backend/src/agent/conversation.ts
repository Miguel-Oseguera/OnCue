import { runLogisticsAgent, type LogisticsAnalysis } from "./index.js";

export class LogisticsConversation {
  private history: string[] = [];

  async send(message: string): Promise<LogisticsAnalysis> {
    const { analysis } = await runLogisticsAgent({
      message,
      history: this.history,
    });

    // Only include successfully analyzed reports in conversation history.
    this.history.push(message);

    return analysis;
  }

  getHistory(): string[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }
}
