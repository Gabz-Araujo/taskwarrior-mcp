import { test, expect } from "vitest";
import { FakeTaskwarrior } from "../testing/fake-taskwarrior.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./index.js";
import type { Taskwarrior } from "../taskwarrior/index.js";
import type { Timewarrior } from "../timewarrior/client.js";
import type { UdaDef } from "../taskwarrior/udas.js";

const CONTEXT_UDA: UdaDef[] = [
  { name: "context", type: "string", values: ["work", "home"] },
];
const AREA_UDA: UdaDef[] = [{ name: "area", type: "string" }];

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

test("daily-triage assembles an actionable, project-grouped prompt", async () => {
  const fake = new FakeTaskwarrior();
  const task = await fake.add("overdue thing", {
    due: "2020-01-01",
    project: "home",
  });
  const { client } = await connect(fake);

  const res = await client.getPrompt({ name: "daily-triage" });
  const text = (res.messages[0] as any).content.text;

  expect(text).toContain("overdue thing");
  expect(text).toContain(task.uuid);
  expect(text).toContain("home:");
  expect(text).toContain("Which should I tackle now?");
});

test("weekly-review scopes to the given project", async () => {
  const fake = new FakeTaskwarrior();
  await fake.add("work task", { project: "work" });
  await fake.add("home task", { project: "home" });
  const { client } = await connect(fake);

  const res = await client.getPrompt({
    name: "weekly-review",
    arguments: { project: "work" },
  });
  const text = (res.messages[0] as any).content.text;

  expect(text).toContain("work task");
  expect(text).not.toContain("home task");
});

test("weekly-review shows only recently completed tasks", async () => {
  const fake = new FakeTaskwarrior();
  const recent = await fake.add("recent done");
  await fake.done(recent.uuid);
  (await fake.getByUuid(recent.uuid))!.end = "20990101T000000Z";
  const old = await fake.add("old done");
  await fake.done(old.uuid);
  (await fake.getByUuid(old.uuid))!.end = "20000101T000000Z";
  const { client } = await connect(fake);

  const res = await client.getPrompt({
    name: "weekly-review",
    arguments: {},
  });
  const text = (res.messages[0] as any).content.text;

  expect(text).toContain("recent done");
  expect(text).not.toContain("old done");
});

test("plan-project frames the goal in create_project shape with existing tasks", async () => {
  const fake = new FakeTaskwarrior();
  await fake.add("existing step", { project: "launch" });
  const { client } = await connect(fake);

  const res = await client.getPrompt({
    name: "plan-project",
    arguments: { goal: "Ship the launch", project: "launch" },
  });
  const text = (res.messages[0] as any).content.text;

  expect(text).toContain("Ship the launch");
  expect(text).toContain("existing step");
  expect(text).toContain("dependsOn");
  expect(text).toContain("create_project");
});

test("unblock lists blocked tasks and ranks blockers", async () => {
  const fake = new FakeTaskwarrior();
  const blocker = await fake.add("do first");
  const blocked = await fake.add("do second");
  await fake.addDependencies(blocked.uuid, [blocker.uuid]);
  const { client } = await connect(fake);

  const res = await client.getPrompt({ name: "unblock", arguments: {} });
  const text = (res.messages[0] as any).content.text;

  expect(text).toContain("do second");
  expect(text).toContain("do first");
  expect(text).toContain(blocker.uuid);
});

test("GTD groups actionable tasks by context when the UDA exists", async () => {
  const fake = new FakeTaskwarrior(CONTEXT_UDA);
  await fake.add("email boss", { udas: { context: "work" } });
  await fake.add("no context task", {});
  const { client } = await connect(fake);

  const res = await client.getPrompt({ name: "GTD", arguments: {} });
  const text = (res.messages[0] as any).content.text;

  expect(text).toContain("work:");
  expect(text).toContain("email boss");
  expect(text).toContain("(no context)");
});

test("GTD falls back to project grouping without a context UDA", async () => {
  const fake = new FakeTaskwarrior();
  await fake.add("plain task", { project: "home" });
  const { client } = await connect(fake);

  const res = await client.getPrompt({ name: "GTD", arguments: {} });
  const text = (res.messages[0] as any).content.text;

  expect(text).toContain("home:");
  expect(text).toContain("context UDA");
});

test("PARA groups by area and flags tasks with no area", async () => {
  const fake = new FakeTaskwarrior(AREA_UDA);
  await fake.add("gym", { udas: { area: "health" } });
  await fake.add("unfiled", {});
  const { client } = await connect(fake);

  const res = await client.getPrompt({ name: "PARA", arguments: {} });
  const text = (res.messages[0] as any).content.text;

  expect(text).toContain("health:");
  expect(text).toContain("gym");
  expect(text).toContain("(no area)");
});

test("PARA falls back to projects without an area UDA", async () => {
  const fake = new FakeTaskwarrior();
  await fake.add("plain", { project: "work" });
  const { client } = await connect(fake);

  const res = await client.getPrompt({ name: "PARA", arguments: {} });
  const text = (res.messages[0] as any).content.text;

  expect(text).toContain("work:");
  expect(text).toContain("area UDA");
});
