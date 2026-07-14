import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Taskwarrior } from "../taskwarrior/index.js";
import { registerTools } from "./tools.js";

export function createServer(tw: Taskwarrior): McpServer {
  const server = new McpServer({
    name: "taskwarrior-mcp",
    version: "1.0.0",
  });
  registerTools(server, tw);
  return server;
}
