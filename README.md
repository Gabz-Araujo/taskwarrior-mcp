# taskwarrior-mcp

An [MCP](https://modelcontextprotocol.io) server for [Taskwarrior](https://taskwarrior.org), with optional time reporting from [Timewarrior](https://timewarrior.net). It lets an MCP client (Claude Desktop, Claude Code, etc.) create, query, prioritise, and review your tasks.

## Requirements

- **Node.js ≥ 20**
- **Taskwarrior 3.x** (`task` on `PATH`)
- **Timewarrior** (`timew` on `PATH`) — optional; enables the time-summary tool
- **Python 3** — optional; only for Taskwarrior's Timewarrior hook (time tracking)

## Install

```bash
npm install
npm run build
```

## Usage

The server runs over stdio; your MCP client launches it. Point the client at the built entry:

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

Optional environment variables: `TASKWARRIOR_PATH`, `TASKRC`, `TASKDATA`, `TIMEWARRIOR_PATH`. With none set, the server uses your existing Taskwarrior data.

## Capabilities

**Tools** — add, list, get, modify, complete, delete, start, stop, annotate/denotate, add/remove dependencies, and `whats_next` (urgency-ranked). Recurring tasks are supported on creation. When Timewarrior is available, `get_time_summary` is also exposed.

**Prompts** — `daily-triage` and `weekly-review` (GTD-style reviews).

**Resources** — `taskwarrior://projects`, `taskwarrior://project/{name}`, `taskwarrior://stats`.

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
