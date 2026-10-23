# Kages plugins

Generated from one source (`src/plugin/generate.ts`); regenerate with `npm run build:plugins` and verify with `npm run check:plugins`. Version 0.1.0.

| Harness | Directory | Install |
| --- | --- | --- |
| Claude Code | `plugins/kages` | `/plugin marketplace add focks/kages`, then `/plugin install kages@kages`; approve the hook with `/hooks` |
| Cursor | `plugins/kages-cursor` | Add the folder as a local plugin (it carries `.cursor-plugin/plugin.json`) |
| Codex | `plugins/kages-codex` | `codex plugin marketplace add focks/kages`, then install Kages from the plugin directory |

**Planned, not generated:** VS Code (`chat.pluginLocations`) and Grok. A target is added only after its current official plugin format is captured and validated; see `src/plugin/generate.ts`.

## Pointing at your own server

`KAGES_PLUGIN_MCP_URL=<your server>/api/mcp npm run build:plugins`. The plugin embeds no credentials: to act on your own workspace, supply a bearer token through your harness's MCP header or environment settings.

## Versions

`package.json` is the only version. Every manifest, the marketplace entry, `kages --version` and the installed files' `kages-version` come from it.
