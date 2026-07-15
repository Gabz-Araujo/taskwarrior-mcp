import type { TimeInterval, TimeSummary } from "./types.js";

export const parseTimewTimestamp = (timestamp: string): number => {
  const year = timestamp.slice(0, 4);
  const month = timestamp.slice(4, 6);
  const day = timestamp.slice(6, 8);
  const hour = timestamp.slice(9, 11);
  const minute = timestamp.slice(11, 13);
  const second = timestamp.slice(13, 15);

  if (!year || !month || !day || !hour || !minute || !second) {
    throw new Error("Invalid timew timestamp");
  }

  return (
    Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
    ) / 1000
  );
};

export const summarizeIntervals = (
  intervals: TimeInterval[],
  now: number,
): TimeSummary => {
  let total = 0;
  const byTag: Record<string, number> = {};
  for (const interval of intervals) {
    const duration = (interval.end ?? now) - interval.start;
    total += duration;
    for (const tag of interval.tags ?? []) {
      byTag[tag] = (byTag[tag] ?? 0) + duration;
    }
  }
  return { total, byTag };
};
