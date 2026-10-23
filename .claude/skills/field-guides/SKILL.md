---
name: field-guides
description: "Chaptered research guides and handbooks: responsive navigation, host chapter links, searchable evidence, rich disclosures, and behavioral review."
---

# Field guides

Use `guide` as the root for a chaptered handbook. Use `toc` for one continuous
page and `tab-panel` for a small set of alternatives. The complete starter is
`artifact-field-guide` in `src/packs/guide-examples.ts`.

- Declare `chapters: [{id,label}]` (up to 40 unique lowercase slugs). Initialize
  `state.chapter` to the first id, bind guide `value` to it, and handle
  `change` by setting it from `$event:id`.
- Put chapter sections in `children`; give each `visible:$eq(state.chapter,id)`.
  The chapter opening is an h1. `actions` and `footer` accept ordinary blocks.
- `mark`, `description`, `eyebrow`, `note`, and a semantic `palette` make the
  reading frame recognizable. `themeToggle:false` hides the frame-local theme
  control. The theme switch does not change dashboard settings.
- For an evidence catalog, combine category and title filters, a result count,
  repeated `disclosure` entries, an empty state, and clear/reset. Use stable
  repeat keys. Each disclosure has title, category (`eyebrow`), evidence label
  (`badge`), and real child blocks for detail, remediation, links and code.
- Label documented behavior, reports, recommendations and illustrative data
  distinctly. Cite primary sources and state research limits. Never present a
  report as independently reproduced without evidence.

## Navigation and the sandbox

The component changes document state; only an opted-in host owns the URL.
Full-page `/preview/` and `/k/` pass `navigation`; a root guide also gets a fill
frame in full-page preview so the rail can stick. Library cards and `/render`
keep local navigation. The host derives an allowlist from the root guide's
static chapter props and accepts only those fragment slugs. Never forward an
arbitrary URL from an artifact. A guide's initial link, Back/Forward, menu and
pagination must select the same chapter. Chapter changes focus the reading
canvas and reset its scroll; typing or changing controls within a chapter must
not do so. An empty fragment means the first chapter; unrelated anchors leave
chapter state alone.

Frame events `kages-navigate` and `kages-location` are trusted runtime plumbing,
not new executable document APIs. Keep every message bounded and validated.
Pinned old runtimes retain old behavior; newly saved versions receive the new
capabilities. Do not rewrite old signed assets.

## Review

Run `npm run build:ds`, then the guide component and pack tests. Exercise
`src/runtime/guide-browser.test.ts` with `KAGES_TEST_URL` set. It uses local API
fixtures and never writes a workspace. Check deep links, Back/Forward, menu
Escape/focus, theme toggle, retained checklist/disclosure state, and wheel
scroll. Render overview and evidence chapters at 390px and desktop, in both
themes. Current state survives chapter navigation, not reload by default; use
existing host persistence only when the host supports the intended guarantee.
