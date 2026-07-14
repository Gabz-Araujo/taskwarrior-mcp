import { z } from "zod";

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
});

export type Task = z.infer<typeof TaskSchema>;

export type AddOptions = {
  project?: string;
  due?: string;
  priority?: Priority;
  tags?: string[];
};

export type ListFilter = {
  status?: Status;
  project?: string;
  tags?: string[];
};

export type ModifyOptions = {
  description?: string;
  project?: string;
  due?: string;
  priority?: Priority;
  addTags?: string[];
  deleteTags?: string[];
};
