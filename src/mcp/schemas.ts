import { z } from "zod";
import { TaskSchema, UUID_RE } from "../taskwarrior/types.js";

const DATE_HINT =
  "taskwarrior date syntax - e.g. 'friday', 'tomorrow', '+1d', '+2w' or an ISO date";
const PRIORITY = "Priority: 'H' (high), 'M' (medium), or 'L' (low)";
const uuidField = z.string().regex(UUID_RE, "Must be a valid task uuid");

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
  recur: z
    .string()
    .optional()
    .describe(
      "Make the task recur, e.g. 'daily', 'weekly', 'monthly', or ISO 'P1W'. Requires 'due'.",
    ),
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
  uuid: uuidField.describe(
    "The task uuid, as returned by list_tasks or get_task",
  ),
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
  uuid: uuidField.describe(
    "The task uuid, as returned by list_tasks or get_task",
  ),
  annotation: z.string().describe("The annotation text"),
};

export const denotateTaskShape = {
  uuid: uuidField.describe(
    "The task uuid, as returned by list_tasks or get_task",
  ),
  annotation: z.string().describe("The annotation text to be removed"),
};

export const addDependenciesShape = {
  uuid: uuidField.describe("The task that will depend on the others"),
  dependencies: z
    .array(uuidField)
    .min(1)
    .describe("Uuids of tasks this task should depend on"),
};

export const removeDependenciesShape = {
  uuid: uuidField.describe("The task to remove dependencies from"),
  dependencies: z
    .array(uuidField)
    .min(1)
    .describe("Uuids of dependencies to remove"),
};

export const taskOutputShape = { task: TaskSchema };
export const taskNullableOutputShape = { task: TaskSchema.nullable() };
export const taskListOutputShape = { tasks: z.array(TaskSchema) };

export const uuidShape = {
  uuid: uuidField.describe(
    "The task uuid, as returned by list_tasks or get_task",
  ),
};

export const timeSummaryShape = {
  from: z.string().describe("The start of the summary interval"),
  to: z.string().describe("The end of the summary interval"),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      "Only time tagged with all of these (a task project name works too — the hook tags intervals with it).",
    ),
};

export const timeSummaryOutputShape = {
  total: z.number(),
  byTag: z.record(z.string(), z.number()),
};
