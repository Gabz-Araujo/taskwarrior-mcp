import type { ListFilter, ListSort, Task } from "./types.js";

export function buildListFilterArgs(filter?: ListFilter): string[] {
  const args: string[] = [];

  const status =
    filter?.status === "all" ? "" : `status:${filter?.status ?? "pending"}`;

  if (status) {
    args.push(status);
  }

  if (filter?.project) {
    const project = `project:${filter?.project}`;
    args.push(project);
  }

  if (filter?.tags) {
    for (const tag of filter.tags) {
      const tagArg = `+${tag}`;
      args.push(tagArg);
    }
  }

  if (filter?.dueBefore) {
    const dueBefore = `due.before:${filter.dueBefore}`;
    args.push(dueBefore);
  }

  if (filter?.dueAfter) {
    const dueAfter = `due.after:${filter.dueAfter}`;
    args.push(dueAfter);
  }

  if (filter?.udas) {
    for (const [name, value] of Object.entries(filter.udas)) {
      args.push(`${name}:${value}`);
    }
  }

  return args;
}

export function sortTasks(tasks: Task[], sort?: ListSort): Task[] {
  if (!sort) {
    return tasks;
  }

  if (sort === "urgency") {
    return [...tasks].sort((a, b) => (b.urgency ?? 0) - (a.urgency ?? 0));
  }

  if (sort === "due") {
    return [...tasks].sort((a, b) => {
      if (a.due === undefined && b.due === undefined) {
        return 0;
      }
      if (a.due === undefined) {
        return 1;
      }
      if (b.due === undefined) {
        return -1;
      }
      return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
    });
  }

  if (sort === "entry") {
    return [...tasks].sort((a, b) => a.entry.localeCompare(b.entry));
  }

  const _exhaustive: never = sort;
  return _exhaustive;
}
