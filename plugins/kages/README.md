# Kages plugin

Everything you need to author, review and refine Kages from Claude Code, installed in one step (version 0.1.2):

- **MCP tools**: the full Kages operation set, served over the remote endpoint at `https://app.getkages.com/api/mcp`.
- **Skills**: one authoring guide per design system (`kages-core`, `kages-ledger`, `kages-atelier`) with its system card, plus `kages-decision-guide` for turning a technical question into an interactive guide and `kages-login` for signing in to your workspace.
- **Hook**: checks `*.kage.json` files as they are edited and reports problems once (needs the `kages` CLI on your PATH; silent without it).

Conversion skills: kages-markdown-to-kage, kages-data-to-kage (CSV/TSV/JSON/spreadsheets), kages-document-to-kage (PDF/DOCX/text) and kages-web-to-kage. Retrieve any recipe through get_authoring_guide with its name.

## Install

Complete https://app.getkages.com/onboarding. Browser/CLI login does not authenticate this HTTP MCP endpoint; configure its Bearer credential or use signed-in stdio. Verify get_setup from the agent, then get_context and get_authoring_guide.

```
/plugin marketplace add focks/kages
/plugin install kages@kages
```

The first time, Claude Code asks you to approve the hook; review it with `/hooks`.

## First-time setup

Open https://app.getkages.com/onboarding. Browser login, CLI login and an HTTP MCP credential are separate. The plugin’s HTTP connection is anonymous until its Bearer credential is configured. For managed token refresh use signed-in stdio instead. From the agent call `get_setup` to verify its actual workspace, then `get_context` for the authoring skill. `get_authoring_guide` retrieves references as a tool; MCP prompts need not be supported.

## Access level

Out of the box the endpoint is **anonymous**: you can read public Kages and try the tools against the demo workspace. To act on **your own** workspace:

- **Authenticated remote**: add an `Authorization: Bearer <token>` header to the `kages` server (token from `kages auth login` → `~/.kages/config.json`).
- **Local CLI (stdio)**: `kages auth login`, then `claude mcp add kages -- kages mcp`. It routes to your cloud workspace when signed in, otherwise creation requires login. For intentional offline work use `--local`.

## Your own server

Build the plugin against a private deployment: `KAGES_PLUGIN_MCP_URL=<your server>/api/mcp npm run build:plugins`.

These files are generated from the engine; edit the sources in `src/`, never these, and regenerate with `npm run build:plugins`.
