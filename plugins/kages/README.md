# Kages plugin

Everything you need to author, review and refine Kages from Claude Code, installed in one step (version 0.2.0):

- **MCP tools**: the full Kages operation set, served by the signed-in stdio server (`kages mcp`, fetched with npx).
- **Skills**: one authoring guide per design system (`kages-core`, `kages-ledger`, `kages-atelier`) with its system card, plus `kages-decision-guide` for turning a technical question into an interactive guide and `kages-login` for signing in to your workspace.
- **Hook**: checks `*.kage.json` files as they are edited and reports problems once (needs the `kages` CLI on your PATH; silent without it).

Conversion skills: kages-markdown-to-kage, kages-data-to-kage (CSV/TSV/JSON/spreadsheets), kages-document-to-kage (PDF/DOCX/text) and kages-web-to-kage. Retrieve any recipe through get_authoring_guide with its name.

## Install

Complete https://app.getkages.com/onboarding, then run `kages auth login`; the plugin's stdio server reuses that session. Verify get_setup from the agent, then get_context and get_authoring_guide.

```
/plugin marketplace add focks/kages
/plugin install kages@kages
```

The first time, Claude Code asks you to approve the hook; review it with `/hooks`.

## First-time setup

Open https://app.getkages.com/onboarding. Run `kages auth login` once; the plugin's stdio server uses that session and refreshes its token. Until then it is anonymous. From the agent call `get_setup` to verify its actual workspace, then `get_context` for the authoring skill. `get_authoring_guide` retrieves references as a tool; MCP prompts need not be supported.

## Access level

Until you run `kages auth login` the server is **anonymous**: you can read public Kages and try the tools against the demo workspace. Once signed in it routes to **your own** workspace. For intentional offline work run `kages mcp --local` yourself.

## Your own server

Sign in to a private deployment with `kages auth login --url <your server>`. (The Cursor and Codex plugins still take `KAGES_PLUGIN_MCP_URL=<your server>/api/mcp npm run build:plugins`.)

These files are generated from the engine; edit the sources in `src/`, never these, and regenerate with `npm run build:plugins`.
