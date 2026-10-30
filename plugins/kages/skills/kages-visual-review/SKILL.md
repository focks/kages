---
name: kages-visual-review
description: "The visual review loop: render a Kage in headless Chrome and get a PNG plus objective checks (failed blocks, sideways scroll, broken images, console errors, unreadably small chart text). Covers the kages screenshot command, the render_kage MCP tool, the /render page, and how to use findings to fix a document. Read when you want to see what you built, or when changing src/cli/screenshot.ts or src/app/render."
---

# Visual review

An agent that cannot see its work guesses. `kages screenshot` renders a document
in headless Chrome and returns images and findings, so the loop is
author → render → read the findings (and look) → fix.

```
kages screenshot my.kage.json --width 390,1200 --dark -o shots/
kages screenshot my-stored-kage --strict          # exit 1 on any finding
```

Over MCP the local server (`kages mcp`) adds a **`render_kage`** tool that returns
the screenshot as an *image content block* plus the findings as text. It is
local-only (needs Chrome and a running app) and is never on the hosted HTTP route.

## What it needs

- **Chrome/Chromium** — found on PATH or via `KAGES_CHROME` / `CHROME_PATH`.
  Where Chrome refuses its sandbox, pass `--no-sandbox` (MCP: `KAGES_CHROME_NO_SANDBOX=1`).
- **A running Kages app** — `npm run dev`; `--url` or `KAGES_URL` to point at it
  (otherwise your app 3000/3100/3001 are probed). Both absences give an error that
  says what to do, never a hang.
- Node 22+ (built-in WebSocket; the DevTools protocol is spoken directly, no
  browser-automation dependency).

## How it works

`/render` (public, shell-free, in the middleware allow-list) paints only the document
handed to `window.__kages.render(doc, {system, dark})`; the promise resolves after the
design system, fonts and images settle. The CLI then measures and captures. The page
has no data access of its own, so exposing it exposes nothing.

## The findings (what to do about each)

| Finding | Meaning / fix |
| --- | --- |
| a block failed to render | an unresolved type or bad block; run `kages validate` for the fix |
| the page scrolls sideways | something is wider than the viewport; the overflowing blocks are named |
| an image did not load | bad or blocked source (only https, local paths and raster data URLs render) |
| console error | a runtime exception inside the render |
| text too small to read in @block | an SVG figure is scaled below 8px text; wide figures get a minimum width and scroll, so this means very small text or an extreme drawing width |
| taller than 12000px | the capture is cut; split the page |

The checks are objective, not taste: still *look* at the image for hierarchy, spacing
and emptiness. Review at 390 (phone) and 1200 (desktop), and `--dark` once.

## Measuring pitfalls (learned the hard way)

- Read page height as the max of `documentElement.scrollHeight`, `body.scrollHeight`
  and the lowest element, twice; a single early read once cut a page off mid-way.
- Hide the Next dev indicator (`nextjs-portal`) before capturing, or it appears in
  every screenshot as a stray badge.
- A wide SVG scaled to a phone width shrinks its text with it; this was found by the
  loop itself and fixed with `.kg-scene--wide` (minimum width, scroll inside the figure).

## Tests

`src/cli/screenshot.test.ts`: pure parts always run; the real-browser tests run with
`KAGES_TEST_URL=<your app url>` (and `KAGES_CHROME_NO_SANDBOX=1` if needed).
