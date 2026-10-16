# Kages plugin

Everything you need to author, review and refine Kages from Claude Code, installed in one step (version 1.0.0):

- **MCP tools**: the full Kages operation set, served over the remote endpoint at `https://kages-focks-projects.vercel.app/api/mcp`.
- **Skills**: one authoring guide per design system (`kages-core`, `kages-ledger`, `kages-atelier`) with its system card, plus `kages-decision-guide` for turning a technical question into an interactive guide.
- **Hook**: checks `*.kage.json` files as they are edited and reports problems once (needs the `kages` CLI on your PATH; silent without it).

## Install

```
/plugin marketplace add focks/kages
/plugin install kages@kages
```

The first time, Claude Code asks you to approve the hook; review it with `/hooks`.

## Access level

Out of the box the endpoint is **anonymous**: you can read public Kages and try the tools against the demo workspace. To act on **your own** workspace:

- **Authenticated remote**: add an `Authorization: Bearer <token>` header to the `kages` server (token from `kages auth login` → `~/.kages/config.json`).
- **Local CLI (stdio)**: `kages auth login`, then `claude mcp add kages -- kages mcp`. It routes to your cloud workspace when signed in, else the local `./.kages`.

## Your own server

Build the plugin against a private deployment: `KAGES_PLUGIN_MCP_URL=<your server>/api/mcp npm run build:plugins`.

These files are generated from the engine; edit the sources in `src/`, never these, and regenerate with `npm run build:plugins`.
