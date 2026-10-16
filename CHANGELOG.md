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
- Decision guides, a guided first-use builder in the docs, and json-render import and export.
- Threaded comments, pinned comment mode, share links with guest feedback.
- Documentation site served as Kages at `/docs`.

### Security
- Fail-closed authentication, CSRF checks on cookie-authenticated writes, existence
  concealment for private Kages, persisted rate limits, an allowlisted host `fetch`,
  and baseline security headers. See [SECURITY.md](SECURITY.md).
