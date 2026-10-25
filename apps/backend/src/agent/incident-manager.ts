import { LogisticsConversation } from "./conversation.js";
import type { LogisticsAnalysis } from "./index.js";

export class IncidentManager {
  private incidents = new Map<string, LogisticsConversation>();

  async report(
    incidentId: string,
    message: string
  ): Promise<LogisticsAnalysis> {
    if (!incidentId.trim()) {
      throw new Error("An incident ID is required.");
    }

    let conversation = this.incidents.get(incidentId);

    if (!conversation) {
      conversation = new LogisticsConversation();
      this.incidents.set(incidentId, conversation);
    }

    return conversation.send(message);
  }

  getHistory(incidentId: string): string[] {
    return this.incidents.get(incidentId)?.getHistory() ?? [];
  }

  closeIncident(incidentId: string): boolean {
    return this.incidents.delete(incidentId);
  }

  getActiveIncidentIds(): string[] {
    return [...this.incidents.keys()];
  }
}