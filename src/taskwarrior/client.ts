import type {
  Task,
  AddOptions,
  ListFilter,
  ModifyOptions,
  ListOptions,
} from "./types.js";
import { TaskSchema, UUID_RE } from "./types.js";
import type { UdaDef, UdaType } from "./udas.js";
import { assertKnownUdaNames, serializeUdas } from "./udas.js";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import { buildListFilterArgs, sortTasks } from "./query.js";

const execFile = promisify(execFileCallback);

const TaskArraySchema = z.array(TaskSchema);

type ErrorKind = "not-found" | "invalid-input" | "execution" | "unknown";

export class TaskwarriorError extends Error {
  readonly exitCode: number | undefined;
  readonly stderr: string | undefined;
  readonly kind: ErrorKind;

  constructor(
    message: string,
    options?: {
      exitCode?: number | undefined;
      stderr?: string | undefined;
      cause?: unknown;
      kind?: ErrorKind;
    },
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.name = "TaskwarriorError";
    this.exitCode = options?.exitCode;
    this.stderr = options?.stderr;
    this.kind = options?.kind ?? "unknown";
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

  list(filter?: ListFilter, options?: ListOptions): Promise<Task[]>;

  modify(uuid: string, options: ModifyOptions): Promise<Task>;

  done(uuid: string): Promise<Task>;

  delete(uuid: string): Promise<Task>;

  getByUuid(uuid: string): Promise<Task | undefined>;

  annotate(uuid: string, annotation: string): Promise<Task>;

  denotate(uuid: string, annotation: string): Promise<Task>;

  start(uuid: string): Promise<Task>;

  stop(uuid: string): Promise<Task>;

  addDependencies(uuid: string, dependencies: string[]): Promise<Task>;

  removeDependencies(uuid: string, dependencies: string[]): Promise<Task>;

  discoverUdas(): Promise<UdaDef[]>;
}

export class TaskwarriorClient implements Taskwarrior {
  private readonly path: string;
  private readonly rcFile: string | undefined;
  private readonly dataLocation: string | undefined;
  private readonly timeoutMs: number;
  private readonly userOverrides: Record<string, string>;
  private udaRegistry: UdaDef[] | undefined;

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
      throw new TaskwarriorError(`Invalid task uuid: ${JSON.stringify(uuid)}`, {
        kind: "invalid-input",
      });
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
        { exitCode, stderr, cause: error, kind: "execution" },
      );
    }
  }

  private serializeAttributes(opts: {
    project?: string;
    due?: string;
    priority?: string;
    recur?: string;
    addDependencies?: string[];
    deleteDependencies?: string[];
  }): string[] {
    const args: string[] = [];
    if (opts.project) args.push(`project:${opts.project}`);
    if (opts.due) args.push(`due:${opts.due}`);
    if (opts.priority) args.push(`priority:${opts.priority}`);
    if (opts.recur) args.push(`recur:${opts.recur}`);
    if (opts.addDependencies?.length)
      args.push(`depends:${opts.addDependencies.join(",")}`);
    if (opts.deleteDependencies?.length)
      args.push(
        `depends:${opts.deleteDependencies.map((d) => `-${d}`).join(",")}`,
      );
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
        { cause: error, kind: "invalid-input" },
      );
    }

    const registry = await this.ensureUdas();
    const known = new Set(registry.map((uda) => uda.name));
    if (Array.isArray(parsed) && known.size > 0) {
      for (const raw of parsed) {
        if (!raw || typeof raw !== "object") continue;
        const record = raw as Record<string, unknown>;
        const udas: Record<string, string | number> = {};
        for (const name of known) {
          const value = record[name];
          if (typeof value === "string" || typeof value === "number") {
            udas[name] = value;
          }
        }
        if (Object.keys(udas).length > 0) record.udas = udas;
      }
    }

    const result = TaskArraySchema.safeParse(parsed);
    if (!result.success) {
      throw new TaskwarriorError(
        `task export returned an unexpected shape: ${result.error.message}`,
        { cause: result.error, kind: "invalid-input" },
      );
    }
    return result.data;
  }

  async add(description: string, options?: AddOptions): Promise<Task> {
    if (options?.recur && !options.due) {
      throw new TaskwarriorError("A recurring task needs a due date", {
        kind: "invalid-input",
      });
    }

    const registry = await this.ensureUdas();
    const args = [
      ...this.buildRcArgs({ verbose: "new-uuid" }),
      "add",
      ...this.serializeAttributes(options ?? {}),
      ...serializeUdas(options?.udas, registry),
      ...(options?.tags ?? []).map((tag) => `+${tag}`),
      "--",
      description,
    ];

    const output = await this.run(args);
    const match = output.match(/Created task ([0-9a-f-]{36})/i);
    if (!match?.[1]) {
      throw new TaskwarriorError(
        `Unexpected output from "task add": ${JSON.stringify(output)}`,
        { kind: "execution" },
      );
    }

    const task = await this.getByUuid(match[1]);
    if (!task) {
      throw new TaskwarriorError(
        `Added "${description}" (uuid ${match[1]}) but it could not be read back`,
        { kind: "execution" },
      );
    }
    return task;
  }

  async list(filter?: ListFilter, options?: ListOptions): Promise<Task[]> {
    if (filter?.udas) {
      assertKnownUdaNames(Object.keys(filter.udas), await this.ensureUdas());
    }
    const filterArgs = buildListFilterArgs(filter);
    const tasks = await this.export(filterArgs);
    const sorted = sortTasks(tasks, options?.sort);
    return options?.limit !== undefined
      ? sorted.slice(0, options.limit)
      : sorted;
  }

  async modify(uuid: string, options: ModifyOptions): Promise<Task> {
    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }

    const registry = await this.ensureUdas();
    const mods = this.serializeAttributes(options);
    mods.push(...serializeUdas(options.udas, registry));
    for (const tag of options.addTags ?? []) mods.push(`+${tag}`);
    for (const tag of options.deleteTags ?? []) mods.push(`-${tag}`);

    if (mods.length === 0 && options.description === undefined) {
      throw new TaskwarriorError(`modify(${uuid}) called with no changes`, {
        kind: "invalid-input",
      });
    }

    const args = [...this.buildRcArgs(), uuid, "modify", ...mods];
    if (options.description !== undefined) args.push("--", options.description);

    await this.run(args);

    const modifiedTask = await this.getByUuid(uuid);
    if (!modifiedTask) {
      throw new TaskwarriorError(
        `Modified ${uuid} but it could not be read back`,
      );
    }

    return modifiedTask;
  }

  async done(uuid: string): Promise<Task> {
    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    await this.run([...this.buildRcArgs({ hooks: "on" }), uuid, "done"]);

    const completedTask = await this.getByUuid(uuid);
    if (!completedTask) {
      throw new TaskwarriorError(
        `Completed ${uuid} but it could not be read back`,
      );
    }

    return completedTask;
  }

  async delete(uuid: string): Promise<Task> {
    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    await this.run([...this.buildRcArgs(), uuid, "delete"]);

    const deletedTask = await this.getByUuid(uuid);
    if (!deletedTask) {
      throw new TaskwarriorError(
        `Deleted ${uuid} but it could not be read back`,
        { kind: "execution" },
      );
    }

    return deletedTask;
  }

  async getByUuid(uuid: string): Promise<Task | undefined> {
    this.assertUuid(uuid);
    const [task] = await this.export([uuid]);
    return task;
  }

  async annotate(uuid: string, annotation: string): Promise<Task> {
    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    await this.run([...this.buildRcArgs(), uuid, "annotate", "--", annotation]);
    const annotatedTask = await this.getByUuid(uuid);
    if (!annotatedTask) {
      throw new TaskwarriorError(
        `Annotated ${uuid} but it could not be read back`,
      );
    }
    return annotatedTask;
  }

  async denotate(uuid: string, annotation: string): Promise<Task> {
    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    await this.run([...this.buildRcArgs(), uuid, "denotate", "--", annotation]);
    const denotatedTask = await this.getByUuid(uuid);
    if (!denotatedTask) {
      throw new TaskwarriorError(
        `Denotated ${uuid} but it could not be read back`,
      );
    }
    return denotatedTask;
  }

  async start(uuid: string): Promise<Task> {
    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    await this.run([...this.buildRcArgs({ hooks: "on" }), uuid, "start"]);
    const startedTask = await this.getByUuid(uuid);
    if (!startedTask) {
      throw new TaskwarriorError(
        `Started ${uuid} but it could not be read back`,
      );
    }
    return startedTask;
  }

  async stop(uuid: string): Promise<Task> {
    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }
    await this.run([...this.buildRcArgs({ hooks: "on" }), uuid, "stop"]);
    const stoppedTask = await this.getByUuid(uuid);
    if (!stoppedTask) {
      throw new TaskwarriorError(
        `Stopped ${uuid} but it could not be read back`,
      );
    }
    return stoppedTask;
  }

  async addDependencies(uuid: string, dependencies: string[]): Promise<Task> {
    const verified = dependencies.map((dependency) => {
      this.assertUuid(dependency);
      return dependency;
    });

    try {
      return await this.modify(uuid, { addDependencies: verified });
    } catch (error) {
      if (
        error instanceof TaskwarriorError &&
        /circular dependency/i.test(error.message)
      ) {
        throw new TaskwarriorError(
          `Adding these dependencies to ${uuid} would create a circular dependency`,
          { kind: "invalid-input", cause: error },
        );
      }
      throw error;
    }
  }

  async removeDependencies(
    uuid: string,
    dependencies: string[],
  ): Promise<Task> {
    const task = await this.getByUuid(uuid);
    if (!task) {
      throw new TaskwarriorError(`No task matches uuid ${uuid}`, {
        kind: "not-found",
      });
    }

    const verified = dependencies
      .map((dependency) => {
        this.assertUuid(dependency);
        return dependency;
      })
      .filter((dependency) => task.depends?.includes(dependency));

    if (verified.length === 0) return task;

    return this.modify(uuid, { deleteDependencies: verified });
  }

  async discoverUdas(): Promise<UdaDef[]> {
    return this.ensureUdas();
  }

  private async ensureUdas(): Promise<UdaDef[]> {
    if (this.udaRegistry) return this.udaRegistry;
    try {
      const namesOut = await this.run([...this.buildRcArgs(), "_udas"]);
      const names = namesOut
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean);

      const defs: UdaDef[] = [];
      for (const name of names) {
        const type = await this.getConfig(`uda.${name}.type`);
        const def: UdaDef = { name, type: (type || "string") as UdaType };
        const label = await this.getConfig(`uda.${name}.label`);
        if (label) def.label = label;
        const values = await this.getConfig(`uda.${name}.values`);
        if (values)
          def.values = values
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        const fallback = await this.getConfig(`uda.${name}.default`);
        if (fallback) def.default = fallback;
        defs.push(def);
      }
      this.udaRegistry = defs;
    } catch (error) {
      console.error(
        "UDA discovery failed; continuing with no custom fields:",
        error,
      );
      this.udaRegistry = [];
    }
    return this.udaRegistry;
  }

  private async getConfig(key: string): Promise<string> {
    try {
      const out = await this.run([...this.buildRcArgs(), "_get", `rc.${key}`]);
      return out.trim();
    } catch {
      return "";
    }
  }
}
