---
name: kages-docs
description: "The documentation site: docs/*.md converted to Kages by the same outline converter agents use, served at /docs, with generated CLI and operation references and three gates (build, links, visual). Read before editing docs/ or src/docs."
---

# kages-docs

`docs/*.md` is the source; `docs/docs.config.json` lists the pages (order, summary) and the design
system (Atelier). `src/docs/build.ts` (pure) turns each page into a Kage with `outlineToKage` and
a generated index; `src/docs/load.ts` reads the folder; `/docs/[[...slug]]` serves it (static, public,
read-only; `outputFileTracingIncludes` ships the markdown). Never hand-edit generated JSON: there is none.

- **Write in human voice**, plain markdown: `#` title, `##` sections, tables, fenced code, `> Note:` callouts.
  Pages with three or more sections get a contents sidebar and heading anchors.
- **Link pages** with ordinary relative links (`cli.md`, `cli.md#global-flags`). They are rewritten to
  routes and checked: a missing page, or a fragment the target does not have, fails the build. Only pages
  with a contents sidebar have anchors.
- **Generated regions**: `docs/cli.md` (the CLI's own help) and `docs/mcp.md` (the operation table) hold
  `<!-- kages:generated:start name -->` regions filled by `npm run docs:gen`; `npm run docs:check` and
  `docs.test.ts` fail when they are stale. Add a command or op, run `docs:gen`.
- **Gates** (`npm test`): every page and the index validate with zero errors and have **zero lint findings**
  in all three systems; every `kages <verb>` written in a page must exist; unlisted pages fail. Visual gate
  (`npm run docs:visual`, needs Chrome and the app) renders each page at 390 and 1200 px and fails on any
  layout finding.
- A page that renders badly is a converter bug: fix it in `src/engine/outline.ts`, not in the page.

## One-repository feel (rules the build tests enforce)

- Every page opens with a sentence under its title, has a `group` in `docs.config.json` (Start, Guides, Reference, Operate) and a title that is a noun phrase, never "The …".
- Generator markers (`<!-- kages:generated:… -->`) stay in the source and are stripped before conversion; they must never print.
- The one interactive page (`/docs/build-a-guide`) renders its title and intro through the same converter and sits in the same `DocsView` frame, so it is not a second design. New interactive lessons go through `docsNav` in `src/docs/nav.ts`.
