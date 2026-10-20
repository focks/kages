# Workspace designs

A design is your workspace's own colours, type and corners, kept once and worn by any number of Kages.

A Kage is built from a design system (Core, Ledger or Atelier). A design sits on top of one of them and changes only what you set: the rest keeps coming from the base system. A workspace can hold up to fifty, a Kage picks one when it is created, and you can change it later.

## Make one

In the app, open **Designs**, choose **New design** and edit with a live preview that shows both themes. From a terminal:

```sh
kages designs set --name "Brand Blue" --brand "#0b5fff" --base ledger --default
kages designs list
kages designs show brand-blue
```

`--brand` builds a complete palette for light and dark from one colour and nudges every text colour until it passes its contrast minimum. `--default` makes it the design new Kages start in. Without a brand colour, give a file:

```json
{
  "id": "studio",
  "name": "Studio",
  "base": "atelier",
  "colors": { "light": { "accent": "#b4232a" }, "dark": { "accent": "#ff8a8f" } },
  "fonts": { "display": "Playfair Display", "body": "Inter", "mono": "JetBrains Mono" },
  "radius": { "sm": 4, "md": 8, "lg": 14 }
}
```

```sh
kages designs set --file studio.json
```

## What a design can change

| Part | What you set | Rule |
| --- | --- | --- |
| Colours | 16 roles per theme: page, card, recessed, divider, control border, text, muted text, accent, on-accent, accent tint, wire, wire tint, success, danger, danger tint, focus | Hex colours only. Roles you leave out come from the base system. |
| Type | Body, headings and figures, code | A font from the built-in list of 25 Google Fonts. Anything else is refused. |
| Corners | Small, medium and large radius | Whole pixels from 0 to 40. |

Every design is checked against the same 21 text and control pairs the built-in systems must pass, in both themes. A weak palette still saves, with a warning that names the failing pairs; `kages designs show` lists them all.

## Use one

Pick a design in the New Kage sheet, or set it on a Kage later from the Library. From a terminal:

```sh
kages designs use my-report brand-blue
kages designs use my-report none
```

Using a design also moves the Kage to the design's base system, so the two always agree; add `--keep-system` to leave the system alone. An agent that writes the document itself sets the `design` field to the design's id. If the workspace has a default, a new Kage without a `design` field starts in it, and `"design": ""` opts out.

## Editing a design does not restyle old versions

Each saved version of a Kage pins the design exactly as it was, like the design-system files it pins. Changing a design reaches a Kage only when that Kage gets its next version, or when you choose **Update to latest** on it. Deleting a design is safe: Kages keep the look they were saved with, and the design just stops being offered.

## Who can do what

Any member of the workspace can list designs and use them. Creating, changing and deleting a design needs admin on a project, the same as the workspace brief. Designs are never visible to anonymous callers, but a shared Kage carries its pinned look, so a link renders correctly for anyone.

## From an agent

| Operation | Does |
| --- | --- |
| `list_designs` | The designs, the default and the font list |
| `get_design` | One design, its resolved values, its CSS and any failing contrast pairs |
| `set_design` | Create or replace one; `brand` generates the palette; `baseRevision` avoids overwriting a newer edit |
| `delete_design` | Remove one |
| `set_kage_design` | Dress a Kage in a design, or remove it, as one new version |

The same operations are in [the REST API](rest-api.md) and [the MCP tools](mcp.md).
