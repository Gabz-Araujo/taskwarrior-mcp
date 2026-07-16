import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  BrokenTaskwarrior,
  FakeTaskwarrior,
} from "../testing/fake-taskwarrior.js";
import { createServer } from "./index.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { expect, test, vi } from "vitest";
import type { Taskwarrior } from "../taskwarrior/index.js";
import type { Timewarrior } from "../timewarrior/client.js";
import { FakeTimewarrior } from "../testing/fake-timewarrior.js";
import type { UdaDef } from "../taskwarrior/udas.js";

const UDAS: UdaDef[] = [
  { name: "context", type: "string", values: ["work", "home"] },
];

function sc(res: any): any {
  return res.structuredContent;
}

function text(res: any): string {
  return res.content[0].text;
}

async function connect(
  tw: Taskwarrior = new FakeTaskwarrior(),
  timewarrior?: Timewarrior,
) {
  const server = await createServer(tw, timewarrior ? { timewarrior } : {});
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
    "add_dependencies",
    "add_task",
    "annotate_task",
    "complete_task",
    "create_project",
    "delete_task",
    "denotate_task",
    "get_task",
    "list_tasks",
    "modify_task",
    "next_action",
    "remove_dependencies",
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

test("get_time_summary is absent when no timewarrior is configured", async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name)).not.toContain("get_time_summary");
});

test("get_time_summary is present and works when timewarrior is configured", async () => {
  const fakeTimew = new FakeTimewarrior([
    { id: "1", start: 0, end: 3600, tags: ["coding"] },
  ]);
  const { client } = await connect(new FakeTaskwarrior(), fakeTimew);

  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name)).toContain("get_time_summary");

  const res = await client.callTool({
    name: "get_time_summary",
    arguments: { from: "2020-01-01", to: "2030-01-01" },
  });
  expect(res.isError).toBeFalsy();
  expect(sc(res).total).toBe(3600);
  expect(sc(res).byTag).toEqual({ coding: 3600 });
});

test("create_project scaffolds a dependency graph", async () => {
  const { client } = await connect();
  const res = await client.callTool({
    name: "create_project",
    arguments: {
      project: "launch",
      steps: [
        { ref: "design", description: "Design" },
        { ref: "build", description: "Build", dependsOn: ["design"] },
      ],
    },
  });
  expect(res.isError).toBeFalsy();
  const results = sc(res).results;
  const build = results.find((r: any) => r.ref === "build");
  const design = results.find((r: any) => r.ref === "design");
  expect(build.task.depends).toEqual([design.task.uuid]);
  expect(sc(res).project).toBe("launch");
});

test("add_task accepts udas when the registry is non-empty", async () => {
  const { client } = await connect(new FakeTaskwarrior(UDAS));
  const res = await client.callTool({
    name: "add_task",
    arguments: { description: "t", udas: { context: "work" } },
  });
  expect(res.isError ?? false).toBe(false);
  expect(sc(res).task.udas).toEqual({ context: "work" });
});

test("create_project steps accept udas", async () => {
  const { client } = await connect(new FakeTaskwarrior(UDAS));
  const res = await client.callTool({
    name: "create_project",
    arguments: {
      project: "p",
      steps: [{ ref: "a", description: "A", udas: { context: "home" } }],
    },
  });
  expect(res.isError ?? false).toBe(false);
  const created = sc(res).results.find((r: any) => r.ref === "a");
  expect(created.task.udas).toEqual({ context: "home" });
});

test("udas is advertised on add_task when UDAs exist", async () => {
  const { client } = await connect(new FakeTaskwarrior(UDAS));
  const { tools } = await client.listTools();
  const addTask = tools.find((t) => t.name === "add_task")!;
  expect(addTask.inputSchema.properties).toHaveProperty("udas");
});

test("udas is not advertised on add_task when the registry is empty", async () => {
  const { client } = await connect();
  const { tools } = await client.listTools();
  const addTask = tools.find((t) => t.name === "add_task")!;
  expect(addTask.inputSchema.properties).not.toHaveProperty("udas");
});

test("next_action returns the ready task with why signals", async () => {
  const fake = new FakeTaskwarrior();
  const blocker = await fake.add("do first");
  const blocked = await fake.add("do later");
  await fake.addDependencies(blocked.uuid, [blocker.uuid]);
  const { client } = await connect(fake);

  const res = await client.callTool({ name: "next_action", arguments: {} });
  expect(res.isError ?? false).toBe(false);
  expect(sc(res).action.uuid).toBe(blocker.uuid);
  expect(sc(res).why.unblocks).toBe(1);
});

test("next_action returns null action when nothing is ready", async () => {
  const { client } = await connect();
  const res = await client.callTool({ name: "next_action", arguments: {} });
  expect(res.isError ?? false).toBe(false);
  expect(sc(res).action).toBeNull();
});

test("custom-fields resource lists the registry when UDAs exist", async () => {
  const { client } = await connect(new FakeTaskwarrior(UDAS));
  const res = await client.readResource({
    uri: "taskwarrior://custom-fields",
  });
  const fields = JSON.parse((res.contents[0] as { text: string }).text);
  expect(fields).toEqual(UDAS);
});

test("custom-fields resource is absent when no UDAs exist", async () => {
  const { client } = await connect();
  const { resources } = await client.listResources();
  expect(resources.map((r) => r.uri)).not.toContain(
    "taskwarrior://custom-fields",
  );
});
