import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  BrokenTaskwarrior,
  FakeTaskwarrior,
} from "../testing/fake-taskwarrior.js";
import { createServer } from "./index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { expect, test, vi } from "vitest";
import type { Taskwarrior } from "../taskwarrior/index.js";

function sc(res: any): any {
  return res.structuredContent;
}

function text(res: any): string {
  return res.content[0].text;
}

async function connect(tw: Taskwarrior = new FakeTaskwarrior()) {
  const server = createServer(tw);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client };
}

test("advertise all tools", async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name).sort()).toEqual([
    "add_task",
    "annotate_task",
    "complete_task",
    "delete_task",
    "denotate_task",
    "get_task",
    "list_tasks",
    "modify_task",
    "start_task",
    "stop_task",
    "whats_next",
  ]);
});

test("add_task", async () => {
  const { client } = await connect();
  const res = await client.callTool({
    name: "add_task",
    arguments: {
      description: "test",
      due: "2023-01-01",
    },
  });

  expect(res.isError ?? false).toBe(false);
  expect(sc(res).task.description).toBe("test");
  expect(sc(res).task.due).toBe("2023-01-01");
});

test("get_task", async () => {
  const { client } = await connect();

  const res = await client.callTool({
    name: "get_task",
    arguments: {
      uuid: "99999999-9999-9999-9999-999999999999",
    },
  });

  expect(res.isError).toBeFalsy();
  expect(sc(res)).toStrictEqual({
    task: null,
  });
});

test("whats_next", async () => {
  const { client } = await connect();

  await client.callTool({
    name: "add_task",
    arguments: {
      description: "test task 1",
      project: "test",
      due: "2023-01-01",
    },
  });

  await client.callTool({
    name: "add_task",
    arguments: {
      description: "test task 2",
      project: "test",
      due: "2023-01-01",
    },
  });

  await client.callTool({
    name: "add_task",
    arguments: {
      description: "test task 3",
      project: "test",
      due: "2023-01-01",
    },
  });

  const res = await client.callTool({
    name: "whats_next",
    arguments: {
      limit: 10,
    },
  });

  expect(res.isError).toBeFalsy();
  expect(sc(res).tasks.length).toBe(3);
  expect(sc(res).tasks[0].description).toBe("test task 3");
});

test("modify_task", async () => {
  const { client } = await connect();

  const res = await client.callTool({
    name: "modify_task",
    arguments: {
      uuid: "99999999-9999-9999-9999-999999999999",
      description: "test task",
    },
  });

  expect(res.isError).toBeTruthy();
  expect(text(res)).toContain(
    "No task matches uuid 99999999-9999-9999-9999-999999999999",
  );
  expect(text(res)).toContain(
    "Call list_tasks or get_task to find valid uuids",
  );
});

test("annotate_task", async () => {
  const { client } = await connect();
  const task = await client.callTool({
    name: "add_task",
    arguments: {
      description: "test",
    },
  });

  const res = await client.callTool({
    name: "annotate_task",
    arguments: {
      uuid: sc(task).task.uuid,
      annotation: "test annotation",
    },
  });

  expect(res.isError).toBeFalsy();
  expect(sc(res).task.annotations?.[0].description).toBe("test annotation");
});

test("start_task", async () => {
  const { client } = await connect();
  const task = await client.callTool({
    name: "add_task",
    arguments: {
      description: "test",
    },
  });

  const res = await client.callTool({
    name: "start_task",
    arguments: {
      uuid: sc(task).task.uuid,
    },
  });

  expect(res.isError).toBeFalsy();
  expect(sc(res).task.status).toBe("pending");
});

test("an unexpected error is contained as generic isError and logged to stderr", async () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const { client } = await connect(new BrokenTaskwarrior());

  const res = await client.callTool({
    name: "get_task",
    arguments: { uuid: "99999999-9999-9999-9999-999999999999" },
  });

  expect(res.isError).toBeTruthy();
  expect(text(res)).toContain("An unexpected internal error occurred");
  expect(text(res)).not.toContain("Boom");
  expect(errorSpy).toHaveBeenCalled();

  errorSpy.mockRestore();
});
