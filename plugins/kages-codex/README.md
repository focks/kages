# Kages for Codex

Version 0.1.0. The Kages MCP server (`https://kages-focks-projects.vercel.app/api/mcp`) and skills: one authoring guide per design system (`kages-core`, `kages-ledger`, `kages-atelier`), `kages-decision-guide` and `kages-login`.

## Install

```
codex plugin marketplace add focks/kages
```

Then install **Kages** from the plugin directory in Codex. The repository's `.agents/plugins/marketplace.json` lists it.

## Access level

The endpoint is **anonymous** by default: read public Kages and try the tools against the demo workspace. To act on your own workspace use the CLI: `kages auth login`, then `codex mcp add kages -- kages mcp`.

Generated from the Kages sources with `npm run build:plugins`; do not edit by hand.
