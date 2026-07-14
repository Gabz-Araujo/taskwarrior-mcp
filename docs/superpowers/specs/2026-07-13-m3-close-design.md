# M3-close: `whats_next` + foundation polish

**Status:** approved design, ready for implementation plan
**Date:** 2026-07-13

## Goal

Close Milestone 3 by adding the product differentiator (`whats_next`, urgency-aware) and the "foundation-as-feature" quality layer that every later milestone reuses: enriched `list`, machine-readable tool output, tool annotations, self-describing schemas, and model-teaching error messages.

Non-goals for this milestone: prompts, resources, batch operations, time tracking, dependencies-as-tools, remote transport. Those are M4+.

## Architecture recap (unchanged boundaries)

- `src/taskwarrior/` — MCP-agnostic wrapper. Domain logic (filtering, sorting, limiting) lives here so it is exercised by the fake and unit tests.
- `src/mcp/` — adapter. Thin handlers map tool input → wrapper call → structured result; the only place that knows about MCP.
- One-way dependency: `mcp/` → `taskwarrior/`, never the reverse.

## Changes

### 1. Enrich `list` (wrapper)

Signature becomes:

```ts
list(filter?: ListFilter, options?: ListOptions): Promise<Task[]>
```

`ListFilter` gains date-range fields and an `"all"` escape hatch on status:

```ts
type ListFilter = {
  status?: Status | "all";
  project?: string;
  tags?: string[];
  dueBefore?: string;
  dueAfter?: string;
};
```

`ListOptions`:

```ts
type ListOptions = {
  limit?: number;
  sort?: "urgency" | "due" | "entry";
};
```

Behavior:
- `dueBefore`/`dueAfter` serialize as controlled tokens `due.before:<v>` / `due.after:<v>` — the value is one CLI token, never raw filter language (same discipline as existing attributes).
- **Default status:** when `filter.status` is omitted, apply `status:pending`. Rationale: a bare `task export` returns the entire history (pending + completed + deleted), which is unbounded context.
- **Listing other scopes:** pass `status` explicitly for a single other state (e.g. `"completed"`, `"deleted"`), or `status: "all"` to bypass the default and return every state. `"all"` emits no `status:` filter token.
- Sorting happens in the wrapper after `export`:
  - `sort: "urgency"` → descending by `urgency` (`undefined` treated as `0`).
  - `sort: "due"` → ascending by `due`; tasks without a due date sort last.
  - `sort: "entry"` → ascending by `entry` (oldest first) — surfaces stale/aging tasks.
- `limit` slices after sorting.

### 2. `whats_next` tool

A thin, opinionated preset over the enriched `list`:

```
whats_next({ project?, tags?, limit? })
  → list({ status: "pending", project, tags }, { sort: "urgency", limit: limit ?? 10 })
```

- Default `limit` = 10.
- Returns the top-N pending tasks by urgency. The "why" is emergent from the returned fields (`urgency`, `due`, `priority`, `tags`, active-via-`start`, blocked-via-`depends`); the model articulates the reasoning. No reimplementation of taskwarrior's urgency formula.

### 3. `TaskSchema` gains `depends`

```ts
depends: z.array(z.string()).optional(),
```

Surfaces blocking relationships so `whats_next` reasoning can mention "blocked by N." Also groundwork for M4 dependency tools.

### 4. `outputSchema` + `structuredContent` (mcp layer)

Every tool declares an `outputSchema` and returns `structuredContent` alongside the existing text `content` (text retained for human display / back-compat). All structured output is wrapped in a uniform object (MCP requires `structuredContent` to be an object, not a bare value/array):

- `add_task`, `modify_task`, `complete_task`, `delete_task`: `structuredContent: { task: Task }`; `outputSchema: { task: TaskSchema }`.
- `get_task`: `structuredContent: { task: Task | null }`; `outputSchema: { task: TaskSchema.nullable() }`. Not-found is a valid `{ task: null }` result, **not** an error (absence is a legitimate answer to a lookup).
- `list_tasks`, `whats_next`: `structuredContent: { tasks: Task[] }`; `outputSchema: { tasks: z.array(TaskSchema) }`.

`guard()` grows a shaper argument so each handler declares how its wrapper result maps to the structured object:

```ts
guard(() => tw.add(description, opts), (task) => ({ task }))       // single
guard(() => tw.getByUuid(uuid), (task) => ({ task: task ?? null })) // get (nullable)
guard(() => tw.list(filter, options), (tasks) => ({ tasks }))     // collection
```

`ok()` sets both `content` (text form of the structured object) and `structuredContent`.

### 5. Tool annotations (mcp layer)

Declarative `annotations` on each `registerTool` config:

| Tool | annotations |
|---|---|
| `list_tasks`, `get_task`, `whats_next` | `readOnlyHint: true` |
| `add_task` | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false` |
| `modify_task` | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true` |
| `complete_task` | `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: false` |
| `delete_task` | `readOnlyHint: false`, `destructiveHint: true`, `idempotentHint: true` |

### 6. `.describe()` on schema fields (mcp layer)

Every field in `schemas.ts` gets a `.describe(...)`. Date fields explicitly document taskwarrior date syntax:

> "taskwarrior date syntax — e.g. `friday`, `tomorrow`, `eom`, or an ISO date."

This is the "don't build date NLP" trap turned into free model guidance.

### 7. Teaching errors (wrapper)

Refine the "could not be read back" throws in `modify`/`done`/`delete` (and the not-found path) to guide the model:

> "No task matches uuid `<X>` — call `list_tasks` or `get_task` to find valid uuids."

Placed at the wrapper so every caller benefits, not just the MCP layer.

## Testing

- **Unit (wrapper logic):** `list` sorting (`urgency` desc, `due` asc with undefined-last), `limit` slicing, default-pending behavior, `dueBefore`/`dueAfter` serialization. Fast, no subprocess.
- **Integration (temp `dataLocation`):** exercise each tool end-to-end via the SDK client against a disposable data dir — including `whats_next` ordering, `outputSchema` validation (structuredContent conforms), and teaching-error paths (well-formed but absent uuid).
- Promote the throwaway smoke scripts into a committed suite.

## Risks / decisions

- **`outputSchema` is the largest change** (touches every handler). Cleanly deferrable to M4 if the milestone needs trimming; kept in scope per approval.
- **Default-pending in `list`** is a behavior change from the current "whatever the filter says." Documented; explicit `status` overrides.
- **Sort keys are `urgency`/`due`/`entry`** for now; more can be added additively.
