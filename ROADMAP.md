# Taskwarrior MCP — Roadmap

_Last updated: 2026-07-14_

## Status

**M3-close — done.** The differentiator plus the foundation-quality layer:

- `whats_next` (urgency-ordered, scopable) and an enriched `list` (sort / limit / due-range / `status:"all"`, default-pending)
- structured output (`outputSchema` + `structuredContent`), tool annotations, self-describing schemas
- error handling: `kind`-classified domain errors → model-facing guidance in the MCP layer; unexpected errors contained as a generic `isError` and logged to stderr; MCP tool names kept out of the domain layer
- server version inherited from `package.json`
- four-tier test suite (pure unit, client integration, in-memory MCP, end-to-end)

## Milestones

### M4 — Domain completeness
- `annotate` / `denotate` (task annotations)
- dependencies (expose as `modify` options `addDepends`/`removeDepends`; `depends` already on `TaskSchema`)
- `start` / `stop` (the task-side of time tracking)
- each: wrapper method + tool, same TDD rhythm

### M4.5 — Time reporting via Timewarrior (first optional capability)
- A separate `Timewarrior` wrapper over `timew` (`timew export` gives JSON), same disciplines as the Taskwarrior wrapper.
- A `time_summary` tool ("where did my hours go, by project/tag").
- Introduces the **capability-provider pattern** (see below) — isolated here so it's learned cleanly.
- Rationale: Taskwarrior only records start/end stamps; real duration/aggregation lives in Timewarrior (wired via the `on-modify` hook). Building time math on raw stamps would reinvent what `timew` exists for.

### M5 — MCP-native workflows (new MCP concepts)
- **Prompts**: `weekly-review`, `daily-triage` — packaged GTD reviews that assemble pending/overdue/completed context.
- **Resources**: project / burndown reports the client can attach passively (no tool call).
- Sequenced before M6 because prompts/resources are the unlearned MCP features and they make GTD/PARA packaging easier.

### M6 — Batch & project scaffolding
- Batch add/modify with **per-item results + dry-run** (Taskwarrior has no transactions, so no all-or-nothing — report each item).
- Project-tree creation: nested steps → dotted project hierarchy + dependency chains.

### Phase 2 — Remote + distribution (the structural bet)
- **Streamable HTTP transport + OAuth 2.1** — turn the local stdio server into a personal service reachable from claude.ai / mobile. New territory: HTTP lifecycle, sessions, auth.
- **Distribution** (pairs naturally here): npm publish (`prepack` build + metadata; consumed via `npx`), and/or a Nix flake via `buildNpmPackage` with `wrapProgram` bundling `task` onto PATH — which also removes the hardcoded store-path fragility in client configs.

## Architecture pattern: capability providers + detection

The server is a **composition of capability providers**, each wrapping one ecosystem tool, each independently optional.

- **Core (required):** Taskwarrior. No `task` binary → no server.
- **Optional:** Timewarrior (time reporting), TaskChampion sync, and future additions.

Mechanism:
1. Each provider is its own wrapper (one client per external tool), testable with its own fake.
2. At server startup, **detect** whether the tool is available (e.g. `timew --version`, or `sync.server.url` present in config).
3. **Conditionally register** that capability's tools only when available. A model never sees a tool this machine can't fulfill, instead of seeing one that always errors.
4. `createServer` composes the providers.

This keeps the tool surface truthful, the wrappers modular, and makes adding a capability later a purely additive change (new wrapper + detection + conditional registration — no core changes).

Each provider is also a **trust boundary**: same injection-safety (`execFile` with an args array, no shell, validated inputs), same error-`kind` discipline, and graceful degradation when absent (hidden from the tool list, or a clear "not installed" error).

**TaskChampion sync** note: sync is a *built-in* `task sync` command configured via `.taskrc`, not something to build. At most, expose a thin `sync` passthrough tool, conditional on `sync.server.url`. Low priority — sync is a user/background concern, rarely an agent action.

## Traps to avoid (deliberately not building)

- **Hand-rolled sync / multi-device** — TaskChampion sync already exists; don't reinvent it.
- **Custom date NLP** — Taskwarrior parses `friday` / `eom` / `+2w`; just document it in `.describe()`.
- **Becoming "just another todo app"** — the value is being the *right way to give Taskwarrior to an agent* (urgency, contexts, GTD workflows), not out-featuring general todo apps.

## Free-floating (not milestone-gated)

- **README "Security & Reliability" section** — the foundation-as-feature writeup: injection-safety, `--` boundary, uuid-first, error classification, contained failures.
- **npm publish** — small change (`prepack` script + package metadata), publishable whenever.
