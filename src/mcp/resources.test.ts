import { test, expect } from "vitest";
import { FakeTaskwarrior } from "../testing/fake-taskwarrior.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "./index.js";
import type { Taskwarrior } from "../taskwarrior/index.js";

async function connect(tw: Taskwarrior = new FakeTaskwarrior()) {
  const server = await createServer(tw);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client };
}

test("the projects resource is advertised", async () => {
  const { client } = await connect();
  const { resources } = await client.listResources();
  expect(resources.map((r) => r.uri)).toContain("taskwarrior://projects");
});

test("the projects resource returns per-project pending counts", async () => {
  const fake = new FakeTaskwarrior();
  await fake.add("a", { project: "work" });
  await fake.add("b", { project: "work" });
  await fake.add("c", { project: "home" });
  const { client } = await connect(fake);

  const res = await client.readResource({ uri: "taskwarrior://projects" });
  const data = JSON.parse((res.contents[0] as any).text);

  const work = data.find((d: any) => d.project === "work");
  const home = data.find((d: any) => d.project === "home");
  expect(work.pending).toBe(2);
  expect(home.pending).toBe(1);
});

test("the project template resource returns that project's tasks", async () => {
  const fake = new FakeTaskwarrior();
  await fake.add("work a", { project: "work" });
  await fake.add("home b", { project: "home" });
  const { client } = await connect(fake);

  const res = await client.readResource({ uri: "taskwarrior://project/work" });
  const text = (res.contents[0] as any).text;
  expect(text).toContain("work a");
  expect(text).not.toContain("home b");
});

test("the stats resource reports counts by status", async () => {
  const fake = new FakeTaskwarrior();
  await fake.add("p1");
  const done = await fake.add("p2");
  await fake.done(done.uuid);
  const { client } = await connect(fake);

  const res = await client.readResource({ uri: "taskwarrior://stats" });
  const stats = JSON.parse((res.contents[0] as any).text);
  expect(stats.pending).toBe(1);
  expect(stats.completed).toBe(1);
});
