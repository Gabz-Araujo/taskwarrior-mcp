# taskwarrior-mcp

[![CI](https://github.com/Gabz-Araujo/taskwarrior-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Gabz-Araujo/taskwarrior-mcp/actions/workflows/ci.yml)

An [MCP](https://modelcontextprotocol.io) server for [Taskwarrior](https://taskwarrior.org), with optional time reporting from [Timewarrior](https://timewarrior.net). It lets an MCP client (Claude Desktop, Claude Code, etc.) create, query, prioritise, and review your tasks.

## Requirements

- **Node.js ≥ 20**
- **Taskwarrior 3.x** (`task` on `PATH`)
- **Timewarrior** (`timew` on `PATH`) — optional; enables the time-summary tool
- **Python 3** — optional; only for Taskwarrior's Timewarrior hook (time tracking)

## Install

Published on npm — no clone or build required. Point your MCP client at it with `npx`:

```json
{
  "mcpServers": {
    "taskwarrior": {
      "command": "npx",
      "args": ["-y", "@gabz-araujo/taskwarrior-mcp"]
    }
  }
}
```

Or run it with Nix (bundles Taskwarrior + Timewarrior):

```bash
nix run github:Gabz-Araujo/taskwarrior-mcp
```

The server runs over stdio; your MCP client launches it. Optional environment variables: `TASKWARRIOR_PATH`, `TASKRC`, `TASKDATA`, `TIMEWARRIOR_PATH`. With none set, the server uses your existing Taskwarrior data.

### From source

```bash
npm install && npm run build
# then point the client at: node /absolute/path/to/dist/index.js
```

## Capabilities

**Tools** — add, list, get, modify, complete, delete, start, stop, annotate/denotate, add/remove dependencies, `whats_next` (urgency-ranked), `next_action` (the single ready task to do now), and `create_project` (scaffold a dependency graph in one call). User-defined attributes (UDAs) are supported on add/modify/filter when defined. Recurring tasks are supported on creation. When Timewarrior is available, `get_time_summary` is also exposed.

**Prompts** — `daily-triage`, `weekly-review`, `plan-project`, `unblock`, `GTD`, and `PARA`.

**Resources** — `taskwarrior://projects`, `taskwarrior://project/{name}`, `taskwarrior://stats`, and `taskwarrior://custom-fields` (when UDAs are defined).

## Time tracking

`get_time_summary` reads from Timewarrior. For `start`/`stop` to feed it, install Taskwarrior's official hook:

```bash
./scripts/install-timewarrior-hook.sh
```

## Development

```bash
npm run typecheck
npm test
```

Tests require `task` (and `timew` for the time-tracking tests) on `PATH`; the included Nix flake (`nix develop`) provides both.

## License

MIT
