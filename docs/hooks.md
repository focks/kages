# Edit hooks

Agents that write `*.kage.json` files directly get no feedback until someone validates them. The edit hook closes that gap: after an edit it checks the file and tells the agent about new problems, once.

## Install

```sh
kages setup hooks --harness claude --dry-run
kages setup hooks --harness claude
```

Supported harnesses are Claude Code, Cursor, Codex and GitHub Copilot, each in its own documented format. The command shows the exact change, asks first, keeps your other settings, and `--uninstall` restores the file exactly. Grok is not supported yet because its hook format could not be verified.

## What it does

- After an edit it validates the file and runs the cheap lint rules, and reports only findings that are new.
- Before a write (Claude Code) it refuses content that cannot be a valid Kage, such as broken JSON; it never blocks on lint.
- At the end of a turn it runs the deeper checks over every file edited, once.
- It stays silent on anything that is not a Kage file, on huge or unreadable input, and when `kages` is not installed.

## Settings

```sh
kages config set hook.quiet true        # no "looks fine" acknowledgement
kages config set hook.enabled false     # turn it off for this project
```

## Trust

Claude Code and Codex ask you to approve new hooks the first time. Review them with `/hooks`.
