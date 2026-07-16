import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Taskwarrior, Task } from "../taskwarrior/index.js";

function groupByProject(tasks: Task[]): string {
  if (tasks.length === 0) return "  (none)";

  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const project = task.project ?? "(no project)";
    const group = groups.get(project) ?? [];
    group.push(task);
    groups.set(project, group);
  }

  const lines: string[] = [];
  for (const [project, group] of groups) {
    lines.push(`  ${project}:`);
    for (const task of group) {
      const due = task.due ? ` (due ${task.due})` : "";
      lines.push(`    - ${task.description}${due} [${task.uuid}]`);
    }
  }
  return lines.join("\n");
}

export function registerPrompts(server: McpServer, tw: Taskwarrior): void {
  server.registerPrompt(
    "daily-triage",
    {
      title: "Daily tasks triage",
      description:
        "Overdue and highest-urgency tasks to review now, grouped by project.",
    },
    async () => {
      const overdue = await tw.list({ status: "pending", dueBefore: "now" });
      const urgent = await tw.list(
        { status: "pending" },
        { limit: 10, sort: "urgency" },
      );

      const text = [
        "Daily triage.",
        "",
        `Overdue (${overdue.length}), by project:`,
        groupByProject(overdue),
        "",
        `Highest urgency (${urgent.length}), by project:`,
        groupByProject(urgent),
        "",
        "Which should I tackle now? Anything to reschedule or drop?",
      ].join("\n");

      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );
}
