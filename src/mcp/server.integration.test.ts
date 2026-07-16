import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { Task } from "../taskwarrior/types.js";

function sc(res: any): any {
  return res.structuredContent;
}

function text(res: any): string {
  return res.content[0].text;
}

let dataLocation: string;
let client: Client;

beforeAll(async () => {
  dataLocation = mkdtempSync(join(tmpdir(), "tw-e2e-"));
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    env: {
      PATH: process.env.PATH ?? "",
      TASKDATA: dataLocation,
      TASKRC: process.env.TASKRC ?? "",
    },
  });
  client = new Client({
    name: "e2e",
    version: "0.0.1",
  });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
  rmSync(dataLocation, { recursive: true, force: true });
});

test("whats_next uses real urgency", async () => {
  const priorities = ["H", "M", "L"];

  for (const priority of priorities) {
    await client.callTool({
      name: "add_task",
      arguments: {
        description: `Priority ${priority}`,
        priority,
      },
    });
  }

  const res = await client.callTool({
    name: "whats_next",
    arguments: {},
  });

  expect(sc(res).tasks.map((t: Task) => t.description)).toEqual([
    "Priority H",
    "Priority M",
    "Priority L",
  ]);
});

test("delete_task returns soft-deleted task", async () => {
  const task = await client.callTool({
    name: "add_task",
    arguments: {
      description: "Soft-deleted task",
      priority: "M",
    },
  });

  const res = await client.callTool({
    name: "delete_task",
    arguments: {
      uuid: sc(task).task.uuid,
    },
  });

  expect(sc(res).task).toEqual(
    expect.objectContaining({
      uuid: sc(task).task.uuid,
      status: "deleted",
    }),
  );
});

test("get_task rejects an invalid uuid at the schema boundary", async () => {
  const res = await client.callTool({
    name: "get_task",
    arguments: {
      uuid: "status:pending",
    },
  });

  expect(res.isError).toBeTruthy();
  expect(text(res)).toMatch(/valid task uuid/i);
});
