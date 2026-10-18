# Changelog

All notable changes are recorded here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

First public release candidate.

### Added
- The artifactory: immutable signed versions, provenance, lifecycle, roles, search,
  events and quotas; one operation table behind REST, MCP, A2A, the CLI and OpenAPI.
- Three design systems (Core, Ledger, Atelier) rendered from one portable document.
- The `kages` CLI, a local workspace, `kages push`, and plugins for Claude Code and Cursor.
- Decision guides: turn a technical answer into an interactive guide (a skill and operation).
- Threaded comments, pinned comment mode, share links with guest feedback.
- Documentation site served as Kages at `/docs`.
- Expressions: `$floor`, `$ceil`, `$abs`, `$join`, `$truncate`, compact numbers and relative dates in `$format`; handlers may write a repeated row by an expression path; blocks may declare `watch`.
- Research briefs: `rich-text` citations linked to a new `references` block, attributed quotes, a `glossary` block, captions on `scene` and `diagram`, syntax-coloured `code`, a `dangling-cite` lint rule, a starter and a docs page.

### Security
- Fail-closed authentication, CSRF checks on cookie-authenticated writes, existence
  concealment for private Kages, persisted rate limits, an allowlisted host `fetch`,
  and baseline security headers. See [SECURITY.md](SECURITY.md).
