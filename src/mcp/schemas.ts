import { z } from "zod";
import { TaskSchema } from "../taskwarrior/types.js";

const DATE_HINT =
  "taskwarrior date syntax - e.g. 'friday', 'tomorrow', '+1d', '+2w' or an ISO date";
const PRIORITY = "Priority: 'H' (high), 'M' (medium), or 'L' (low)";

export const addTaskShape = {
  description: z.string().min(1).describe("The task description text"),
  project: z
    .string()
    .optional()
    .describe("The project name, dotted for hierarchy, e.g. 'personal.work'"),
  due: z.string().optional().describe(`Due date. ${DATE_HINT}`),
  priority: z.enum(["H", "M", "L"]).optional().describe(PRIORITY),
  tags: z
    .array(z.string())
    .optional()
    .describe("Tags to attach, without the leading +"),
};

export const listTasksShape = {
  status: z
    .enum(["pending", "completed", "deleted", "waiting", "recurring"])
    .or(z.literal("all"))
    .optional()
    .describe(
      "Filter by status. Omit for pending only; 'all' returns every status.",
    ),
  project: z
    .string()
    .optional()
    .describe("The project name, dotted for hierarchy, e.g. 'personal.work'"),
  tags: z
    .array(z.string())
    .optional()
    .describe("Tags to filter by, without the leading +"),
  dueBefore: z
    .string()
    .optional()
    .describe(`Only tasks due before this. ${DATE_HINT}`),
  dueAfter: z
    .string()
    .optional()
    .describe(`Only tasks due after this. ${DATE_HINT}`),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of tasks to return (default 100)"),
  sort: z
    .enum(["urgency", "due", "entry"])
    .optional()
    .describe(
      "Sort order: 'urgency' (most urgent first), 'due' (soonest deadline first), or 'entry' (oldest first).",
    ),
};

export const whatsNextShape = {
  project: z
    .string()
    .optional()
    .describe("The project name, dotted for hierarchy, e.g. 'personal.work'"),
  tags: z
    .array(z.string())
    .optional()
    .describe("Tags to filter by, without the leading +"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of tasks to return (default 10)"),
};

export const modifyTaskShape = {
  uuid: z
    .string()
    .describe("The task uuid, as returned by list_tasks or get_task"),
  description: z.string().optional().describe("The task description text"),
  project: z
    .string()
    .optional()
    .describe("The project name, dotted for hierarchy, e.g. 'personal.work'"),
  due: z.string().optional().describe(`Due date. ${DATE_HINT}`),
  priority: z.enum(["H", "M", "L"]).optional().describe(PRIORITY),
  addTags: z
    .array(z.string())
    .optional()
    .describe("Tags to attach, without the leading +"),
  deleteTags: z
    .array(z.string())
    .optional()
    .describe("Tags to remove, without the leading +"),
};

export const annotateTaskShape = {
  uuid: z
    .string()
    .describe("The task uuid, as returned by list_tasks or get_task"),
  annotation: z.string().describe("The annotation text"),
};

export const denotateTaskShape = {
  uuid: z
    .string()
    .describe("The task uuid, as returned by list_tasks or get_task"),
  annotation: z.string().describe("The annotation text to be removed"),
};

export const taskOutputShape = { task: TaskSchema };
export const taskNullableOutputShape = { task: TaskSchema.nullable() };
export const taskListOutputShape = { tasks: z.array(TaskSchema) };

export const uuidShape = {
  uuid: z
    .string()
    .describe("The task uuid, as returned by list_tasks or get_task"),
};
