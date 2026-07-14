import { z } from "zod";

export const addTaskShape = {
  description: z.string().min(1),
  project: z.string().optional(),
  due: z.string().optional(),
  priority: z.enum(["H", "M", "L"]).optional(),
  tags: z.array(z.string()).optional(),
};

export const listTasksShape = {
  status: z
    .enum(["pending", "completed", "deleted", "waiting", "recurring"])
    .optional(),
  project: z.string().optional(),
  tags: z.array(z.string()).optional(),
};

export const modifyTaskShape = {
  uuid: z.string(),
  description: z.string().optional(),
  project: z.string().optional(),
  due: z.string().optional(),
  priority: z.enum(["H", "M", "L"]).optional(),
  addTags: z.array(z.string()).optional(),
  deleteTags: z.array(z.string()).optional(),
};

export const uuidShape = {
  uuid: z.string(),
};
