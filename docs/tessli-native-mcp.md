# Tessli Native MCP

Status: **current local MCP v2 implementation guide**

Tessli's current MCP server exposes only repository-managed catalogue and UI-intelligence metadata through a local stdio process. It is the only supported MCP transport today.

It does not connect to Landingfolio or another provider, retrieve screenshots, inspect a project repository, access Tessli accounts, or modify data.

## Requirements

- Node.js 22 or later;
- a local checkout of `itsdeepaks/tessli`;
- locked dependencies installed under `web/`.

## Install

From the repository root:

```bash
cd web
npm ci
```

## Run

```bash
cd web
npm run mcp
```

A stdio server waits for an MCP client on standard input and writes protocol messages to standard output. Operational messages use standard error only.

## Client configuration

Use an absolute path to the Tessli checkout. A generic stdio configuration is:

```json
{
  "mcpServers": {
    "tessli": {
      "command": "npm",
      "args": ["--prefix", "/absolute/path/to/tessli/web", "run", "mcp"]
    }
  }
}
```

Some clients use a top-level `servers` key or require an explicit `type: "stdio"`. Follow that client's current MCP configuration format while preserving the same local command and absolute path.

## Current V3.8 tools

### `find_sources`

Accepts a structured task with optional surface, framework, needs, and exclusions. Returns at most eight deterministic, explained canonical source choices.

### `get_source`

Returns one exact stable source ID or slug as compact canonical guidance: what it helps with, what to inspect, recorded access routes, caveats, and differentiated alternatives.

### `find_alternatives`

Returns one exact source with one to four recorded, differentiated alternatives. It does not rank sources universally or make a live provider comparison.

### `get_collection`

Returns one published Collection by exact ID or slug, preserving editorial stage order and compact canonical source guidance.

### `create_research_brief`

Returns a compact, deterministic research handoff from the same structured task retrieval used by `find_sources`.

## V1 replacement boundary

The previous seven-tool v1 list is not registered as MCP aliases: registered stdio tools are necessarily visible through `ListTools`, which would contradict the focused five-tool contract. The direct `getNativeResourceProfile` library adapter remains only for an internal source-profile parity check; it is not an MCP tool.

## Remote MCP availability

Hosted Streamable HTTP MCP is not available. It is deferred to V3.16, after local task retrieval and compact static public representations/discovery (V3.9–V3.10) are stable. Any future hosted transport must wrap the same pure read-only layer, expose public data only, and add bounded inputs, origin validation, rate limits, safe logging, timeouts, and monitoring. It must never read browser-local Boards, write Tessli state, fetch providers, proxy paid/private content, or accept provider credentials.

## Data and retention

The process reads committed JSON modules already used by Tessli. It keeps no database, cache, log file, or user profile.

Tool calls are not persisted by Tessli. The invoking MCP client may have its own logging or retention policy.

## Security boundary

The server:

- has no HTTP listener;
- uses no environment credential;
- performs no network request;
- exposes no write tool;
- accepts no arbitrary path or URL to fetch;
- reads no project source or user file;
- returns no provider-rendered screenshot or source asset;
- caps all list-producing tools;
- labels repository classifications and non-live verification clearly.

It also keeps routine output compact: task fit, action, limitation, and alternatives come first; provenance and operational status are diagnostic depth on demand.

## Research boundary

Use results to choose sources and extract principles. Do not treat Tessli metadata or a provider reference as permission to copy layouts, illustrations, copy, brand assets, templates, or restricted code.

## Development verification

```bash
cd web
node --test tests/mcp-native-tools.test.mjs tests/mcp-stdio.test.mjs
npm run typecheck
npm run lint
npm test
npm run catalogue:check
npm run build
```
