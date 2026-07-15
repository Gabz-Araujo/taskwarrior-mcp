# taskwarrior-mcp

An [MCP](https://modelcontextprotocol.io) server that gives an AI agent safe, structured access to [Taskwarrior](https://taskwarrior.org) — and, when available, time reporting from [Timewarrior](https://timewarrior.net).

It's not "another todo tool." It's the *right way to hand your real Taskwarrior database to an agent*: urgency-aware prioritisation, GTD-style workflows, and a foundation built to be trusted (injection-safe, validated, errors that guide the model instead of leaking internals).

## Requirements

- **Node.js ≥ 20**
- **Taskwarrior 3.x** (`task` on `PATH`) — required.
- **Timewarrior** (`timew` on `PATH`) — *optional*. If present, the `get_time_summary` tool is enabled automatically; if not, it simply isn't offered.
- **Python 3** — only if you use time tracking (the Taskwarrior→Timewarrior hook is a Python script).

## Install & build

```bash
npm install
npm run build      # compiles to dist/
```

## Connect it to an MCP client

The server speaks MCP over **stdio** — the client launches it as a subprocess; you don't run it yourself. Point your client at the built entry:

```json
{
  "mcpServers": {
    "taskwarrior": {
      "command": "node",
      "args": ["/absolute/path/to/taskwarrior-mcp/dist/index.js"]
    }
  }
}
```

**Environment variables** (all optional):

| Var | Effect |
|---|---|
| `TASKWARRIOR_PATH` | Path to the `task` binary (default: `task` via `PATH`) |
| `TASKRC` | Taskwarrior rc file |
| `TASKDATA` | Taskwarrior data directory |
| `TIMEWARRIOR_PATH` | Path to the `timew` binary (default: `timew` via `PATH`) |

With no `TASKRC`/`TASKDATA`, the server uses your real Taskwarrior database — which is the point. Set `TASKDATA` to a throwaway directory if you want to experiment against a sandbox.

## Tools

**Tasks** (always available):

| Tool | What it does |
|---|---|
| `add_task` | Create a task |
| `list_tasks` | Filter (status/project/tags/due range), sort, limit; defaults to pending |
| `whats_next` | Highest-urgency pending tasks — "what should I focus on" |
| `get_task` | Fetch one task by uuid |
| `modify_task` | Change attributes |
| `complete_task` / `delete_task` | Mark done / soft-delete |
| `start_task` / `stop_task` | Mark a task active / inactive |
| `annotate_task` / `denotate_task` | Add / remove an annotation |
| `add_dependencies` / `remove_dependencies` | Manage blocking relationships (cycle-checked) |

**Time** (only if `timew` is installed):

| Tool | What it does |
|---|---|
| `get_time_summary` | Total + per-tag breakdown of tracked time over a date range |

## Time tracking setup

`get_time_summary` reads from Timewarrior. For it to reflect *task* work, Taskwarrior needs its official `on-modify.timewarrior` hook installed — that hook is what turns `task start`/`stop` into tracked intervals. Install it with the bundled helper:

```bash
./scripts/install-timewarrior-hook.sh
```

It locates the hook shipped with your Timewarrior and copies it into your Taskwarrior hooks directory. The server never installs or bypasses the hook — it's the sanctioned bridge between the two tools.

## Security & Reliability

Most task MCP servers are naive shell wrappers. This one is built as a trust boundary:

- **Injection-safe by construction.** Every Taskwarrior/Timewarrior call uses `execFile` with an argument array — never a shell string. Free-text (descriptions, annotations) is passed after a `--` separator so a value like `project:evil` can't become an attribute mutation, and filters are built from structured fields, never raw filter-language strings.
- **UUIDs validated at two layers.** Tool inputs are checked against a uuid pattern at the MCP boundary (a malformed uuid is rejected before the handler runs), and again in the wrapper — so `get_task("status:pending")` can't smuggle in a filter expression.
- **Errors classified, not leaked.** Domain failures carry a `kind` (`not-found` / `invalid-input` / `execution`) that the MCP layer turns into *guidance for the model* ("call list_tasks to find valid uuids"). Unexpected errors are contained as a generic tool error and logged to stderr — never crashing the server or exposing internals.
- **Structured output.** Every tool returns validated `structuredContent` (Zod-checked), not just text.
- **Capability detection.** Optional integrations (Timewarrior) are detected at startup and only their tools are advertised — the model never sees a tool the machine can't fulfil.

## Development

```bash
npm run typecheck
npm test            # unit + in-memory MCP + integration (needs task, and timew for the timew tests)
npm run test:watch
```

Tests assume the dev environment has `task` (and `timew` for the Timewarrior tests) on `PATH` — the included Nix flake (`nix develop`) provides both.

## Roadmap

See [ROADMAP.md](./ROADMAP.md).
