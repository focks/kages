---
name: kages-app-design-system
description: "The design system for the Kages product chrome (Dashboard, Artifacts, Viewer): the four rules, the token-to-Tailwind mapping, the ordered steps to apply it to this repo, and the Playwright checks that prove it landed. Read before adding or changing any UI under src/app or src/components, and follow the Apply section once to move the app off stock shadcn grey. Not for Core, Ledger or Atelier: those paint the inside of a Kage and live in originals/."
---

# kages-app-design-system

Kages App is the chrome around every Kage. Core, Ledger and Atelier paint what
is inside a Kage; this system paints everything outside one. Its first job is to
stay quiet enough that a Ledger Kage and an Atelier Kage both look at home in
the same frame.

The source of truth is the **Kages App** design system artifact
(https://claude.ai/code/artifact/9dded6cf-b1c1-427e-a01c-8f3713015489). This skill is self-contained: `reference/` holds the same tokens
(`tokens.json`), the compiled `globals.css`, the code to paste, and renders to
compare against. If the artifact and this skill disagree, the artifact wins;
update this skill.

## The four rules

1. **Paper and ink.** `bg-background` for views, `bg-card` for raised things,
   `bg-muted` for recessed things. `text-foreground` and `text-muted-foreground`
   are the only text greys. Hairlines are `border-border`. No shadows except
   popovers.
2. **One brass action.** `primary` (brass) appears once per view: the primary
   button, the active tab underline, the selected item's edge, the monogram.
3. **Teal means connection.** `wire` is for links, `$block`/`$state`
   references, bound props, wired blocks and the focus ring. Never decoration.
4. **Machines get mono.** System ids, block ids, refs, versions, digests,
   principals and contract names are `font-mono`. Language is IBM Plex Sans.

## Writing UI in this repo

| Need | Write | Never |
| --- | --- | --- |
| A colour | a token utility: `bg-primary-soft`, `text-wire`, `bg-success-soft`, `border-input` | Tailwind palette (`emerald-600`, `teal-600`, `amber-500/15`), hex in a class |
| A control's edge | `border-input` (3:1) | `border-border` on anything clickable |
| A radius | `rounded-sm` (3px chips), `rounded-md` (5px controls), `rounded-xl` (8px panels) | `rounded-lg`, `rounded-full`, any other |
| A page title | `font-display text-[22px] leading-7 font-[650] tracking-[-0.01em]`, once per view | the display family anywhere else but stat figures |
| A stat value | `font-display text-[28px] leading-8 font-[650] tracking-[-0.01em] tabular-nums` | a coloured number |
| An overline (nav group, table head, pane head) | `font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground` | typing capitals in the string |
| A ref, id, version, digest | `font-mono text-xs text-muted-foreground` (or `text-[12.5px]`) | sans for anything an agent addresses |
| Lifecycle state | `<StateBadge state />` | a bare `Badge` with a colour |
| A system | `<SystemChip system />` | hard-coded system colours |
| Validation | `<ValidationStatus validation />` (icon + count) | a green/red word or dot |
| A rendered Kage | `<KageFrame>` around `<KageRenderer>` | a Kage with chrome padding or chrome tokens inside it |
| An icon | `lucide-react`, `size-4`, stroke 1.5 via `LucideProvider` | emoji, another icon set, an unlabeled icon-only button |
| A shadow | nothing: popovers get `--shadow-pop` from `globals.css` | `shadow-*` on cards or panes |

Copy: sentence case; labels are nouns, buttons are verbs; no exclamation marks,
no emoji. Empty states say what is missing, why, and one way out. Errors name
the block and the contract. Versions are `v3`; time is `4m ago`; validation is
always the full count (`0 errors, 2 warnings`).

Selected = `bg-primary-soft` (plus `border-primary` on a list item). Hover =
`bg-accent`. Note the name clash: shadcn's `accent` is the hover grey here; the
identity colour is `primary`. In Core, Ledger and Atelier the word *accent*
means identity.

## What was wrong (the review this skill came from)

1. **Kages render unstyled in the app.** `public/ds/bundle.css` reads
   `--paper`, `--space-4`, `--font-display` and the rest from a compiled token
   sheet the app never ships (only `tokens.json` is served), so every `--kg-*`
   resolves to nothing. Visible in the Viewer and the Preview tab.
2. **Core's tokens collide with shadcn's.** Core is unprefixed: `--accent`,
   `--radius-sm|md|lg`, `--font-sans`. Declared at `:root` they would overwrite
   the chrome (and today the chrome's values leak into the Kage). They must be
   scoped to `.kg-kage`.
3. **No identity.** Stock neutral shadcn and Geist; a Lucide `Layers` icon in a
   black tile as the mark; the dark theme's `--sidebar-primary` is the stock
   blue-violet.
4. **Hard-coded colours that fail contrast.** `teal-600` for wire text is
   3.67:1 and `emerald-600` for "valid" is 3.65:1 on white (AA needs 4.5:1).
   Control edges (`--input` at oklch 0.922) are 1.26:1 against the page.
5. **System chips use invented colours** (`#9a7b2e`, `#2f6b4f`, `#8a3b55`) that
   match none of the three systems' accents, with white text at 4.0:1 on Core's,
   and no dark-theme values.
6. **Status rests on colour alone.** State badges and "valid" have no icon;
   warnings are not shown at all when there are no errors.
7. **Small breakages.** The Import button in Artifacts renders empty (its icon
   is lost inside the `render={<label>…}` element). The header separator is
   invisible (`data-vertical:` never matches Base UI's `data-orientation`, the
   same gotcha `shadcn-conventions` records for Tabs). `sonner.tsx` reads
   `next-themes` although the app has no ThemeProvider.

## Apply (once, in this order)

Run `npm run typecheck` and `npm test` after steps 3 and 6. No engine file
changes: this is chrome only, plus one generated stylesheet.

### 1. Tokens: `src/app/globals.css`

Replace the file with `reference/globals.css`. It keeps the file's structure
(the same `@theme inline`, `:root`, `.dark`, `@layer base`) and changes values,
adds the Kages roles (`primary-soft`, `wire`, `wire-soft`, `success`,
`warning`, `destructive-soft`, `sys-*`), fixes the three radii, and gives
popovers the one shadow. After any `shadcn add`, re-check that the CLI did not
re-inject `@import "shadcn/tailwind.css"` or overwrite these blocks.

### 2. Fonts: `src/app/layout.tsx`

```tsx
import "./globals.css";
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { cn } from "@/lib/utils";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-sans" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

// ...
<html lang="en" className={cn(plexSans.variable, plexMono.variable, bricolage.variable)} suppressHydrationWarning>
```

Delete the Geist import. The `variable` names must be exactly these: the theme
reads `--font-plex-sans`, `--font-plex-mono` and `--font-bricolage`.

### 3. Icon stroke: `src/components/app-shell.tsx`

Wrap the returned tree in `<LucideProvider strokeWidth={1.5}>` (import it
from `lucide-react`; it is in 1.55). Every icon in the app then draws at
1.5px, the glyph weight the artifact systems use.

### 4. Kage token isolation

a. Add `reference/kage-tokens.mjs` as `scripts/kage-tokens.mjs` and a script
   `"tokens": "node scripts/kage-tokens.mjs"` in `package.json`. Run it. It
   writes `public/ds/tokens.css` with every token under `.kg-kage` (light) and
   `.dark .kg-kage` (dark). Re-run it whenever `public/ds/tokens.json` changes
   (add it to the extract flow in `how-to-extend-kages`).

b. In `src/runtime/useDsBundle.ts`, load it next to `bundle.css`:

```ts
for (const file of ["tokens.css", "bundle.css"]) {
  if (document.querySelector(`link[data-ds-bundle="${file}"]`)) continue;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `${base}/${file}`;
  link.setAttribute("data-ds-bundle", file);
  document.head.appendChild(link);
}
```

Never declare a Core, Ledger or Atelier token on `:root`, and never use a
chrome token inside `.kg-kage`.

### 5. Shared presentation: `src/components/dashboard/kage-ui.tsx`

Replace `StateBadge` and `SystemChip` and add `ValidationStatus` and
`KageFrame` from `reference/kage-ui.tsx`. Keep `relTime`, `KageCard` and `op`
as they are. If a state's colours lose to the Badge variant's, append `!` to
the state classes (`bg-wire-soft!`); the check in Verify catches this.

### 6. Stock shadcn files (class edits only)

| File | Change |
| --- | --- |
| `ui/button.tsx` `outline` | `"border-input bg-card hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground"` (drop the `dark:` overrides) |
| `ui/button.tsx` `link` | `"text-wire underline underline-offset-[3px] decoration-1"` |
| `ui/input.tsx`, `ui/select.tsx` trigger | `bg-transparent` → `bg-card`; delete `dark:bg-input/30` and `dark:hover:bg-input/50` |
| `ui/tabs.tsx` trigger | `after:bg-foreground` → `after:bg-primary` |
| `ui/table.tsx` `TableHead` | `"h-8 px-3 text-left align-middle whitespace-nowrap font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground"` |
| `ui/table.tsx` `TableCell` | `p-2` → `h-11 px-3` |
| `ui/separator.tsx` | `data-horizontal:` → `data-[orientation=horizontal]:`, `data-vertical:` → `data-[orientation=vertical]:` |
| `ui/sonner.tsx` | drop the `next-themes` import and `useTheme`; pass no `theme`; `"--border-radius": "8px"` |

### 7. Pages

- **`app-sidebar.tsx`**: the mark becomes
  `<div aria-hidden className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary font-display text-[15px] font-bold tracking-[-0.03em] text-sidebar-primary-foreground">Kg</div>`;
  the name `font-display text-[15px] font-[650]`; the workspace line and the
  footer `font-mono text-[11px] text-muted-foreground`. Give each
  `SidebarGroupLabel` `className="font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground"` and each `SidebarMenuButton`
  `className="data-active:[&>svg]:text-sidebar-primary"`. There is no logo:
  do not draw one.
- **`page.tsx` (Dashboard)**: `h2` → page-title classes; stat labels
  `text-xs font-medium tracking-[0.01em] text-muted-foreground`; stat values →
  figure classes; "Drafts / review" → "Drafts and review"; `3 / 3` → `3 of 3`
  with "of 3" in `text-sm font-normal text-muted-foreground`.
- **`artifacts/page.tsx`**: list item →
  `rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent`,
  selected `border-primary bg-primary-soft hover:bg-primary-soft`; the "valid"
  span → `<ValidationStatus validation={c.validation} short />`; the version
  in meta `font-mono`; the title → page-title classes; visibility →
  `<Badge variant="secondary" className="capitalize">`; `<TabsList variant="line" className="w-full justify-start gap-4 border-b">`
  with `className="flex-none"` on each trigger (check the underline sits on the
  hairline as in the renders) and the count as `<span className="rounded-sm bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">`;
  Publish becomes `variant="default"` and moves last; Overview validation →
  `<ValidationStatus />`; the describe `<pre>` →
  `overflow-auto rounded-xl border bg-muted p-4 font-mono text-[12.5px] leading-[18px]`;
  the preview → `<KageFrame system={current.system} kageRef={current.ref} digest={versions.at(-1)?.digest}>`;
  fix Import: `<Button size="icon" variant="outline" aria-label="Import JSON" nativeButton={false} render={<label />}><input type="file" accept="application/json" hidden onChange={…} /><Upload /></Button>`.
- **`viewer/page.tsx`**: the `h2` → page-title classes; the Kage →
  `<KageFrame system={system} kageRef={params.get("kage") ?? "ops-console.kage.json"}>`
  so the bar follows the system select.

### 8. Keep the skills true

In `shadcn-conventions`, replace the Geist/theme-token notes with a pointer
here. Add this skill to the table in `AGENTS.md`: "Before adding or changing
any UI: tokens, type, states, the Kage boundary."

## The "Are you an agent?" panel

Every Kage view (the `/k/[id]` share page and the preview overlay) ends in a collapsed footer `<details>` from `src/components/dashboard/kage-usage.tsx`. It must stay **quiet**: unboxed, a muted one-line summary, never fixed or floating over the Kage (a floating version was rejected as too noticeable). Open, it shows "Agent instructions for Kages" grouped as install, CLI, MCP and REST, each command copyable, a "Copy a prompt for your agent" button and a "View as markdown" link.

- The content is the pure `kage-usage-model.ts` (`usageGroups`, `agentPrompt`, `cleanOrigin`, `fileStem`) with its own test; the component only renders it. Commands are derived from `location.origin` at runtime, so a local app, a preview and production each show their own host.
- The open panel is height-capped (`max-h-[45svh]`, scrolls) with bottom padding so the last command clears the floating "Made with Kages" pill.
- Change a command or add a client in the model and its test, never in the component.

## Verify with Playwright MCP

Start `npm run dev`, then for each of `/`, `/artifacts`, `/viewer`,
in light and after clicking the theme toggle: `browser_navigate`,
`browser_snapshot`, `browser_take_screenshot`, `browser_console_messages`.
Compare screenshots with `reference/renders/` (static renditions of the target;
`viewer-*.png` show the real bundle inside the frame). Zero console errors
(a `favicon.ico` 404 is pre-existing and unrelated — adding a favicon is out of
scope for a tokens-only change).

The computed-style table asserts a **Review** badge, so the store must hold a
Kage in `review` state. The seed is `src/server/store-instance.ts` (not under
`src/store`, so editable): if it has none, add `store.submitForReview(...)` for
one fork. Open it deep-linked (`/artifacts?id=<name>`) to read the badge's
computed style.

The badge/system-chip text is lowercased in the DOM — `capitalize`/`uppercase`
are CSS — so match on lowercase (`"published"`, `"le"`) when querying. Base UI's
`Badge` does not emit `data-slot="badge"`; find badges by their computed
background instead. The DS bundle loads async, so `await` a short delay (or wait
for `.kg-kage`) before reading `.kg-kage` styles in Viewer/Preview.

Assert with `browser_evaluate` (values are `getComputedStyle` results):

| What | Light | Dark |
| --- | --- | --- |
| `body` background | `rgb(244, 242, 236)` | `rgb(20, 21, 19)` |
| `body` font-family starts with | `"IBM Plex Sans"` | same |
| page title font-family starts with | `"Bricolage Grotesque"`, 22px, weight 650 | same |
| sidebar background (`[data-slot="sidebar-inner"]`) | `rgb(235, 231, 222)` | `rgb(28, 30, 27)` |
| a `variant="default"` button background | `rgb(156, 74, 23)` | `rgb(230, 144, 79)` |
| its text colour | `rgb(255, 253, 248)` | `rgb(28, 18, 8)` |
| an `Input` border colour | `rgb(133, 126, 111)` | `rgb(127, 131, 119)` |
| an `Input` background | `rgb(255, 253, 248)` | `rgb(28, 30, 27)` |
| selected Artifacts item background | `rgb(243, 226, 210)` | `rgb(59, 40, 24)` |
| Published badge background / colour | `rgb(220, 235, 223)` / `rgb(47, 107, 69)` | `rgb(24, 48, 31)` / `rgb(124, 196, 147)` |
| Review badge background / colour | `rgb(217, 236, 236)` / `rgb(31, 106, 112)` | `rgb(23, 53, 55)` / `rgb(108, 192, 196)` |
| Ledger SystemChip tile background | `rgb(29, 59, 42)` | `rgb(159, 211, 174)` |
| `.kg-kage` background, system core | `rgb(244, 242, 236)` | `rgb(20, 21, 19)` |
| `.kg-kage` background, system ledger (Viewer select) | `rgb(246, 247, 245)` | `rgb(13, 15, 14)` |
| `.kg-kage` background, system atelier | `rgb(250, 246, 241)` | `rgb(26, 22, 20)` |
| any Lucide `svg` `stroke-width` | `1.5` | same |
| header separator width | `1px` | same |
| Import button contains an `svg` | yes | yes |

Also Tab through `/artifacts`: every stop shows the teal ring
(`rgb(31, 106, 112)` light, `rgb(108, 192, 196)` dark). And grep the diff: no
`emerald-`, `teal-`, `amber-`, `orange-`, `bg-[#` or `rounded-lg` left under
`src/app` or `src/components/dashboard`.

## What is already proven, and what is not

Proven in headless Chromium before this skill was written: every text pairing
the chrome paints is at least 4.88:1 and every control edge and focus ring at
least 3.27:1, in both themes (122 checks); `kage-tokens.mjs` output makes the
real `bundle.js` render `ops-console` correctly in Core, Ledger and Atelier,
light and dark, under the chrome's variables with no console errors.

Not proven: the edited app itself. `globals.css` was not compiled by Tailwind
and the `.tsx` changes were not type-checked in this repo, and the three Google
families were not rendered (the renders use fallback fonts). The Verify section
exists to close exactly that gap.
