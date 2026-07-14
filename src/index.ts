#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TaskwarriorClient } from "./taskwarrior/index.js";
import type { TaskwarriorClientOptions } from "./taskwarrior/index.js";
import { createServer } from "./mcp/index.js";

const options: TaskwarriorClientOptions = {};
if (process.env["TASKWARRIOR_PATH"]) options.path = process.env["TASKWARRIOR_PATH"];
if (process.env["TASKRC"]) options.rcFile = process.env["TASKRC"];
if (process.env["TASKDATA"]) options.dataLocation = process.env["TASKDATA"];

const tw = new TaskwarriorClient(options);
const server = createServer(tw);

await server.connect(new StdioServerTransport());
