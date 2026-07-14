import { mkdtempSync, rmSync } from "node:fs";
import { TaskwarriorClient, TaskwarriorError } from "./client.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";

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
