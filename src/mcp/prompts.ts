import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Taskwarrior, Task } from "../taskwarrior/index.js";
import type { UdaDef } from "../taskwarrior/udas.js";

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

function isOpenLookup(all: Task[]): (uuid: string) => boolean {
  const byUuid = new Map(all.map((task) => [task.uuid, task]));
  return (uuid: string) => {
    const task = byUuid.get(uuid);
    return !task || (task.status !== "completed" && task.status !== "deleted");
  };
}

function describeTasks(tasks: Task[]): string {
  if (tasks.length === 0) return "  (none)";
  return tasks
    .map((task) => `  - ${task.description} [${task.uuid}]`)
    .join("\n");
}

function groupByUda(tasks: Task[], field: string): string {
  if (tasks.length === 0) return "  (none)";
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const value = task.udas?.[field];
    const label = value === undefined ? `(no ${field})` : String(value);
    const group = groups.get(label) ?? [];
    group.push(task);
    groups.set(label, group);
  }
  const lines: string[] = [];
  for (const [label, group] of groups) {
    lines.push(`  ${label}:`);
    for (const task of group) {
      const due = task.due ? ` (due ${task.due})` : "";
      lines.push(`    - ${task.description}${due} [${task.uuid}]`);
    }
  }
  return lines.join("\n");
}

export function registerPrompts(
  server: McpServer,
  tw: Taskwarrior,
  udas: UdaDef[] = [],
): void {
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

  server.registerPrompt(
    "plan-project",
    {
      title: "Plan a project",
      description:
        "Decompose a goal into a dependency graph of steps, shaped for the create_project tool.",
      argsSchema: {
        goal: z.string().describe("The project goal to break down into steps."),
        project: z
          .string()
          .optional()
          .describe("Existing project name to plan within, if any."),
      },
    },
    async ({ goal, project }) => {
      const existing = project
        ? await tw.list({ status: "pending", project })
        : [];
      const scope = project ? ` for project "${project}"` : "";
      const text = [
        `Plan the project${scope}.`,
        "",
        `Goal: ${goal}`,
        "",
        `Existing open tasks${scope} (${existing.length}):`,
        groupByProject(existing),
        "",
        "Break the goal into concrete steps and express them as a dependency graph.",
        "Each step is an object with these fields:",
        "  - ref: a local id used only to wire dependencies in this plan",
        "  - description: the task text",
        "  - priority?: H | M | L",
        "  - due?: taskwarrior date syntax",
        "  - tags?: string[]",
        "  - dependsOn?: refs of steps that must finish first",
        "  - udas?: custom fields (see the custom-fields resource)",
        "",
        "Present the plan for review, then call create_project to scaffold it.",
      ].join("\n");
      return { messages: [{ role: "user", content: { type: "text", text } }] };
    },
  );

  server.registerPrompt(
    "unblock",
    {
      title: "Unblock work",
      description:
        "Blocked tasks and the blockers that would free the most work, from the dependency graph.",
      argsSchema: {
        project: z
          .string()
          .optional()
          .describe("Restrict the blocked-task list to a single project."),
      },
    },
    async ({ project }) => {
      const all = await tw.list({ status: "all" });
      const isOpen = isOpenLookup(all);
      const byUuid = new Map(all.map((task) => [task.uuid, task]));
      const pending = all.filter((task) => task.status === "pending");
      const scoped = project
        ? pending.filter((task) => task.project === project)
        : pending;

      const blocked = scoped.filter((task) =>
        (task.depends ?? []).some(isOpen),
      );

      const counts = new Map<string, number>();
      for (const task of pending) {
        for (const dep of task.depends ?? []) {
          if (isOpen(dep)) counts.set(dep, (counts.get(dep) ?? 0) + 1);
        }
      }
      const blockers = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([uuid, count]) => {
          const task = byUuid.get(uuid);
          const label = task ? task.description : "(unknown task)";
          return `  - ${label} [${uuid}] — unblocks ${count}`;
        });

      const scope = project ? ` in project "${project}"` : "";
      const text = [
        `Unblock work${scope}.`,
        "",
        `Blocked (${blocked.length}):`,
        describeTasks(blocked),
        "",
        `Blockers, most unblocking first (${blockers.length}):`,
        blockers.length > 0 ? blockers.join("\n") : "  (none)",
        "",
        "Which blockers should I clear first to free the most work?",
      ].join("\n");
      return { messages: [{ role: "user", content: { type: "text", text } }] };
    },
  );

  server.registerPrompt(
    "GTD",
    {
      title: "GTD next actions",
      description:
        "Actionable tasks grouped by context, plus what you're waiting on. The GTD 'engage' step.",
      argsSchema: {
        project: z
          .string()
          .optional()
          .describe("Restrict the view to a single project."),
      },
    },
    async ({ project }) => {
      const all = await tw.list({ status: "all" });
      const isOpen = isOpenLookup(all);
      const inScope = (task: Task) => !project || task.project === project;

      const pending = all.filter(
        (task) => task.status === "pending" && inScope(task),
      );
      const blocked = pending.filter((task) =>
        (task.depends ?? []).some(isOpen),
      );
      const blockedSet = new Set(blocked.map((task) => task.uuid));
      const actionable = pending.filter((task) => !blockedSet.has(task.uuid));
      const waiting = all.filter(
        (task) => task.status === "waiting" && inScope(task),
      );
      const waitingFor = [...waiting, ...blocked];

      const hasContext = udas.some((uda) => uda.name === "context");
      const withAction = new Set(
        actionable.map((task) => task.project ?? "(no project)"),
      );
      const stalled = [
        ...new Set(pending.map((task) => task.project ?? "(no project)")),
      ].filter((name) => !withAction.has(name));

      const scope = project ? ` in project "${project}"` : "";
      const text = [
        `GTD — next actions${scope}.`,
        "",
        hasContext
          ? `Actionable by context (${actionable.length}):`
          : `Actionable by project (${actionable.length}) — define a context UDA for the real GTD view:`,
        hasContext
          ? groupByUda(actionable, "context")
          : groupByProject(actionable),
        "",
        `Waiting for (${waitingFor.length}):`,
        describeTasks(waitingFor),
        "",
        `Projects with no next action (${stalled.length}):`,
        stalled.length > 0
          ? stalled.map((name) => `  - ${name}`).join("\n")
          : "  (none)",
        "",
        "What can I do right now, and is anything waiting that I should chase?",
      ].join("\n");
      return { messages: [{ role: "user", content: { type: "text", text } }] };
    },
  );

  server.registerPrompt(
    "PARA",
    {
      title: "PARA review",
      description:
        "Pending work organized by area of responsibility (PARA), flagging anything unfiled.",
      argsSchema: {
        project: z
          .string()
          .optional()
          .describe("Restrict the review to a single project."),
      },
    },
    async ({ project }) => {
      const pending = await tw.list({
        status: "pending",
        ...(project ? { project } : {}),
      });
      const hasArea = udas.some((uda) => uda.name === "area");
      const scope = project ? ` for project "${project}"` : "";

      const body = hasArea
        ? [`By area (${pending.length}):`, groupByUda(pending, "area")]
        : [
            `By project (${pending.length}) — define an area UDA for the real PARA view:`,
            groupByProject(pending),
          ];

      const text = [
        `PARA review${scope}.`,
        "",
        ...body,
        "",
        "Are areas in balance? What is stale and should be archived, and what has no home?",
      ].join("\n");
      return { messages: [{ role: "user", content: { type: "text", text } }] };
    },
  );
}
