# Hook payload fixtures

Recorded from each harness's current official documentation on 2026-10-16 (nothing here
is assumed from memory). `src/hooks/harnesses.ts` carries the same URLs and date as
`lastVerified`; `kages doctor` warns when an adapter's date is more than 180 days old.

| Harness | Source |
| --- | --- |
| Claude Code | https://code.claude.com/docs/en/hooks (PostToolUse, PreToolUse, Stop; stdout `hookSpecificOutput.additionalContext`, `decision: block`) |
| Cursor | https://cursor.com/docs/agent/hooks (`hooks.json` version 1; `afterFileEdit` input `file_path`+`edits`; observational output `additional_context`, `followup_message`) |
| GitHub Copilot | https://docs.github.com/en/copilot/reference/hooks-reference (`.github/hooks/*.json` version 1; `postToolUse` output `additionalContext`; camelCase and VS Code-compatible PascalCase inputs) |
| Codex | https://learn.chatgpt.com/docs/hooks (`.codex/hooks.json`; `apply_patch` payload; `hookSpecificOutput.additionalContext`) |
| Grok | not verified: no official schema could be found, so there is no adapter (listed as planned) |

The Claude examples in the docs show a `file_text` field for edits; real Edit/Write
payloads carry `file_path` (and `old_string`/`new_string` or `content`), so the Claude
adapter reads `file_path` and falls back to `edits[].file_path`.
