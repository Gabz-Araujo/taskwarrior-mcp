import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Taskwarrior } from "../taskwarrior/index.js";

export function registerPrompts(server: McpServer, tw: Taskwarrior): void {
  server.registerPrompt(
    "daily-triage",
    {
      title: "Daily tasks triage",
      description: "Triage of tasks overdue and with highr priority",
    },
    async () => {
      const overdue = await tw.list({ status: "pending", dueBefore: "now" });
      const urgent = await tw.list(
        { status: "pending" },
        { limit: 10, sort: "urgency" },
      );
      const text = `Overdue (${overdue.length}): ${overdue.map((t) => t.description).join(", ")}
                    Urgent (${urgent.length}): ${urgent.map((t) => t.description).join(", ")}`;
      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );
}
