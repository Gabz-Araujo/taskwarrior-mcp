import { expect, test } from "vitest";
import { createProject, validateSteps } from "./scaffold.js";
import { TaskwarriorError } from "./client.js";
import { FakeTaskwarrior } from "../testing/fake-taskwarrior.js";

test("rejects an unknown dependsOn ref", () => {
  expect(() => {
    validateSteps([
      {
        ref: "foo",
        description: "bar",
        dependsOn: ["unknown"],
      },
    ]);
  }).toThrow(/unknown ref/i);
});

test("rejects a cycle", () => {
  expect(() =>
    validateSteps([
      { ref: "a", description: "a", dependsOn: ["b"] },
      { ref: "b", description: "b", dependsOn: ["a"] },
    ]),
  ).toThrow(/cycle/i);
});

test("accepts a valid DAG", () => {
  expect(() =>
    validateSteps([
      { ref: "a", description: "a" },
      { ref: "b", description: "b", dependsOn: ["a"] },
    ]),
  ).not.toThrow();
});

test("accepts a forward reference (dep defined later)", () => {
  expect(() =>
    validateSteps([
      { ref: "a", description: "a", dependsOn: ["b"] },
      { ref: "b", description: "b" },
    ]),
  ).not.toThrow();
});

test("rejects a duplicate ref", () => {
  expect(() =>
    validateSteps([
      { ref: "a", description: "a" },
      { ref: "a", description: "a2" },
    ]),
  ).toThrow(/duplicate/i);
});

test("validation errors are invalid-input", () => {
  try {
    validateSteps([{ ref: "a", description: "a", dependsOn: ["x"] }]);
    expect.fail("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TaskwarriorError);
    expect((e as TaskwarriorError).kind).toBe("invalid-input");
  }
});

test("createProject builds a project as a dependency DAG", async () => {
  const fake = new FakeTaskwarrior();
  const { results } = await createProject(fake, {
    project: "launch",
    steps: [
      { ref: "design", description: "Design Page" },
      { ref: "copy", description: "Write copy" },
      { ref: "build", description: "Build", dependsOn: ["design", "copy"] },
      { ref: "ship", description: "Ship", dependsOn: ["build"] },
    ],
  });
  const byRef: any = Object.fromEntries(results.map((r) => [r.ref, r]));
  expect(byRef.design.task.project).toBe("launch");
  expect(byRef.build.task.depends).toEqual(
    expect.arrayContaining([byRef.design.task.uuid, byRef.copy.task.uuid]),
  );
  expect(byRef.ship.task.depends).toEqual([byRef.build.task.uuid]);
});
