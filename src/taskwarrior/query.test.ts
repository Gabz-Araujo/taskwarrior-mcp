import { test, expect } from "vitest";
import { buildListFilterArgs, sortTasks } from "./query.js";
import type { Task } from "./types.js";

function task(partial: Partial<Task>): Task {
  return {
    uuid: "u",
    description: "d",
    project: "p",
    status: "pending",
    tags: ["t"],
    entry: "e",
    ...partial,
  };
}

test("defaults to pending when no filter is given", () => {
  expect(buildListFilterArgs()).toEqual(["status:pending"]);
});

test("uses an explicit status when given", () => {
  expect(buildListFilterArgs({ status: "completed" })).toEqual([
    "status:completed",
  ]);
});

test("adds a project token after status", () => {
  expect(buildListFilterArgs({ project: "foo" })).toEqual([
    "status:pending",
    "project:foo",
  ]);
});

test("adds a + token per tag", () => {
  expect(buildListFilterArgs({ tags: ["foo", "bar"] })).toEqual([
    "status:pending",
    "+foo",
    "+bar",
  ]);
});

test("adds due range tokens", () => {
  expect(buildListFilterArgs({ dueBefore: "eom", dueAfter: "today" })).toEqual([
    "status:pending",
    "due.before:eom",
    "due.after:today",
  ]);
});

test("status: all emits no status token", () => {
  expect(buildListFilterArgs({ status: "all" })).toEqual([]);
});

test("sorts tasks by urgency", () => {
  const tasks = [
    task({ urgency: 1 }),
    task({ urgency: 2 }),
    task({ urgency: 3 }),
  ];

  expect(sortTasks(tasks, "urgency")).toEqual([
    task({ urgency: 3 }),
    task({ urgency: 2 }),
    task({ urgency: 1 }),
  ]);
});

test("sorts tasks by due", () => {
  const tasks = [
    task({ due: "2023-01-03" }),
    task({ due: "2023-01-01" }),
    task({ due: "2023-01-02" }),
  ];

  expect(sortTasks(tasks, "due")).toEqual([
    task({ due: "2023-01-01" }),
    task({ due: "2023-01-02" }),
    task({ due: "2023-01-03" }),
  ]);
});

test("sorts by due ascending, undefined last", () => {
  const tasks = [
    task({ uuid: "a", due: "2023-01-03" }),
    task({ uuid: "b" }), // no due
    task({ uuid: "c", due: "2023-01-01" }),
  ];
  expect(sortTasks(tasks, "due")?.map((t) => t.uuid)).toEqual(["c", "a", "b"]);
});
