# Kages plugin

Everything you need to author Kages from Claude Code, installed in one step:

- **MCP tools** — the full Kages operation set (create, patch, list, publish, …),
  served over the remote endpoint at `https://kages-focks-projects.vercel.app/api/mcp`.
- **Skills** — one authoring guide per design system (`kages-core`, `kages-ledger`,
  `kages-atelier`) with the catalog, expression/action reference, and rules.

## Install

```
/plugin marketplace add focks/kages
/plugin install kages@kages
```

The MCP server and skills activate automatically — no `claude mcp add`, no file copying.

## Access level

Out of the box the endpoint is **anonymous**: you can read public Kages and try
the tools against the demo workspace. To act on **your own** workspace, use one of:

- **Authenticated remote** — add an `Authorization: Bearer <token>` header to the
  `kages` server (token from `kages auth login` → `~/.kages/config.json`).
- **Local CLI (stdio)** — `kages auth login` then register the local server:
  `claude mcp add kages -- kages mcp`. It routes to your cloud workspace when
  signed in, else the local `./.kages`.

The bundled skills are generated from the engine; regenerate with `npm run build:plugin`.
