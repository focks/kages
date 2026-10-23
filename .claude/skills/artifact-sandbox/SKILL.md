---
name: artifact-sandbox
description: Opaque artifact frames, immutable runtime assets, capability messages, and DOM-free host integration.
---

# Artifact sandbox

`KageRenderer` is always the parent wrapper. `EmbeddedKageRenderer` runs only in the separately bundled browser entry; never import it into an app page.

The iframe sandbox omits `allow-same-origin`. Its CSP permits only integrity-pinned runtime and design-system scripts, declared styles/fonts and passive images. Direct fetch, nested frames, form submission and base changes are denied. Host operations go through a transferred MessagePort after checking the sending window. Only HostBridge's explicitly selected methods are callable; policy and credentials stay in the parent.

`npm run build:frame` bundles the engine, renderer and React into `public/runtime/<digest>.js`, writes its manifest, and archives the current design assets. `Store.writeVersion` includes those asset pins in the signed document. Never delete previously published runtime or design-system asset versions. A missing pinned asset is an error, never permission to substitute current bytes. Legacy documents without asset pins use current assets; their original bytes cannot be recovered retrospectively.

Frames report layout rectangles and measurement data. Comment pins use those rectangles; screenshots use the reported metrics. Host UI must never inspect iframe DOM or weaken the sandbox to recover old DOM access. A document change restarts its frame, clearing session state and error boundaries. Theme changes use messages without restarting execution.

Verification: runtime sandbox unit tests, the compromised-script browser test, and `KAGES_TEST_URL=<local app> KAGES_CHROME_NO_SANDBOX=1 node --test src/cli/screenshot.test.ts`. Persisted asset pin tests must verify hashes for runtime JS, component JS and both stylesheets. Google Fonts remain external stylesheet/font resources; their bytes are not archived with the bundle.

## Scrolling: auto-height or `fill`

By default the frame grows to its content and the host page scrolls. Nothing inside such a frame can be `position: sticky` relative to the reader, because the frame itself never scrolls; a host cannot fake it either (a sticky rail driven by host messages lagged and bounced, and was removed). Pass `fill` (`KageRenderer` → `EmbeddedKageRenderer`) when the page should scroll **inside** the frame: the iframe is `height: 100%`, the frame document scrolls, and sticky works natively.

- The host gives a fill frame a definite height: `/k/[id]` is `h-dvh overflow-hidden` with the stage in a `relative` scroller and an `absolute inset-0` child (a percentage height inside a flex item resolved to ~150px). The Library detail sheet stays auto-height, so a sticky contents rail does not follow there.
- `sandboxHtml` owns scroll policy: fill frames use `overscroll-behavior: contain`; auto-height frames use `auto` so wheel/touch input reaches the host scroller. The host CSS uses `!important` to override unconditional inline containment in older pinned runtimes without changing signed assets. Never apply containment to all frames: an auto-height iframe cannot scroll and then swallows the wheel.
- On scroll, report moved block rectangles for comment pins, but skip the full image/text/overflow measurement pass. Resize and mutation still trigger those diagnostics.
- The comment overlay covers the frame and swallows the wheel; `CommentStage` hands it back as a `kages-scroll` CustomEvent on the iframe, which `SandboxedKage` forwards as a `scrollBy` message. Normalize wheel line/page deltas with `wheelPixels` before forwarding; retain fractional pixel deltas for trackpads. Validate `top`/`left` as finite numbers on both sides.
- CSS that makes the rail stick: `.kg-kage { overflow: clip }` (`hidden` creates a scroll container and silently breaks sticky) and `.kg-toc--sticky { position: sticky; top; align-self: start; max-height; overflow-y: auto }`. `lists.test.ts` has a real-browser test that fails without the clip.
- A document change reloads the frame. A **design** change does not: the host posts a `design` message and the frame re-renders with the same React key (state survives); see `workspace-designs`.

Run `KAGES_TEST_URL=http://localhost:3100 KAGES_CHROME_NO_SANDBOX=1 node --test src/runtime/scroll-browser.test.ts` to exercise trusted wheel input on the actual preview and published routes, including the comment overlay. The test stubs document reads in the browser and never publishes to a workspace.

## Chapter links

Dedicated guide hosts opt into `navigation`. The parent validates chapter slugs against `guideRoutes(doc)` before changing its own fragment; iframe code receives location messages, never host DOM access. Embedded Library cards do not opt in. Preview uses a fill frame for root guides so chapter rails stick. See `field-guides` for the message contract and browser test.
