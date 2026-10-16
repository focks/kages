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
