import type { Task, AddOptions, ListFilter, ModifyOptions } from "./types.js";
import { TaskSchema } from "./types.js";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const execFile = promisify(execFileCallback);

const TaskArraySchema = z.array(TaskSchema);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TaskwarriorError extends Error {
  readonly exitCode: number | undefined;
  readonly stderr: string | undefined;

  constructor(
    message: string,
    options?: {
      exitCode?: number | undefined;
      stderr?: string | undefined;
      cause?: unknown;
    },
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "TaskwarriorError";
    this.exitCode = options?.exitCode;
    this.stderr = options?.stderr;
  }
}

export type TaskwarriorClientOptions = {
  path?: string;
  rcFile?: string;
  dataLocation?: string;
  timeoutMs?: number;
  overrides?: Record<string, string>;
};

export interface Taskwarrior {
  add(description: string, options?: AddOptions): Promise<Task>;

  list(filter?: ListFilter): Promise<Task[]>;

  modify(uuid: string, options: ModifyOptions): Promise<Task>;

  done(uuid: string): Promise<Task>;

  delete(uuid: string): Promise<Task>;

  getByUuid(uuid: string): Promise<Task | undefined>;
}

export class TaskwarriorClient implements Taskwarrior {
  private readonly path: string;
  private readonly rcFile: string | undefined;
  private readonly dataLocation: string | undefined;
  private readonly timeoutMs: number;
  private readonly userOverrides: Record<string, string>;

  private static readonly FORCED_OVERRIDES: Record<string, string> = {
    confirmation: "off",
    "recurrence.confirmation": "off",
    hooks: "off",
    "json.array": "on",
    verbose: "nothing",
  };

  private static readonly MAX_BUFFER = 32 * 1024 * 1024;

  constructor(options: TaskwarriorClientOptions = {}) {
    this.path = options.path ?? "task";
    this.rcFile = options.rcFile;
    this.dataLocation = options.dataLocation;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.userOverrides = options.overrides ?? {};
  }

  private buildRcArgs(perCallOverrides?: Record<string, string>): string[] {
    const overrides: Record<string, string> = { ...this.userOverrides };
    if (this.dataLocation) overrides["data.location"] = this.dataLocation;
    Object.assign(overrides, TaskwarriorClient.FORCED_OVERRIDES);
    if (perCallOverrides) Object.assign(overrides, perCallOverrides);

    const args: string[] = [];
    if (this.rcFile) args.push(`rc:${this.rcFile}`);
    for (const [key, value] of Object.entries(overrides)) {
      args.push(`rc.${key}:${value}`);
    }
    return args;
  }

  private assertUuid(uuid: string): void {
    if (!UUID_RE.test(uuid)) {
      throw new TaskwarriorError(`Invalid task uuid: ${JSON.stringify(uuid)}`);
    }
  }

  private async run(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFile(this.path, args, {
        timeout: this.timeoutMs,
        maxBuffer: TaskwarriorClient.MAX_BUFFER,
      });
      return stdout;
    } catch (error) {
      const e = error as {
        code?: number | string;
        stderr?: string;
        message?: string;
      };
      const stderr = typeof e.stderr === "string" ? e.stderr.trim() : undefined;
      const exitCode = typeof e.code === "number" ? e.code : undefined;
      throw new TaskwarriorError(
        `\`task ${args.join(" ")}\` failed: ${stderr || e.message || "unknown error"}`,
        { exitCode, stderr, cause: error },
      );
    }
  }

  private serializeAttributes(opts: {
    project?: string;
    due?: string;
    priority?: string;
  }): string[] {
    const args: string[] = [];
    if (opts.project) args.push(`project:${opts.project}`);
    if (opts.due) args.push(`due:${opts.due}`);
    if (opts.priority) args.push(`priority:${opts.priority}`);
    return args;
  }

  private async export(filterArgs: string[]): Promise<Task[]> {
    const output = await this.run([
      ...this.buildRcArgs(),
      ...filterArgs,
      "export",
    ]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch (error) {
      throw new TaskwarriorError(
        `task export returned invalid JSON: ${(error as Error).message}`,
        { cause: error },
      );
    }

    const result = TaskArraySchema.safeParse(parsed);
    if (!result.success) {
      throw new TaskwarriorError(
        `task export returned an unexpected shape: ${result.error.message}`,
        { cause: result.error },
      );
    }
    return result.data;
  }

  async add(description: string, options?: AddOptions): Promise<Task> {
    const args = [
      ...this.buildRcArgs({ verbose: "new-uuid" }),
      "add",
      ...this.serializeAttributes(options ?? {}),
      ...(options?.tags ?? []).map((tag) => `+${tag}`),
      "--",
      description,
    ];

    const output = await this.run(args);
    const match = output.match(/Created task ([0-9a-f-]{36})\./i);
    if (!match?.[1]) {
      throw new TaskwarriorError(
        `Unexpected output from "task add": ${JSON.stringify(output)}`,
      );
    }

    const task = await this.getByUuid(match[1]);
    if (!task) {
      throw new TaskwarriorError(
        `Added "${description}" (uuid ${match[1]}) but it could not be read back`,
      );
    }
    return task;
  }

  async list(filter?: ListFilter): Promise<Task[]> {
    const filterArgs: string[] = [];
    if (filter?.status) filterArgs.push(`status:${filter.status}`);
    if (filter?.project) filterArgs.push(`project:${filter.project}`);
    for (const tag of filter?.tags ?? []) filterArgs.push(`+${tag}`);

    return this.export(filterArgs);
  }

  async modify(uuid: string, options: ModifyOptions): Promise<Task> {
    this.assertUuid(uuid);

    const mods = this.serializeAttributes(options);
    for (const tag of options.addTags ?? []) mods.push(`+${tag}`);
    for (const tag of options.deleteTags ?? []) mods.push(`-${tag}`);

    if (mods.length === 0 && options.description === undefined) {
      throw new TaskwarriorError(`modify(${uuid}) called with no changes`);
    }

    const args = [...this.buildRcArgs(), uuid, "modify", ...mods];
    if (options.description !== undefined) args.push("--", options.description);

    await this.run(args);

    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(
        `Modified ${uuid} but it could not be read back`,
      );
    }
    return task;
  }

  async done(uuid: string): Promise<Task> {
    this.assertUuid(uuid);
    await this.run([...this.buildRcArgs(), uuid, "done"]);

    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(
        `Completed ${uuid} but it could not be read back`,
      );
    }
    return task;
  }

  async delete(uuid: string): Promise<Task> {
    this.assertUuid(uuid);
    await this.run([...this.buildRcArgs(), uuid, "delete"]);

    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(`Deleted ${uuid} but it could not be read back`);
    }
    return task;
  }

  async getByUuid(uuid: string): Promise<Task | undefined> {
    this.assertUuid(uuid);
    const [task] = await this.export([uuid]);
    return task;
  }
}
