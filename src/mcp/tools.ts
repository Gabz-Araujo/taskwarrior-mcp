import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Taskwarrior } from "../taskwarrior/index.js";
import { TaskwarriorError } from "../taskwarrior/index.js";
import {
  addTaskShape,
  listTasksShape,
  modifyTaskShape,
  uuidShape,
} from "./schemas.js";

function compact<T extends object>(obj: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out as { [K in keyof T]: Exclude<T[K], undefined> };
}

function ok(data: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text: JSON.stringify(data ?? { ok: true }, null, 2) },
    ],
  };
}

function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function guard(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof TaskwarriorError) return fail(error.message);
    throw error;
  }
}

export function registerTools(server: McpServer, tw: Taskwarrior): void {
  server.registerTool(
    "add_task",
    {
      title: "Add task",
      description: "Create a new taskwarrior task.",
      inputSchema: addTaskShape,
    },
    async ({ description, ...options }) =>
      guard(() => tw.add(description, compact(options))),
  );

  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: "List tasks, optionally filtered by status, project, or tags.",
      inputSchema: listTasksShape,
    },
    async (filter) => guard(() => tw.list(compact(filter))),
  );

  server.registerTool(
    "modify_task",
    {
      title: "Modify task",
      description: "Modify an existing task identified by uuid.",
      inputSchema: modifyTaskShape,
    },
    async ({ uuid, ...options }) =>
      guard(() => tw.modify(uuid, compact(options))),
  );

  server.registerTool(
    "complete_task",
    {
      title: "Complete task",
      description: "Mark a task as done.",
      inputSchema: uuidShape,
    },
    async ({ uuid }) => guard(() => tw.done(uuid)),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description: "Delete a task.",
      inputSchema: uuidShape,
    },
    async ({ uuid }) => guard(() => tw.delete(uuid)),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description: "Fetch a single task by uuid.",
      inputSchema: uuidShape,
    },
    async ({ uuid }) => guard(() => tw.getByUuid(uuid)),
  );
}
