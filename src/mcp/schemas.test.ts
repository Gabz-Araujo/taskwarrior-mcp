import { expect, test } from "vitest";
import { z } from "zod";
import { udaInputSchema } from "./schemas.js";
import type { UdaDef } from "../taskwarrior/udas.js";

test("udaInputSchema returns undefined for an empty registry", () => {
  expect(udaInputSchema([])).toBeUndefined();
});

test("udaInputSchema builds an enum field from values", () => {
  const registry: UdaDef[] = [
    { name: "context", type: "string", values: ["work", "home"] },
  ];
  const schema = udaInputSchema(registry) as z.ZodType;
  expect(schema.safeParse({ context: "work" }).success).toBe(true);
  expect(schema.safeParse({ context: "car" }).success).toBe(false);
});

test("udaInputSchema builds a numeric field for numeric UDAs", () => {
  const registry: UdaDef[] = [{ name: "estimate", type: "numeric" }];
  const schema = udaInputSchema(registry) as z.ZodType;
  expect(schema.safeParse({ estimate: 3 }).success).toBe(true);
  expect(schema.safeParse({ estimate: "three" }).success).toBe(false);
});
