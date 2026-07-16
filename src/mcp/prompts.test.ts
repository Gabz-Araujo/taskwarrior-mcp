import { test, expect } from "vitest";
import { FakeTaskwarrior } from "../testing/fake-taskwarrior.js";
import { Client } from "@modelcontextprotocol/sdk/client";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory";
import { createServer } from "./index.js";
import type { Taskwarrior } from "../taskwarrior/client.js";
import type { Timewarrior } from "../timewarrior/client.js";

async function connect(
  tw: Taskwarrior = new FakeTaskwarrior(),
  timewarrior?: Timewarrior,
) {
  const server = createServer(tw, timewarrior ? { timewarrior } : {});
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client };
}

test("daily-triage assembles a prompt from current tasks", async () => {
  const fake = new FakeTaskwarrior();
  await fake.add("overdue thing", { due: "2020-01-01" });
  const { client } = await connect(fake);

  const res = await client.getPrompt({ name: "daily-triage" });
  const text = (res.messages[0] as any).content.text;
  expect(text).toContain("overdue thing");
});
