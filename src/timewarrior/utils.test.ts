import { expect, test } from "vitest";
import { parseTimewTimestamp, summarizeIntervals } from "./utils.js";

test("parses basic timew timestamp to epoch seconds (UTC)", () => {
  expect(parseTimewTimestamp("20230101T000000Z")).toBe(1672531200);
});

test("sums durations and tallies by tag", () => {
  const intervals = [
    { id: "1", start: 0, end: 10, tags: ["coding", "proj_x"] },
    { id: "2", start: 10, end: 20, tags: ["coding"] },
    { id: "3", start: 70, end: 80, tags: ["review"] },
  ];
  expect(summarizeIntervals(intervals, 0)).toEqual({
    total: 30,
    byTag: { coding: 20, proj_x: 10, review: 10 },
  });
});

test("an active interval is measured up to now", () => {
  expect(
    summarizeIntervals([{ id: "1", start: 100, tags: ["coding"] }], 150),
  ).toEqual({ total: 50, byTag: { coding: 50 } });
});
