import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { TimewarriorClient } from "./client.js";
import { execFileSync } from "child_process";

let timeWarriorDB: string;
let tw: TimewarriorClient;

const track = (args: string[]) => {
  execFileSync("timew", ["track", ...args], {
    env: { ...process.env, TIMEWARRIORDB: timeWarriorDB },
  });
};

beforeAll(() => {
  timeWarriorDB = mkdtempSync(join(tmpdir(), "tw-client"));
  track([
    "2026-07-10T09:00:00",
    "-",
    "2026-07-10T10:00:00",
    "coding",
    "proj_x",
  ]);
  track([
    "2026-07-10T11:00:00",
    "-",
    "2026-07-10T12:00:00",
    "coding",
    "proj_y",
  ]);
  track(["2023-01-01T09:00:00", "-", "2023-01-01T10:00:00", "review"]);
  tw = new TimewarriorClient({ dataLocation: timeWarriorDB });
});

afterAll(() => rmSync(timeWarriorDB, { recursive: true, force: true }));

test("getIntervals returns a list of intervals", async () => {
  const intervals = await tw.getIntervals();
  expect(intervals).toHaveLength(3);
});

test("getIntervals can filter by tags", async () => {
  const intervals = await tw.getIntervals({ tags: ["coding"] });
  expect(intervals).toHaveLength(2);
});

test("getIntervals can filter by start date", async () => {
  const intervals = await tw.getIntervals({ from: "2026-07-10" });
  expect(intervals).toHaveLength(2);
});
