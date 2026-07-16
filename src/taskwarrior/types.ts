import { z } from "zod";

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Priority = "H" | "M" | "L";
export type Status =
  | "pending"
  | "completed"
  | "deleted"
  | "waiting"
  | "recurring";

export const TaskSchema = z.object({
  uuid: z.string(),
  id: z.number().optional(),
  description: z.string(),
  status: z.enum(["pending", "completed", "deleted", "waiting", "recurring"]),
  project: z.string().optional(),
  due: z.string().optional(),
  priority: z.enum(["H", "M", "L"]).optional(),
  tags: z.array(z.string()).optional(),
  entry: z.string(),
  start: z.string().optional(),
  end: z.string().optional(),
  recur: z.string().optional(),
  until: z.string().optional(),
  urgency: z.number().optional(),
  modified: z.string().optional(),
  annotations: z
    .array(z.object({ entry: z.string(), description: z.string() }))
    .optional(),
  depends: z.array(z.string()).optional(),
  udas: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export type AddOptions = {
  project?: string;
  due?: string;
  priority?: Priority;
  tags?: string[];
  recur?: string;
  udas?: Record<string, string | number>;
};

export type ListFilter = {
  status?: Status | "all";
  project?: string;
  tags?: string[];
  dueBefore?: string;
  dueAfter?: string;
  endAfter?: string;
  ready?: boolean;
  udas?: Record<string, string>;
};

export type ListSort = "urgency" | "due" | "entry";

export type ListOptions = {
  limit?: number;
  sort?: ListSort;
};

export type ModifyOptions = {
  description?: string;
  project?: string;
  due?: string;
  priority?: Priority;
  addTags?: string[];
  deleteTags?: string[];
  addDependencies?: string[];
  deleteDependencies?: string[];
  udas?: Record<string, string | number>;
};
