# Taskwarrior MCP — Roadmap

_Last updated: 2026-07-15_

## Status

**Done: M3-close, M4, M4.5.**

- **M3-close** — `whats_next` + foundation layer: enriched `list` (sort/limit/due-range/`all`, default-pending), structured output, tool annotations, self-describing schemas, `kind`-classified errors with model guidance, contained unexpected errors, version from `package.json`.
- **M4** — annotations (`annotate`/`denotate`), dependencies (`add_dependencies`/`remove_dependencies`, cycle-checked), `start`/`stop`.
- **M4.5** — Timewarrior as an optional capability: read-only wrapper, `get_time_summary`, startup detection + conditional registration. Setup aid (`scripts/install-timewarrior-hook.sh`) + README shipped.

Four-tier test suite (pure unit, client integration, in-memory MCP, end-to-end).

## Milestones

### ✅ M4 — Domain completeness (done)
- `annotate` / `denotate`, dependencies (dedicated tools, cycle-checked), `start` / `stop`.
- Implemented as dedicated wrapper methods + tools (dependencies ended up as their own tools, not `modify` options, to preserve cycle detection + safe removal).

### ✅ M4.5 — Time reporting via Timewarrior (done — first optional capability)
- Read-only `Timewarrior` wrapper over `timew export`; `get_time_summary` tool.
- Established the **capability-provider pattern** (see below): startup detection + conditional registration.

### M5 — MCP-native workflows (new MCP concepts) ← next
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
