import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Taskwarrior } from "../taskwarrior/index.js";
import { registerTools, registerTimeTools } from "./tools.js";
import type { Timewarrior } from "../timewarrior/client.js";
import { registerPrompts } from "./prompts.js";
import { registerResources } from "./resources.js";
import type { UdaDef } from "../taskwarrior/udas.js";

export async function createServer(
  tw: Taskwarrior,
  options: {
    version?: string;
    timewarrior?: Timewarrior;
    udas?: UdaDef[];
  } = {},
): Promise<McpServer> {
  const udas = options.udas ?? (await tw.discoverUdas());
  const server = new McpServer({
    name: "taskwarrior-mcp",
    version: options.version ?? "0.0.0",
  });
  registerTools(server, tw, udas);
  registerPrompts(server, tw);
  registerResources(server, tw, udas);
  if (options.timewarrior) {
    registerTimeTools(server, options.timewarrior);
  }
  return server;
}
