# Changelog

All notable changes are recorded here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.3] — 2026-10-24

- Added an opt-in public gallery at `/gallery`, search and ranking, one removable upvote per account, and matching CLI/MCP/REST operations. Publishing to the gallery makes a Kage public; revoking access or saving a new draft withdraws the listing.
- Replaced landing-page technical counters with benefits covering self-hosting, AI choice, interactive content, sharing, version history and exports. Fixed narrow-screen overflow from installation commands.


First public release candidate.

### Removed
- The Studio editor (`/studio`, `src/studio`). A Kage is edited by an agent through the CLI, MCP or REST. **New Kage** in the Library
  now creates one from a starter, and `/studio` redirects to the Library.

### Removed
- Templates: the `templates` scope and its Library button, the `search_templates` operation, and the special `templates` repo. Shipped examples are ordinary Kages in an `examples` project, and a clone stays in the source's project. Existing `templates` projects simply become ordinary projects.

### Added
- A Codex plugin: `plugins/kages-codex` (portable `plugin.json`, `mcp.json`, skills) and `.agents/plugins/marketplace.json`, so `codex plugin marketplace add focks/kages` lists Kages. Generated with the other targets; skills carry no Claude-only syntax.
- One link for a whole project: `/r/<uuid>` lists the project's Kages that are published with a public link (live), and sharing with `publish_all` / `kages project share --all` / **Share all** publishes everything in the folder with a link at once (archived and invalid Kages are skipped), with `/r/<uuid>.md` for agents, a **Share project** panel in the Library, `kages project share|link|unshare`, and the `share_repo`, `unshare_repo` and `get_repo_share` operations.
- A hidden note in a share page's raw HTML points agents at the markdown and JSON routes; and a `kages-login` skill ships with the installer and plugins.
- Workspace designs: define your own colours (light and dark), type and corner radius once, keep several per workspace, choose one
  when you create a Kage and change it later. New in the app (**Designs**, with a live preview and a one-colour palette generator),
  the CLI (`kages designs`) and the operation table (`list_designs`, `get_design`, `set_design`, `delete_design`, `set_kage_design`).
  Values are validated against a closed shape (hex colours, a 25-font Google Fonts list, integer radii), contrast is checked against the
  built-in pairs, and each Kage version pins the design it was saved with. See `docs/designs.md`.
- Stack columns refit and stat cards wrap on narrow canvases, so a four-up KPI row stacks on a phone instead of clipping its figures.
- `/agents.md`: a site guide for agents with this deployment's own CLI, MCP and REST commands and the order to call operations in.
- A share link answers agents in markdown: `/k/<uuid>.md`, or `/k/<uuid>` with `Accept: text/markdown`, with install and call
  instructions first and the Kage's own text fenced as untrusted data. Pages advertise it with a `Link` header and `<link rel="alternate">`;
  `/llms.txt` indexes it. The "Are you an agent?" panel gains a copy-a-prompt button.
- Every Kage view (the `/k/<id>` share page and the preview overlay) carries a collapsed
  "Are you an agent?" panel of agent instructions: install the CLI, fetch and check this Kage, connect an agent over
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
