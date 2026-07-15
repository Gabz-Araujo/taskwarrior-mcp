import type {
  Taskwarrior,
  Task,
  AddOptions,
  ListFilter,
  ListOptions,
  ModifyOptions,
} from "../taskwarrior/index.js";
import { TaskwarriorError } from "../taskwarrior/index.js";
import { sortTasks } from "../taskwarrior/query.js";

export class FakeTaskwarrior implements Taskwarrior {
  private tasks = new Map<string, Task>();
  private counter = 0;

  async add(description: string, options?: AddOptions): Promise<Task> {
    this.counter++;
    const uuid = `00000000-0000-0000-0000-${String(this.counter).padStart(12, "0")}`;
    const task: Task = {
      uuid,
      description,
      status: "pending",
      entry: `2026-01-01T00:00:${String(this.counter).padStart(2, "0")}Z`,
      urgency: this.counter,
      ...(options?.project ? { project: options.project } : {}),
      ...(options?.due ? { due: options.due } : {}),
      ...(options?.priority ? { priority: options.priority } : {}),
      ...(options?.tags ? { tags: options.tags } : {}),
    };

    this.tasks.set(uuid, task);
    return task;
  }

  async list(filter?: ListFilter, options?: ListOptions): Promise<Task[]> {
    const status = filter?.status ?? "pending";
    const tasks = Array.from(this.tasks.values()).filter((task) => {
      if (status !== "all" && task.status !== status) return false;
      if (filter?.project && task.project !== filter.project) return false;
      if (filter?.tags && !filter.tags.every((tag) => task.tags?.includes(tag)))
        return false;
      return true;
    });
    const sorted = sortTasks(tasks, options?.sort);
    return options?.limit !== undefined
      ? sorted.slice(0, options.limit)
      : sorted;
  }

  async modify(uuid: string, options: ModifyOptions): Promise<Task> {
    const task = this.tasks.get(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }

    const modifiedTask: Task = {
      ...task,
      ...(options.description !== undefined
        ? { description: options.description }
        : {}),
      ...(options.project !== undefined ? { project: options.project } : {}),
      ...(options.due !== undefined ? { due: options.due } : {}),
      ...(options.priority !== undefined ? { priority: options.priority } : {}),
    };

    if (options.addTags || options.deleteTags) {
      const tags = new Set(modifiedTask.tags ?? []);
      if (options.addTags) for (const tag of options.addTags) tags.add(tag);
      if (options.deleteTags)
        for (const tag of options.deleteTags) tags.delete(tag);
      modifiedTask.tags = Array.from(tags);
    }

    this.tasks.set(uuid, modifiedTask);

    return modifiedTask;
  }

  async done(uuid: string): Promise<Task> {
    const task = this.tasks.get(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    task.status = "completed";
    return task;
  }

  async delete(uuid: string): Promise<Task> {
    const task = this.tasks.get(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    task.status = "deleted";
    return task;
  }

  async getByUuid(uuid: string): Promise<Task | undefined> {
    return this.tasks.get(uuid);
  }

  async annotate(uuid: string, annotation: string): Promise<Task> {
    const task = this.tasks.get(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    task.annotations ??= [];
    task.annotations.push({
      entry: new Date().toISOString(),
      description: annotation,
    });
    return task;
  }

  async denotate(uuid: string, annotation: string): Promise<Task> {
    const task = this.tasks.get(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    task.annotations = task.annotations?.filter(
      (a) => a.description !== annotation,
    );
    return task;
  }

  async start(uuid: string): Promise<Task> {
    const task = this.tasks.get(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    task.start = new Date().toISOString();
    return task;
  }

  async stop(uuid: string): Promise<Task> {
    const task = this.tasks.get(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    delete task.start;
    return task;
  }
}

export class BrokenTaskwarrior extends FakeTaskwarrior {
  override async getByUuid(): Promise<Task | undefined> {
    throw new Error("Boom");
  }
}
