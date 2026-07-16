#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TaskwarriorClient } from "./taskwarrior/index.js";
import type { TaskwarriorClientOptions } from "./taskwarrior/index.js";
import { createServer } from "./mcp/index.js";
import { TimewarriorClient } from "./timewarrior/client.js";
import type { Timewarrior } from "./timewarrior/client.js";
import { readFileSync } from "fs";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

async function detectTimewarrior(): Promise<Timewarrior | undefined> {
  const path = process.env["TIMEWARRIOR_PATH"] ?? "timew";
  try {
    await execFile(path, ["--version"]);
    return new TimewarriorClient({ path });
  } catch {
    return undefined;
  }
}

const options: TaskwarriorClientOptions = {};
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };
if (process.env["TASKWARRIOR_PATH"])
  options.path = process.env["TASKWARRIOR_PATH"];
if (process.env["TASKRC"]) options.rcFile = process.env["TASKRC"];
if (process.env["TASKDATA"]) options.dataLocation = process.env["TASKDATA"];

const tw = new TaskwarriorClient(options);
const timewarrior = await detectTimewarrior();
const server = await createServer(tw, {
  version,
  ...(timewarrior ? { timewarrior } : {}),
});

await server.connect(new StdioServerTransport());
