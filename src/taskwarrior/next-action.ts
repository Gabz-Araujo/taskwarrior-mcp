import type { Taskwarrior } from "./index.js";
import type { Task } from "./types.js";

export type NextActionOptions = {
  project?: string;
  tags?: string[];
  udas?: Record<string, string>;
};

export type NextActionResult = {
  action: Task | null;
  why: { urgency: number; overdue: boolean; unblocks: number } | null;
};

function nowBasicIso(): string {
  return new Date(Date.now())
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

export async function nextAction(
  tw: Taskwarrior,
  opts: NextActionOptions,
): Promise<NextActionResult> {
  const ready = await tw.list(
    {
      ready: true,
      ...(opts.project ? { project: opts.project } : {}),
      ...(opts.tags ? { tags: opts.tags } : {}),
      ...(opts.udas ? { udas: opts.udas } : {}),
    },
    { sort: "urgency" },
  );

  const action = ready[0] ?? null;
  if (!action) return { action: null, why: null };

  const pending = await tw.list({ status: "pending" });
  const unblocks = pending.filter((task) =>
    (task.depends ?? []).includes(action.uuid),
  ).length;
  const overdue = action.due !== undefined && action.due < nowBasicIso();

  return { action, why: { urgency: action.urgency ?? 0, overdue, unblocks } };
}
