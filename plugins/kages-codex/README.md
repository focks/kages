# Kages for Codex

Version 0.1.2. The Kages MCP server (`https://app.getkages.com/api/mcp`) and skills: one authoring guide per design system (`kages-core`, `kages-ledger`, `kages-atelier`), `kages-decision-guide` and `kages-login`.

Conversion skills: kages-markdown-to-kage, kages-data-to-kage (CSV/TSV/JSON/spreadsheets), kages-document-to-kage (PDF/DOCX/text) and kages-web-to-kage. Retrieve any recipe through get_authoring_guide with its name.

## Install

Complete https://app.getkages.com/onboarding. Browser/CLI login does not authenticate this HTTP MCP endpoint; configure its Bearer credential or use signed-in stdio. Verify get_setup from the agent, then get_context and get_authoring_guide.

```
codex plugin marketplace add focks/kages
```

Then install **Kages** from the plugin directory in Codex. The repository's `.agents/plugins/marketplace.json` lists it.

## First-time setup

Open https://app.getkages.com/onboarding. Browser login, CLI login and an HTTP MCP credential are separate. The plugin’s HTTP connection is anonymous until its Bearer credential is configured. For managed token refresh use signed-in stdio instead. From the agent call `get_setup` to verify its actual workspace, then `get_context` for the authoring skill. `get_authoring_guide` retrieves references as a tool; MCP prompts need not be supported.

## Access level

The endpoint is **anonymous** by default: read public Kages and try the tools against the demo workspace. To act on your own workspace use the CLI: `kages auth login`, then `codex mcp add kages -- kages mcp`.

Generated from the Kages sources with `npm run build:plugins`; do not edit by hand.
