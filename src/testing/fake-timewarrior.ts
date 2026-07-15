import type { Timewarrior } from "../timewarrior/client.js";
import type { TimeInterval, TimeSummary } from "../timewarrior/types.js";
import { summarizeIntervals } from "../timewarrior/utils.js";

export class FakeTimewarrior implements Timewarrior {
  private readonly intervals: TimeInterval[];

  constructor(intervals: TimeInterval[]) {
    this.intervals = intervals;
  }

  async getIntervals(): Promise<TimeInterval[]> {
    return this.intervals;
  }

  async getSummary(): Promise<TimeSummary> {
    return summarizeIntervals(this.intervals, Date.now() / 1000);
  }
}
