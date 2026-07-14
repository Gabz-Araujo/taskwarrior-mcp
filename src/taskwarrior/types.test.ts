import { test, expect } from "vitest";
import { TaskSchema } from "./types.js";

test("TaskSchema parses depends as a string array", () => {
  const parsed = TaskSchema.parse({
    uuid: "11111111-1111-1111-1111-111111111111",
    description: "blocked task",
    status: "pending",
    entry: "20260101T000000Z",
    depends: ["22222222-2222-2222-2222-222222222222"],
  });
  expect(parsed.depends).toEqual(["22222222-2222-2222-2222-222222222222"]);
});
