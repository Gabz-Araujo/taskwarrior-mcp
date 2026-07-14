import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Taskwarrior } from "../taskwarrior/index.js";
import { registerTools } from "./tools.js";

export function createServer(
  tw: Taskwarrior,
  options: { version?: string } = {},
): McpServer {
  const server = new McpServer({
    name: "taskwarrior-mcp",
    version: options.version ?? "0.0.0",
  });
  registerTools(server, tw);
  return server;
}
