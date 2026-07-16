import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Taskwarrior, Task } from "../taskwarrior/index.js";

function sevenDaysAgoBasicIso(): string {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return cutoff
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

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

  server.registerPrompt(
    "weekly-review",
    {
      title: "Weekly review",
      description:
        "A GTD-style weekly review: open work by project, overdue, and recently completed. Optionally scoped to one project.",
      argsSchema: {
        project: z
          .string()
          .optional()
          .describe("Restrict the review to a single project."),
      },
    },
    async ({ project }) => {
      const scopeFilter = project ? { project } : {};
      const pending = await tw.list({ status: "pending", ...scopeFilter });
      const overdue = await tw.list({
        status: "pending",
        dueBefore: "now",
        ...scopeFilter,
      });
      const cutoff = sevenDaysAgoBasicIso();
      const completed = (
        await tw.list({ status: "completed", ...scopeFilter })
      ).filter((t) => t.end !== undefined && t.end >= cutoff);

      const scope = project ? ` for project "${project}"` : "";
      const text = [
        `Weekly review${scope}.`,
        "",
        `Open (${pending.length}), by project:`,
        groupByProject(pending),
        "",
        `Overdue (${overdue.length}):`,
        groupByProject(overdue),
        "",
        `Completed in the last 7 days (${completed.length}):`,
        groupByProject(completed),
        "",
        "What progressed, what's stuck, and what should the top priorities be for the coming week?",
      ].join("\n");

      return {
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  );
}
