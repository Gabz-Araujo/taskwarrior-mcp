import { expect, test } from "vitest";
import { serializeUdas, assertKnownUdaNames, type UdaDef } from "./udas.js";
import { TaskwarriorError } from "./client.js";

const registry: UdaDef[] = [
  { name: "context", type: "string", values: ["work", "home"] },
  { name: "estimate", type: "numeric" },
];

test("serializeUdas emits name:value args for known fields", () => {
  expect(serializeUdas({ context: "work", estimate: 3 }, registry)).toEqual([
    "context:work",
    "estimate:3",
  ]);
});

test("serializeUdas returns [] for undefined", () => {
  expect(serializeUdas(undefined, registry)).toEqual([]);
});

test("serializeUdas rejects an unknown field with invalid-input", () => {
  try {
    serializeUdas({ nope: "x" }, registry);
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(TaskwarriorError);
    expect((error as TaskwarriorError).kind).toBe("invalid-input");
  }
});

test("serializeUdas rejects a value outside an enum's values", () => {
  expect(() => serializeUdas({ context: "car" }, registry)).toThrow(
    /not an allowed value/i,
  );
});

test("serializeUdas allows empty string to clear a field", () => {
  expect(serializeUdas({ context: "" }, registry)).toEqual(["context:"]);
});

test("assertKnownUdaNames throws invalid-input for an unknown name", () => {
  expect(() => assertKnownUdaNames(["nope"], registry)).toThrow(
    TaskwarriorError,
  );
});

test("assertKnownUdaNames passes for known names", () => {
  expect(() => assertKnownUdaNames(["context"], registry)).not.toThrow();
});
