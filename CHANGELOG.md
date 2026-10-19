# Changelog

All notable changes are recorded here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

First public release candidate.

### Added
- Every Kage view (the `/k/<id>` share page and the preview overlay) carries a collapsed
  "Use this Kage" panel: install the CLI, fetch and check this Kage, connect an agent over
  MCP (local and remote) and call it over REST, each command copyable.
- The artifactory: immutable signed versions, provenance, lifecycle, roles, search,
  events and quotas; one operation table behind REST, MCP, A2A, the CLI and OpenAPI.
- Three design systems (Core, Ledger, Atelier) rendered from one portable document.
- The `kages` CLI, a local workspace, `kages push`, and plugins for Claude Code and Cursor.
- Decision guides: turn a technical answer into an interactive guide (a skill and operation).
- Threaded comments, pinned comment mode, share links with guest feedback.
- Documentation site served as Kages at `/docs`.
- Expressions: `$floor`, `$ceil`, `$abs`, `$join`, `$truncate`, compact numbers and relative dates in `$format`; handlers may write a repeated row by an expression path; blocks may declare `watch`.
- Nine use-case examples (quiz, flashcards, architecture explainer, game, pricing proposal, trip itinerary, incident runbook, meeting notes, portfolio) and a Use cases docs page.
- Faster frames: design-system files and fonts download in parallel, hashed assets are cached immutably, long repeated lists are skipped off screen, and large repeats expand faster; `npm run bench:render` measures it.
- Fixed: `kages screenshot` returned blank space below the first screen for artifacts in a sandboxed frame.
- Research briefs: `rich-text` citations linked to a new `references` block, attributed quotes, a `glossary` block, captions on `scene` and `diagram`, syntax-coloured `code`, a `dangling-cite` lint rule, a starter and a docs page.

### Security
- Fail-closed authentication, CSRF checks on cookie-authenticated writes, existence
  concealment for private Kages, persisted rate limits, an allowlisted host `fetch`,
  and baseline security headers. See [SECURITY.md](SECURITY.md).
