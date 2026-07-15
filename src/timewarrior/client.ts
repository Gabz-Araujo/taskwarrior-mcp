import { promisify } from "node:util";
import { execFile as execFileCallback } from "node:child_process";
import {
  RawIntervalArraySchema,
  type TimeInterval,
  type TimeSummary,
  type TimeFilter,
} from "./types.js";
import { parseTimewTimestamp, summarizeIntervals } from "./utils.js";

const execFile = promisify(execFileCallback);

type ErrorKind = "not-found" | "invalid-input" | "execution" | "unknown";

export class TimewarriorError extends Error {
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
    this.name = "TimewarriorError";
    this.exitCode = options?.exitCode;
    this.stderr = options?.stderr;
    this.kind = options?.kind ?? "unknown";
  }
}

export type TimewarriorClientOptions = {
  path?: string;
  dataLocation?: string;
  timeoutMs?: number;
};

export interface Timewarrior {
  getIntervals(filter?: TimeFilter): Promise<TimeInterval[]>;

  getSummary(filter?: TimeFilter): Promise<TimeSummary>;
}

export class TimewarriorClient implements Timewarrior {
  private readonly path: string;
  private readonly dataLocation: string | undefined;
  private readonly timeoutMs: number;

  constructor(options: TimewarriorClientOptions = {}) {
    this.path = options.path ?? "timew";
    this.dataLocation = options.dataLocation;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  private async run(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFile(this.path, args, {
        timeout: this.timeoutMs,
        maxBuffer: 32 * 1024 * 1024,
        env: this.dataLocation
          ? { ...process.env, TIMEWARRIORDB: this.dataLocation }
          : process.env,
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
      throw new TimewarriorError(
        `\`timew ${args.join(" ")}\` failed: ${stderr || e.message || "unknown error"}`,
        { exitCode, stderr, cause: error, kind: "execution" },
      );
    }
  }

  private buildFilterArgs(filter?: TimeFilter): string[] {
    const args: string[] = [];
    if (filter?.from) args.push("from", filter.from);
    if (filter?.to) args.push("to", filter.to);
    for (const tag of filter?.tags ?? []) args.push(tag);
    return args;
  }

  async getIntervals(filter?: TimeFilter): Promise<TimeInterval[]> {
    const output = await this.run(["export", ...this.buildFilterArgs(filter)]);

    let parsed: unknown;
    try {
      parsed = JSON.parse(output);
    } catch (error) {
      throw new TimewarriorError(
        `timew export returned invalid JSON: ${(error as Error).message}`,
        { cause: error, kind: "invalid-input" },
      );
    }

    const result = RawIntervalArraySchema.safeParse(parsed);
    if (!result.success) {
      throw new TimewarriorError(
        `timew export returned an unexpected shape: ${result.error.message}`,
        { cause: result.error, kind: "invalid-input" },
      );
    }

    return result.data.map((raw) => ({
      id: String(raw.id),
      start: parseTimewTimestamp(raw.start),
      ...(raw.end !== undefined ? { end: parseTimewTimestamp(raw.end) } : {}),
      ...(raw.tags !== undefined ? { tags: raw.tags } : {}),
    }));
  }

  async getSummary(filter?: TimeFilter): Promise<TimeSummary> {
    const intervals = await this.getIntervals(filter);
    return summarizeIntervals(intervals, Date.now() / 1000);
  }
}
