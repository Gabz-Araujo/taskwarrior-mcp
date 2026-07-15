import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Taskwarrior } from "../taskwarrior/index.js";
import { TaskwarriorError } from "../taskwarrior/index.js";
import {
  addTaskShape,
  annotateTaskShape,
  denotateTaskShape,
  listTasksShape,
  modifyTaskShape,
  taskListOutputShape,
  taskNullableOutputShape,
  taskOutputShape,
  uuidShape,
  whatsNextShape,
} from "./schemas.js";

const GUIDANCE: Partial<Record<string, string>> = {
  "not-found": "Call list_tasks or get_task to find valid uuids",
  "invalid-input": "Fix the input and try again",
  execution: "Check the taskwarrior logs for more information",
};

function compact<T extends object>(
  obj: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as { [K in keyof T]: Exclude<T[K], undefined> };
}

function ok(structured: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
  };
}

function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function guard<T>(
  fn: () => Promise<T>,
  shape: (result: T) => Record<string, unknown>,
): Promise<CallToolResult> {
  try {
    return ok(shape(await fn()));
  } catch (error) {
    if (error instanceof TaskwarriorError) {
      const hint = error.kind in GUIDANCE ? GUIDANCE[error.kind] : undefined;
      return fail(error.message + (hint ? ` (${hint})` : ""));
    }
    console.error("Unhandled error in tool handler:", error);
    return fail("An unexpected internal error occurred.");
  }
}

export function registerTools(server: McpServer, tw: Taskwarrior): void {
  server.registerTool(
    "add_task",
    {
      title: "Add task",
      description: "Create a new taskwarrior task.",
      inputSchema: addTaskShape,
      outputSchema: taskOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ description, ...options }) =>
      guard(
        () => tw.add(description, compact(options)),
        (task) => ({ task }),
      ),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description:
        "List tasks with optional filtering (status, project, tags, due range), " +
        "sorting, and a result limit. Defaults to pending tasks and returns at " +
        "most 100 unless a smaller or larger limit is given.",
      inputSchema: listTasksShape,
      outputSchema: taskListOutputShape,
      annotations: { readOnlyHint: true },
    },
    async ({ limit, sort, ...filter }) =>
      guard(
        () => tw.list(compact(filter), compact({ limit: limit ?? 100, sort })),
        (tasks) => ({ tasks }),
      ),
  );

  server.registerTool(
    "modify_task",
    {
      title: "Modify task",
      description: "Modify an existing task identified by uuid.",
      inputSchema: modifyTaskShape,
      outputSchema: taskOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ uuid, ...options }) =>
      guard(
        () => tw.modify(uuid, compact(options)),
        (task) => ({ task }),
      ),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete task",
      description: "Mark a task as done.",
      inputSchema: uuidShape,
      outputSchema: taskOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      },
    },
    async ({ uuid }) =>
      guard(
        () => tw.done(uuid),
        (task) => ({ task }),
      ),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description:
        "Delete a task (soft delete — the task is marked deleted, not purged).",
      inputSchema: uuidShape,
      outputSchema: taskOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ uuid }) =>
      guard(
        () => tw.delete(uuid),
        (task) => ({ task }),
      ),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description: "Fetch a single task by uuid.",
      inputSchema: uuidShape,
      outputSchema: taskNullableOutputShape,
      annotations: { readOnlyHint: true },
    },
    async ({ uuid }) =>
      guard(
        () => tw.getByUuid(uuid),
        (task) => ({ task: task ?? null }),
      ),
  );

  server.registerTool(
    "whats_next",
    {
      title: "What's next",
      description:
        "Get the highest-urgency pending tasks to focus on next, optionally scoped by project or tags.",
      inputSchema: whatsNextShape,
      outputSchema: taskListOutputShape,
      annotations: { readOnlyHint: true },
    },
    async ({ limit, ...scope }) =>
      guard(
        () =>
          tw.list(
            { status: "pending", ...compact(scope) },
            { sort: "urgency", limit: limit ?? 10 },
          ),
        (tasks) => ({ tasks }),
      ),
  );

  server.registerTool(
    "annotate_task",
    {
      title: "Annotate task",
      description: "Add an annotation to a task.",
      inputSchema: annotateTaskShape,
      outputSchema: taskOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ uuid, annotation }) =>
      guard(
        () => tw.annotate(uuid, annotation),
        (task) => ({ task }),
      ),
  );

  server.registerTool(
    "denotate_task",
    {
      title: "Denotate task",
      description: "Remove an annotation from a task.",
      inputSchema: denotateTaskShape,
      outputSchema: taskOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ uuid, annotation }) =>
      guard(
        () => tw.denotate(uuid, annotation),
        (task) => ({ task }),
      ),
  );

  server.registerTool(
    "start_task",
    {
      title: "Start Task",
      description: "Start a task",
      inputSchema: uuidShape,
      outputSchema: taskOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ uuid }) =>
      guard(
        () => tw.start(uuid),
        (task) => ({ task }),
      ),
  );

  server.registerTool(
    "stop_task",
    {
      title: "Stop Task",
      description: "Stop a task",
      inputSchema: uuidShape,
      outputSchema: taskOutputShape,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ uuid }) =>
      guard(
        () => tw.stop(uuid),
        (task) => ({ task }),
      ),
  );
}
