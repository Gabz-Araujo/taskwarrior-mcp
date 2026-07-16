import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Taskwarrior, Task } from "../taskwarrior/index.js";

function countByProject(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const project = task.project ?? "(no project)";
    counts.set(project, (counts.get(project) ?? 0) + 1);
  }
  return counts;
}

export function registerResources(server: McpServer, tw: Taskwarrior): void {
  server.registerResource(
    "projects",
    "taskwarrior://projects",
    {
      title: "Projects overview",
      description: "Every project with its pending and overdue task counts.",
      mimeType: "application/json",
    },
    async (uri) => {
      const pending = await tw.list({ status: "pending" });
      const overdue = await tw.list({ status: "pending", dueBefore: "now" });

      const pendingByProject = countByProject(pending);
      const overdueByProject = countByProject(overdue);

      const overview = [...pendingByProject.entries()].map(
        ([project, count]) => ({
          project,
          pending: count,
          overdue: overdueByProject.get(project) ?? 0,
        }),
      );

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(overview, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "project-tasks",
    new ResourceTemplate("taskwarrior://project/{name}", {
      list: undefined,
      complete: {
        name: async () => {
          const pending = await tw.list({ status: "pending" });
          const projects = new Set<string>();
          for (const task of pending) {
            if (task.project) projects.add(task.project);
          }
          return [...projects];
        },
      },
    }),
    {
      title: "Project tasks",
      description: "Open (pending) tasks for a single project.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const name = Array.isArray(variables.name)
        ? (variables.name[0] ?? "")
        : (variables.name ?? "");
      const tasks = await tw.list({ status: "pending", project: name });
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(tasks, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "stats",
    "taskwarrior://stats",
    {
      title: "Task stats",
      description: "Task counts by status, plus the overdue total.",
      mimeType: "application/json",
    },
    async (uri) => {
      const [pending, completed, deleted, overdue] = await Promise.all([
        tw.list({ status: "pending" }),
        tw.list({ status: "completed" }),
        tw.list({ status: "deleted" }),
        tw.list({ status: "pending", dueBefore: "now" }),
      ]);
      const stats = {
        pending: pending.length,
        completed: completed.length,
        deleted: deleted.length,
        overdue: overdue.length,
      };
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    },
  );
}
