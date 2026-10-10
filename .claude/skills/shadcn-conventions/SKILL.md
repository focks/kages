---
name: shadcn-conventions
description: "How the UI is built in this repo: shadcn/ui on the base-nova preset, which is Base UI (NOT Radix) under the hood. Covers the app-shell pattern (persistent sidebar on every route), and the three Base UI gotchas that bite if you assume classic Radix shadcn — the render prop instead of asChild, nativeButton={false} for link buttons, and data-[orientation=…] selectors. Read before adding or editing any component under src/components or any page's UI."
---

# shadcn-conventions

The app is a dashboard: a persistent left sidebar on **every** route, a sticky
header, and the page in the content area. UI is shadcn/ui installed with the
default **base-nova** preset — which is **Base UI** (`@base-ui/react`), not
Radix. Most shadcn knowledge transfers, but three things differ and will waste
an hour if you assume Radix.

## The app shell

`src/app/layout.tsx` wraps every page in `<AppShell>` (SidebarProvider +
`AppSidebar` + header with `SidebarTrigger` and `ThemeToggle`). To add a nav
destination, add one entry to the `NAV` array in `src/components/app-sidebar.tsx`
— nothing else. Pages render inside the content region; a full-height page uses
`h-[calc(100svh-3.5rem)]` (header is `h-14`).

Theme is a class on `<html>` toggled by `ThemeToggle` and applied pre-paint by
an inline script in the layout — no next-themes dependency.

## Base UI gotchas (NOT Radix)

1. **Polymorphism is `render`, not `asChild`.** To make a Button/SidebarMenuButton
   render as a `<Link>`:
   ```tsx
   <Button render={<Link href="/x" />} nativeButton={false}>Label</Button>
   <SidebarMenuButton render={<Link href="/x" />} isActive={…}>…children…</SidebarMenuButton>
   ```
   The **children stay on the outer component** (Base UI injects them into the
   render element). `asChild` leaks to the DOM as an unknown prop.

2. **`nativeButton={false}` whenever a Button renders a non-`<button>`** (a
   link, a label). Omit it and Base UI logs an accessibility error on every
   render.

3. **State attributes are `data-orientation` / `data-*`, styled with
   `data-[orientation=horizontal]:…`** — not bare `data-horizontal:`. A
   generated component may ship the wrong selector (the Tabs root did: it used
   `data-horizontal:flex-col`, which never matched `data-orientation=horizontal`,
   so tabs laid out in a row). If a component's orientation/state styling looks
   wrong, check the selector targets the real emitted attribute.

## Other setup notes

- Tailwind v4 (no config file): `@import "tailwindcss"` in
  `src/app/globals.css`. The token values, type ramp, radii, states and the
  Kage boundary are the **`kages-app-design-system`** skill's business — read it
  before changing any colour, font, radius, or `:root`/`.dark` block. Fonts are
  Plex Sans/Mono + Bricolage (not Geist); theme is a `.dark` class on `<html>`.
- shadcn components `import { cn } from "cn"` (a package the preset installs);
  our own components import `cn` from `@/lib/utils`. Both resolve — don't
  "fix" the shadcn ones.
- `useSearchParams` requires a `<Suspense>` boundary — wrap the page body.
- Shared Kage presentation (state badge, system chip, `relTime`, the REST `op`
  helper) lives in `src/components/dashboard/kage-ui.tsx`.

## Re-running the shadcn CLI

`shadcn add <component>` re-injects `@import "shadcn/tailwind.css"` into
globals.css — that package isn't installed, so **remove that import line** after
adding components or the build fails.
