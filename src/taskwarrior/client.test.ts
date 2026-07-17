import {
  mkdtempSync,
  mkdirSync,
  existsSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { TaskwarriorClient, TaskwarriorError } from "./client.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createProject } from "./scaffold.js";

let dataLocation: string;
let tw: TaskwarriorClient;

beforeAll(() => {
  dataLocation = mkdtempSync(join(tmpdir(), "tw-client"));
  tw = new TaskwarriorClient({ dataLocation });
});
afterAll(() => {
  rmSync(dataLocation, { recursive: true, force: true });
});

test("list defaults to pending only", async () => {
  await tw.add("pending one");
  const b = await tw.add("to complete");
  await tw.done(b.uuid);
  const tasks = await tw.list();
  expect(tasks.map((t) => t.description)).toEqual(["pending one"]);
});

test("limit caps the number returned", async () => {
  await tw.add("pending one");
  await tw.add("pending two");
  await tw.add("pending three");
  const tasks = await tw.list({}, { limit: 2 });
  expect(tasks).toHaveLength(2);
});

test("modify on an absent uuid throws a not-found error", async () => {
  const promise = tw.modify("99999999-9999-9999-9999-999999999999", {
    priority: "H",
  });
  await expect(promise).rejects.toBeInstanceOf(TaskwarriorError);
  await expect(promise).rejects.toHaveProperty("kind", "not-found");
  await expect(promise).rejects.toThrow(
    "No task matches uuid 99999999-9999-9999-9999-999999999999",
  );
});

test("should create a annotation on task", async () => {
  const task = await tw.add("test");
  await tw.annotate(task.uuid, "test annotation");
  const annotatedTask = await tw.getByUuid(task.uuid);
  expect(annotatedTask?.annotations?.[0]?.description).toBe("test annotation");
});

test("should denotate on task", async () => {
  const task = await tw.add("test");
  await tw.annotate(task.uuid, "test denotation");
  await tw.denotate(task.uuid, "test denotation");
  const denotatedTask = await tw.getByUuid(task.uuid);
  expect(denotatedTask?.annotations?.[0]?.description).toBeUndefined();
});

test("annotation text is literal, not parsed as attributes", async () => {
  const task = await tw.add("host");
  await tw.annotate(task.uuid, "project:evil");
  const annotatedTask = await tw.getByUuid(task.uuid);
  expect(annotatedTask?.project).toBeUndefined();
  expect(annotatedTask?.annotations?.[0]?.description).toBe("project:evil");
});

test("should start a task", async () => {
  const task = await tw.add("test");
  await tw.start(task.uuid);
  const startedTask = await tw.getByUuid(task.uuid);
  expect(startedTask?.start).toBeDefined();
});

test("should stop a task", async () => {
  const task = await tw.add("test");
  await tw.start(task.uuid);
  await tw.stop(task.uuid);
  const stoppedTask = await tw.getByUuid(task.uuid);
  expect(stoppedTask?.start).toBeUndefined();
  expect(stoppedTask?.status).toBe("pending");
});

test("should add dependencies to a task", async () => {
  const task = await tw.add("test");
  await tw.addDependencies(task.uuid, [
    "99999999-9999-9999-9999-999999999990",
    "99999999-9999-9999-9999-999999999991",
  ]);
  const modifiedTask = await tw.getByUuid(task.uuid);
  expect(modifiedTask?.depends).toEqual([
    "99999999-9999-9999-9999-999999999990",
    "99999999-9999-9999-9999-999999999991",
  ]);
});

test("should remove dependencies from a task", async () => {
  const task = await tw.add("test");
  await tw.addDependencies(task.uuid, [
    "99999999-9999-9999-9999-999999999990",
    "99999999-9999-9999-9999-999999999991",
  ]);
  await tw.removeDependencies(task.uuid, [
    "99999999-9999-9999-9999-999999999990",
  ]);
  const modifiedTask = await tw.getByUuid(task.uuid);
  expect(modifiedTask?.depends).toEqual([
    "99999999-9999-9999-9999-999999999991",
  ]);
});

test("removing a non-present dependency leaves existing ones intact", async () => {
  const task = await tw.add("test");
  await tw.addDependencies(task.uuid, ["99999999-9999-9999-9999-999999999990"]);
  await tw.removeDependencies(task.uuid, [
    "99999999-9999-9999-9999-999999999991",
  ]);
  const modifiedTask = await tw.getByUuid(task.uuid);
  expect(modifiedTask?.depends).toEqual([
    "99999999-9999-9999-9999-999999999990",
  ]);
});

test("adding a dependency that creates a cycle throws invalid-input", async () => {
  const a = await tw.add("cycle a");
  const b = await tw.add("cycle b");
  await tw.addDependencies(a.uuid, [b.uuid]);
  const promise = tw.addDependencies(b.uuid, [a.uuid]);
  await expect(promise).rejects.toHaveProperty("kind", "invalid-input");
  await expect(promise).rejects.toThrow(/circular dependency/i);
});

test("start fires the on-modify hook (hooks are enabled for start/stop/done)", async () => {
  const dl = mkdtempSync(join(tmpdir(), "tw-hook"));
  const hooksDir = join(dl, "hooks");
  mkdirSync(hooksDir, { recursive: true });
  const marker = join(dl, "fired");
  writeFileSync(
    join(hooksDir, "on-modify.marker"),
    `#!/bin/sh\nread old\nread new\nprintf '%s\\n' "$new"\necho x >> ${marker}\n`,
    { mode: 0o755 },
  );
  const client = new TaskwarriorClient({ dataLocation: dl });
  const t = await client.add("hooked");
  await client.start(t.uuid);
  expect(existsSync(marker)).toBe(true);
  rmSync(dl, { recursive: true, force: true });
});

test("add with recur creates a recurring task", async () => {
  const task = await tw.add("standup", { recur: "daily", due: "tomorrow" });
  expect(task.recur).toBe("daily");
});

test("recur without a due date is rejected", async () => {
  await expect(tw.add("no due", { recur: "daily" })).rejects.toHaveProperty(
    "kind",
    "invalid-input",
  );
});

test("createProject wires real dependencies in taskwarrior", async () => {
  const { results } = await createProject(tw, {
    project: "launch",
    steps: [
      { ref: "design", description: "Design real" },
      { ref: "copy", description: "Copy real" },
      {
        ref: "build",
        description: "Build real",
        dependsOn: ["design", "copy"],
      },
    ],
  });

  const byRef: any = Object.fromEntries(results.map((r) => [r.ref, r]));
  const build = await tw.getByUuid(byRef.build.task.uuid);
  expect(build?.project).toBe("launch");
  expect(build?.depends).toEqual(
    expect.arrayContaining([byRef.design.task.uuid, byRef.copy.task.uuid]),
  );
});

function udaClient(): TaskwarriorClient {
  const rcFile = join(dataLocation, "uda.taskrc");
  writeFileSync(
    rcFile,
    [
      `data.location=${dataLocation}`,
      "uda.context.type=string",
      "uda.context.label=Context",
      "uda.context.values=work,home,errands",
      "uda.estimate.type=numeric",
      "uda.estimate.label=Estimate",
    ].join("\n"),
  );
  return new TaskwarriorClient({ rcFile, dataLocation });
}

test("discoverUdas reads UDA definitions from the rc file", async () => {
  const client = udaClient();
  const udas = await client.discoverUdas();
  const byName = Object.fromEntries(udas.map((u) => [u.name, u]));
  expect(byName.context).toMatchObject({
    name: "context",
    type: "string",
    label: "Context",
    values: ["work", "home", "errands"],
  });
  expect(byName.estimate).toMatchObject({ name: "estimate", type: "numeric" });
});

test("add sets UDA values and reads them back on the task", async () => {
  const client = udaClient();
  const task = await client.add("with udas", {
    udas: { context: "work", estimate: 3 },
  });
  expect(task.udas).toMatchObject({ context: "work", estimate: 3 });
});

test("add rejects a value outside a UDA's declared values", async () => {
  const client = udaClient();
  await expect(
    client.add("bad enum", { udas: { context: "car" } }),
  ).rejects.toHaveProperty("kind", "invalid-input");
});

test("add rejects an unknown UDA name", async () => {
  const client = udaClient();
  await expect(
    client.add("bad name", { udas: { nope: "x" } }),
  ).rejects.toHaveProperty("kind", "invalid-input");
});

test("export does not surface taskwarrior internal keys as udas", async () => {
  const client = udaClient();
  const task = await client.add("plain", {});
  expect(task.udas).toBeUndefined();
});

test("list filters by a UDA value", async () => {
  const client = udaClient();
  await client.add("at work", { project: "ctxfilter", udas: { context: "work" } });
  await client.add("at home", { project: "ctxfilter", udas: { context: "home" } });
  const atWork = await client.list({
    project: "ctxfilter",
    udas: { context: "work" },
  });
  expect(atWork.map((task) => task.description)).toEqual(["at work"]);
});

test("list rejects an unknown UDA filter name", async () => {
  const client = udaClient();
  await expect(client.list({ udas: { nope: "x" } })).rejects.toHaveProperty(
    "kind",
    "invalid-input",
  );
});

test("ready filter excludes tasks blocked by an open dependency", async () => {
  const blocker = await tw.add("ready blocker");
  const blocked = await tw.add("ready blocked");
  await tw.addDependencies(blocked.uuid, [blocker.uuid]);

  const ready = await tw.list({ ready: true });
  const uuids = ready.map((t) => t.uuid);
  expect(uuids).toContain(blocker.uuid);
  expect(uuids).not.toContain(blocked.uuid);
});

test("endAfter filters completed tasks by end date", async () => {
  const done = await tw.add("endafter done");
  await tw.done(done.uuid);

  const past = await tw.list({
    status: "completed",
    endAfter: "20000101T000000Z",
  });
  expect(past.map((t) => t.uuid)).toContain(done.uuid);

  const future = await tw.list({
    status: "completed",
    endAfter: "20990101T000000Z",
  });
  expect(future.map((t) => t.uuid)).not.toContain(done.uuid);
});
