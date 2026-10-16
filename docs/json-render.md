# json-render

Kages works with [json-render](https://github.com/vercel-labs/json-render), Vercel's framework for generating interfaces from a catalog of components. If you already have json-render specs, or your app renders them, you can move work between the two.

The difference is what each is for. json-render describes an interface to render. Kages keeps what happens afterwards: versions, patches, merging, review and sharing. So a spec can come into Kages to be reviewed and revised, and a Kage can go out as a spec for an app that renders json-render.

## Bring a spec in

```sh
kages json-render import spec.json --create
```

The spec is the flat form, `{ root, elements, state }`, using json-render's shadcn components. Cards, stacks, grids, headings, text, badges, alerts, buttons, links, inputs, selects, radios, checkboxes, switches, sliders, tables, accordions and tabs become the matching Kages blocks. `$state`, `$bindState`, `$template`, `$cond`, `visible` conditions and `setState` actions are translated, and nested state paths such as `/form/email` become flat keys such as `form_email`.

## Send a Kage out

```sh
kages json-render export my-guide -o spec.json
```

Bindings, visibility and simple set handlers come out in json-render's own forms.

## What does not carry over

Neither side has everything the other does, so every conversion prints notes naming what was approximated or left out, and nothing is dropped silently:

- json-render has no calculations, so a computed value is frozen at its starting state on export.
- Charts, diagrams and the contents list have no shadcn equivalent and are left out.
- Handlers other than setting state are app-specific in json-render and are not converted.
- A json-render component Kages has no block for becomes a plain stack of its children.

Run `kages json-render export` and read the notes before you send the result anywhere. The same two conversions are available to agents as the `from_json_render` and `to_json_render` operations, and a generated [decision guide](decision-guides.md) exports cleanly.
