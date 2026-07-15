import { z } from "zod";

export interface TimeInterval {
  id: string;
  start: number;
  end?: number;
  tags?: string[];
}

export interface TimeSummary {
  total: number;
  byTag: Record<string, number>;
}

export type TimeFilter = {
  from?: string;
  to?: string;
  tags?: string[];
};

export const RawIntervalSchema = z.object({
  id: z.number(),
  start: z.string(),
  end: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const RawIntervalArraySchema = z.array(RawIntervalSchema);
