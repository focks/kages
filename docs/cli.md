# CLI reference

The `kages` command groups its verbs by what you are doing. Every command accepts `--json` for scripts and agents, `-C <dir>` to pick a workspace, and `--local` to use the local workspace even when signed in.

Exit codes are meaningful: `lint` exits 2 on a P0 or P1 finding, `check` exits 1 when something is stale or missing, `doctor --strict` exits 1 when something needs action, and `gitignore` exits 2 when its block is missing or out of date.

<!-- kages:generated:start cli -->
## Auth & remote

```text
  auth login [--url <deployment>]   sign in via the browser (Google)
  auth status | auth logout         show or clear the session
  whoami                            print the signed-in account
  remote <op> [json]                run an operation on your cloud workspace
                                    (e.g. kages remote list_kages)
```

## Learn

```text
  systems                       list design systems
  catalog <system>              print the agent catalog for a system
  contract <ref>                print a component contract (e.g. core/stat@1.0.0)
  schema <system>               print the generation-envelope JSON Schema (tier B)
```

## Author

```text
  validate <file|name> [-s sys] validate; exits 1 on errors
  lint <file|name> [--tier t]   pitfalls with rule id and severity (P0-P3); exit 2 on P0/P1
                                lint --list | lint --explain <rule>
  describe <file|name> [-s sys] text view for agents
  preview  <file|name> [-s sys] headless render snapshot (visibility + outputs)
  screenshot <file|name> [-o out.png|dir/] [--width 390,1200] [--height 900] [--dark] [--scale 1]
  convert  <file> --to envelope|doc [-s sys]
  from-markdown <file.md> [-o out.kage.json] [--title t] [--id i] [-s sys] [--toc auto|always|never] [--mode read|operate|persuade|experience] [--create]
                                write prose, get a Kage: headings → sections, > Note → alerts,
                                tables, adjacent code → tabs, FAQ → accordion, 3+ sections → contents
```

## Manage

```text
  create <file> [--repo r]      store a new Kage (validated + signed)
  patch  <name> <patch.json> [--dry-run] [--advice full|quiet|off]
                                apply RFC 6902 ops, new version; --dry-run reports what would happen
  ls [-s sys] [--state st]      list stored Kages
  search <query> [-s sys]       full-text search
  get <name> [-v n] [-o file]   print a stored Kage document
  versions <name>               revision history with provenance
  publish <name> [--visibility private|workspace|link|public]
  unpublish <name>              pull a published Kage back to draft
  review <name>                 send a draft to review
  deprecate <name>              mark a published Kage deprecated
  archive <name>                archive (hide) a Kage; reversible
  restore <name>                restore an archived Kage to published
  delete <name> --yes           permanently remove a Kage (needs admin)
  export <name> [--format json|markdown] [-o file]
  state <name>                  current app state
  comment <name> <block|-> <text> [--at x,y] [--patch file]
                                add a comment; "-" = about the whole Kage;
                                --at 0.4,0.6 pins it inside the block
  comments <name>               the discussion as an indented thread
  reply <name> <comment-id> <text>
  resolve <comment-id> [--reopen]   resolve (or reopen) a thread
  vote <comment-id> up|down|clear
```

## Inspect & migrate

```text
  context [name] [--json] [--full] [-s sys]
                                the one-call session boot: brief, system rules, a Kage's findings, and what to do next
  migrate <name> [--apply] | migrate --all [--apply]
                                move deprecated props, roles and values to their replacements
  system card <id> [--json|--tokens] | system contrast <id>
                                the design system as one document; contrast exits 2 on a failing pair
```

## Workspace

```text
  init [--yes] [--answers f.json] [--refresh] [--no-brief] [--no-gitignore]
                                create the workspace, scan the project, ask up to 3 questions for the
                                workspace brief, and keep working files out of git
  brief show | set --file b.json | import --file b.md | export [-o f]   [--base-revision n] [--merge]
                                the workspace brief: product truth every agent should load first
  doctor [--fix] [--strict] [--online] [--area a,b] [--json]
  push <file|name> [--server url] [--token t] [--replace] [--publish [--visibility link|public|workspace]]   send a local Kage to a running app so it shows in the Library
  report [--kage <name>] [--include-doc] [--include-config-values] [--out <file>] [--force] [--verify] [--open]   a redacted diagnostic bundle; nothing is sent
                                drift between Kages' files and this version (config, brief, store, hooks, git, skills…)
  hook [--harness h] [--event post|pre|stop]
                                for coding harnesses: reads the hook payload on stdin, checks edited *.kage.json files
  advice-log stats [--days 7] | tail [-n 20] [--json]   [--path file]
                                what the opt-in audit log recorded (rule counts, waiver rates)
  gitignore [--check|--write|--print] [--track-store] [--path f]
                                keep working files out of git with a managed block (exit 2 = missing/stale)
  config list|get <key>|set <key> <value> [--user|--local]|unset <key>|path
                                layered settings: defaults < user < workspace < local < env < flags
```

## Install

```text
  install [--providers claude,codex,…] [--scope project|global] [--yes] [--dry-run] [--no-hooks] [--no-skills] [--mcp print|write] [--force]
                                skills, slash commands, agents and the edit hook; shows what it will write and asks first
  setup hooks [--harness claude,cursor,codex,copilot] [--scope project|global] [--dry-run] [--yes] [--force] [--uninstall] [--no-hooks]
                                add the edit hook to a harness: shows the exact change, asks first, reversible
  setup skills [--harness claude|codex] ...
                                install the authoring skills (one per system)
  update [--check] | check | uninstall [--yes]
                                keep the installed files current; check exits 1 when stale
```

## Dev

```text
  mcp                           run the MCP server (stdio): operations as tools,
                                skill packs as prompts, catalogs as resources
  mcp login [--url <depl>]      sign in so the server acts on your cloud workspace
  mcp info                      what the server exposes + current auth mode
  pack <system> [-o dir]        skill pack (SKILL.md/AGENTS.md/llms.txt/catalog)
  openapi                       OpenAPI 3.1 for the REST adapter
  agent-card                    A2A agent card
  mcp-tools                     MCP tool definitions
```

## Global flags

```text
  --json            raw JSON output (for scripts and agents)
  -s, --system      design system override
  -C, --workspace   local workspace dir (default ./.kages or $KAGES_HOME)
  --local           use the local workspace even when signed in
  -o, --out         write output to a file
  -h, --help        this help
  -v, --version     on a Kage: pick a version; alone: print kages version
```
<!-- kages:generated:end -->

## Related

[Getting started](getting-started.md) shows the first few commands in order, and [hooks](hooks.md) covers the edit hook.
