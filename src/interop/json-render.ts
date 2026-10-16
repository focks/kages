// Interop with Vercel's json-render (https://github.com/vercel-labs/json-render): its flat spec
// { root, elements: {key: {type, props, children, visible, on}}, state } on the shadcn catalog,
// converted to and from a Kage. Kages stays the system of record (versions, patches, review); this
// is the door for people who already have, or want, a json-render spec.
//
// Both directions are lossy by nature (a catalog of 36 components against ours; json-render has no
// calculations or charts), so every conversion returns notes naming exactly what was approximated or
// dropped: a silent substitution is worse than a refusal. Formats were read from the json-render
// repository (packages/core types, packages/shadcn catalog), 2026-10-16; re-check them when it releases.
import type { Block, KageDoc } from "../engine/types.ts";
import { KageSession } from "../engine/session.ts";

type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface JrElement { type: string; props?: J; children?: string[]; visible?: unknown; on?: J; repeat?: unknown; watch?: unknown; slots?: J }
export interface JrSpec { root: string; elements: Record<string, JrElement>; state?: J }
export interface Converted<T> { value: T; notes: string[] }

const GAP_IN: Record<string, number> = { none: 0, sm: 2, md: 4, lg: 6, xl: 8 };
const GAP_OUT = (g: unknown): string => { const n = Number(g ?? 4); return n <= 0 ? "none" : n <= 2 ? "sm" : n <= 4 ? "md" : n <= 6 ? "lg" : "xl"; };
/** A JSON pointer ("/form/country") as one flat Kage state key; nested state is flattened with "_". */
const keyOf = (ptr: string) => ptr.replace(/^\//, "").replace(/\//g, "_");
const ptrOf = (key: string) => "/" + key;

// ---------------------------------------------------------------- json-render → Kage

/** A json-render dynamic value (`$state`, `$cond`, `$template`) as a Kage expression. Unknown forms become null and are reported. */
function dyn(v: unknown, at: string, notes: string[]): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x, i) => dyn(x, `${at}/${i}`, notes));
  const o = v as J;
  if ("$state" in o && typeof o.$state === "string") return { $state: keyOf(o.$state) };
  if ("$bindState" in o) return { $state: keyOf(String(o.$bindState)) };
  if ("$template" in o && typeof o.$template === "string") return { $tpl: o.$template.replace(/\$\{([^}]+)\}/g, (_m, p: string) => `{{state.${keyOf(p)}}}`) };
  if ("$cond" in o) return { $if: [cond(o.$cond, at, notes), dyn(o.$then, at, notes), dyn(o.$else, at, notes)] };
  if (Object.keys(o).some((k) => k.startsWith("$"))) { notes.push(`${at}: the expression ${Object.keys(o).find((k) => k.startsWith("$"))} has no Kages equivalent and was replaced with null`); return null; }
  return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, dyn(x, `${at}/${k}`, notes)]));
}

/** One json-render condition: `{ $state, eq|neq|gt|gte|lt|lte, not }`, or `$and`/`$or`/boolean/array (implicit AND). */
function cond(c: unknown, at: string, notes: string[]): unknown {
  if (typeof c === "boolean") return c;
  if (Array.isArray(c)) return { $and: c.map((x) => cond(x, at, notes)) };
  const o = c as J;
  if (o && "$and" in o) return { $and: (o.$and as unknown[]).map((x) => cond(x, at, notes)) };
  if (o && "$or" in o) return { $or: (o.$or as unknown[]).map((x) => cond(x, at, notes)) };
  if (o && typeof o.$state === "string") {
    const s = { $state: keyOf(o.$state) };
    let e: unknown = s;
    for (const [k, op] of [["eq", "$eq"], ["neq", "$neq"], ["gt", "$gt"], ["gte", "$gte"], ["lt", "$lt"], ["lte", "$lte"]]) if (k in o) e = { [op]: [s, o[k]] };
    return o.not ? { $not: e } : e;
  }
  notes.push(`${at}: an unsupported visibility condition was treated as always shown`);
  return true;
}

const setAction = (b: J, notes: string[], at: string): unknown[] => {
  const list = Array.isArray(b) ? b : [b];
  const out: unknown[] = [];
  for (const a of list) {
    if (a?.action === "setState" && a.params?.statePath) out.push({ do: "set", path: keyOf(a.params.statePath), value: dyn(a.params.value, at, notes) });
    else notes.push(`${at}: the action "${a?.action}" is app-specific in json-render, so the handler was left out; wire it with a Kages host action`);
  }
  return out;
};

/** The tail of a state-bound input: Kages binds `value` and writes it back on change. */
function bindInput(el: JrElement, prop: string, event: string, at: string, notes: string[]): { bind?: J; on?: J } {
  const v = el.props?.[prop];
  if (v && typeof v === "object" && "$bindState" in v) { const k = keyOf(v.$bindState); return { bind: { [prop]: { $state: k } }, on: { change: [{ do: "set", path: k, value: { $event: event } }] } }; }
  return {};
}

export function fromJsonRender(spec: JrSpec): Converted<KageDoc> {
  const notes: string[] = [];
  if (!spec || typeof spec !== "object" || typeof spec.root !== "string" || typeof spec.elements !== "object") throw new Error("not a json-render spec: expected { root, elements }");
  if (!spec.elements[spec.root]) throw new Error(`root "${spec.root}" is not among the elements`);
  const B: Record<string, Block> = {};
  const state: J = {};
  for (const [k, v] of Object.entries(spec.state ?? {})) flatten(k, v, state);
  const skipped = new Set<string>();

  for (const [key, el] of Object.entries(spec.elements)) {
    const p = el.props ?? {}, at = `/elements/${key}`, kids = (el.children ?? []).filter((c) => spec.elements[c]);
    const slot = kids.length ? { slots: { children: kids } } : {};
    const str = (v: unknown) => dyn(v, at, notes) as never;
    let out: Block | null = null;
    switch (el.type) {
      case "Card": out = { type: "card", props: { ...(p.title ? { title: p.title } : {}), ...(p.description ? { subtitle: p.description } : {}) }, ...slot } as unknown as unknown as Block; break;
      case "Stack": out = { type: "stack", props: { direction: p.direction === "horizontal" ? "row" : "column", gap: GAP_IN[p.gap ?? "md"] ?? 4, ...(p.align ? { align: p.align } : {}), ...(p.justify ? { justify: p.justify === "between" ? "space-between" : p.justify === "around" ? "space-around" : p.justify } : {}), ...(p.direction === "horizontal" ? { wrap: true } : {}) }, ...slot } as unknown as unknown as Block; break;
      case "Grid": out = { type: "grid", props: { columns: p.columns ?? 2, gap: GAP_IN[p.gap ?? "md"] ?? 4 }, ...slot } as unknown as unknown as Block; break;
      case "Separator": out = { type: "divider", props: {} } as unknown as unknown as Block; break;
      case "Heading": out = { type: "text", props: { text: str(p.text), variant: ({ h1: "display", h2: "title", h3: "heading", h4: "heading" } as J)[p.level ?? "h2"] ?? "heading" } } as unknown as unknown as Block; break;
      case "Text": out = { type: "text", props: { text: str(p.text), variant: ({ caption: "caption", muted: "muted", code: "code" } as J)[p.variant] ?? "body" } } as unknown as unknown as Block; break;
      case "Badge": out = { type: "badge", props: { label: str(p.text), tone: p.variant === "destructive" ? "danger" : p.variant === "default" ? "accent" : "neutral" } } as unknown as unknown as Block; break;
      case "Avatar": out = { type: "badge", props: { label: String(p.name ?? "?"), tone: "neutral" } } as unknown as Block; notes.push(`${at}: Avatar became a badge with the name`); break;
      case "Alert": out = { type: "alert", props: { tone: p.type === "error" ? "danger" : p.type ?? "info", title: str(p.title), ...(p.message ? { text: str(p.message) } : {}) } } as unknown as unknown as Block; break;
      case "Progress": out = { type: "gauge", props: { label: p.label ?? "Progress", value: str(p.value), min: 0, max: p.max ?? 100 } } as unknown as Block; notes.push(`${at}: Progress became a gauge`); break;
      case "Image":
        if (!p.src) { notes.push(`${at}: an Image with no src (a placeholder) was left out`); skipped.add(key); break; }
        out = { type: "image", props: { src: p.src, alt: p.alt ?? "" } } as unknown as unknown as Block; break;
      case "Link": out = { type: "link", props: { label: str(p.label), href: p.href } } as unknown as unknown as Block; break;
      case "Button": {
        const on = el.on?.press ? setAction(el.on.press, notes, at) : [];
        out = { type: "button", props: { label: str(p.label), variant: p.variant === "danger" ? "danger" : p.variant === "secondary" ? "secondary" : "primary", ...(p.disabled ? { disabled: true } : {}) }, ...(on.length ? { on: { click: on } } : {}) } as unknown as unknown as Block; break;
      }
      case "Input": {
        const num = p.type === "number";
        if (p.type === "password") notes.push(`${at}: password inputs render as plain text fields in Kages`);
        out = { type: num ? "number-input" : "text-field", props: { label: p.label, name: p.name, ...(p.placeholder && !num ? { placeholder: p.placeholder } : {}), ...(!num && p.type === "email" ? { kind: "email" } : {}) }, ...bindInput(el, "value", "value", at, notes) } as unknown as unknown as Block; break;
      }
      case "Textarea": out = { type: "textarea", props: { label: p.label, ...(p.placeholder ? { placeholder: p.placeholder } : {}) }, ...bindInput(el, "value", "value", at, notes) } as unknown as unknown as Block; break;
      case "Select": out = { type: "dropdown", props: { label: p.label, options: (p.options ?? []).map((o: string) => ({ value: o, label: o })), ...(p.placeholder ? { placeholder: p.placeholder } : {}) }, ...bindInput(el, "value", "value", at, notes) } as unknown as unknown as Block; break;
      case "Radio": out = { type: "choice", props: { label: p.label, name: p.name, options: (p.options ?? []).map((o: string) => ({ value: o, label: o })) }, ...bindInput(el, "value", "value", at, notes) } as unknown as unknown as Block; break;
      case "Checkbox": out = { type: "checkbox", props: { label: p.label }, ...bindInput(el, "checked", "checked", at, notes) } as unknown as unknown as Block; break;
      case "Switch": out = { type: "switch", props: { label: p.label }, ...bindInput(el, "checked", "checked", at, notes) } as unknown as unknown as Block; break;
      case "Slider": out = { type: "slider", props: { label: p.label ?? "Value", min: p.min ?? 0, max: p.max ?? 100, step: p.step ?? 1 }, ...bindInput(el, "value", "value", at, notes) } as unknown as unknown as Block; break;
      case "Table": out = { type: "table", props: { columns: (p.columns ?? []).map((c: string, i: number) => ({ key: "c" + i, label: c })), rows: (p.rows ?? []).map((r: string[]) => Object.fromEntries(r.map((v, i) => ["c" + i, v]))) } } as unknown as unknown as Block; break;
      case "Accordion": out = { type: "accordion", props: { items: (p.items ?? []).map((it: J, i: number) => ({ id: "i" + (i + 1), title: it.title, body: it.content })) } } as unknown as unknown as Block; break;
      case "Carousel": out = { type: "carousel", props: { slides: (p.items ?? []).map((it: J) => ({ ...(it.title ? { title: it.title } : {}), ...(it.description ? { text: it.description } : {}) })) } } as unknown as unknown as Block; break;
      case "Tabs": out = { type: "tabs", props: { tabs: (p.tabs ?? []).map((t: J) => ({ id: t.value, label: t.label })) }, ...bindInput(el, "value", "value", at, notes) } as unknown as Block; notes.push(`${at}: Tabs only switch a value here; show each tab's content with a visibility condition on that value`); break;
      case "Collapsible": out = { type: "section", props: { title: p.title, level: 3 }, ...slot } as unknown as Block; notes.push(`${at}: Collapsible became an always-open section`); break;
      case "Dialog": case "Drawer": out = { type: "modal", props: { label: p.title ?? "Dialog" }, ...slot } as unknown as Block; notes.push(`${at}: ${el.type} became a modal that starts closed; add a button that opens it`); break;
      case "Skeleton": case "Spinner": notes.push(`${at}: ${el.type} is a loading placeholder and was left out`); skipped.add(key); break;
      default:
        notes.push(`${at}: the component "${el.type}" has no Kages equivalent; its children were kept and the element became a plain stack`);
        out = { type: "stack", props: { direction: "column", gap: 4 }, ...slot } as unknown as Block;
    }
    if (el.repeat) notes.push(`${at}: repeat is not converted; use a Kages $repeat over a data source`);
    if (el.watch) notes.push(`${at}: watch handlers are not converted`);
    if (!out) continue;
    if (el.visible !== undefined) (out as J).visible = cond(el.visible, at, notes);
    B[key] = out;
  }
  // Children that were skipped must not dangle.
  for (const b of Object.values(B)) for (const [s, ids] of Object.entries((b.slots ?? {}) as Record<string, string[]>)) (b.slots as J)[s] = ids.filter((i) => B[i]);
  const title = String((B[spec.root]?.props as J)?.title ?? "Imported from json-render");
  const doc = { kages: "1.0", id: slug(title) || "imported", title, system: "core@1", root: spec.root, blocks: B, ...(Object.keys(state).length ? { state } : {}) } as unknown as KageDoc;
  return { value: doc, notes };
}

function flatten(prefix: string, v: unknown, into: J) {
  if (v && typeof v === "object" && !Array.isArray(v)) for (const [k, x] of Object.entries(v)) flatten(`${prefix}_${k}`, x, into);
  else into[prefix] = v;
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

// ---------------------------------------------------------------- Kage → json-render

/** A plain `{ $state }` binding in a Kage block, if that is all it is. */
const boundKey = (b: Block, prop: string): string | null => { const e = (b.bind as J | undefined)?.[prop]; return e && typeof e === "object" && typeof e.$state === "string" && Object.keys(e).length === 1 ? e.$state : null; };

export function toJsonRender(doc: KageDoc): Converted<JrSpec> {
  const notes: string[] = [];
  const session = new KageSession(doc);
  const expanded = session.instances();
  const E: Record<string, JrElement> = {};
  const read = (id: string): J => (session.read(id) ?? {}) as J;
  const text = (id: string, prop: string) => String(read(id)[prop] ?? "");
  const frozen = new Set<string>();

  for (const [id, b] of Object.entries(expanded.blocks)) {
    const p = (b.props ?? {}) as J, kids = Object.values((b.slots ?? {}) as Record<string, string[]>).flat();
    const children = kids.length ? kids : undefined;
    const withKids = (el: JrElement): JrElement => ({ ...el, ...(children ? { children } : {}) });
    const note = (m: string) => notes.push(`${id}: ${m}`);
    const dynText = (prop: string): unknown => {
      const k = boundKey(b, prop);
      if (k) return { $state: ptrOf(k) };
      const tpl = (b.bind as J | undefined)?.[prop]?.$tpl;
      if (typeof tpl === "string" && Object.keys((b.bind as J)[prop]).length === 1) return { $template: tpl.replace(/\{\{state\.([^}]+)\}\}/g, (_m, k2: string) => "${" + ptrOf(k2) + "}") };
      if ((b.bind as J | undefined)?.[prop] !== undefined) frozen.add(id);
      return text(id, prop);
    };
    const input = (type: string, props: J, prop = "value"): JrElement => { const k = boundKey(b, prop); return { type, props: { ...props, [prop]: k ? { $bindState: ptrOf(k) } : read(id)[prop] ?? null } }; };
    let el: JrElement | null = null;
    switch (b.type) {
      case "page": el = withKids({ type: "Stack", props: { direction: "vertical", gap: GAP_OUT(p.gap) } }); break;
      case "section": el = p.title ? withKids({ type: "Card", props: { title: p.title, description: p.description ?? null } }) : withKids({ type: "Stack", props: { direction: "vertical", gap: GAP_OUT(p.gap) } }); break;
      case "card": el = withKids({ type: "Card", props: { title: p.title ?? null, description: p.subtitle ?? null } }); break;
      case "stack": el = withKids({ type: "Stack", props: { direction: p.direction === "row" ? "horizontal" : "vertical", gap: GAP_OUT(p.gap) } }); break;
      case "grid": el = withKids({ type: "Grid", props: { columns: p.columns ?? 2, gap: GAP_OUT(p.gap) } }); break;
      case "split": el = withKids({ type: "Grid", props: { columns: 2, gap: GAP_OUT(p.gap) } }); break;
      case "divider": el = { type: "Separator", props: {} }; break;
      case "anchor": case "toc": note(`${b.type} has no json-render equivalent and was left out`); break;
      case "text": {
        const v = String(p.variant ?? "body");
        el = v === "display" || v === "title" || v === "heading" ? { type: "Heading", props: { text: dynText("text"), level: v === "display" ? "h1" : v === "title" ? "h2" : "h3" } } : { type: "Text", props: { text: dynText("text"), variant: v === "muted" || v === "caption" || v === "code" ? v : "body" } };
        break;
      }
      case "markdown": case "rich-text": case "code": el = { type: "Text", props: { text: String(p.text ?? p.code ?? read(id).text ?? JSON.stringify(p.nodes ?? "")), variant: b.type === "code" ? "code" : "body" } }; note(`${b.type} became plain text; its formatting is not carried`); break;
      case "list": el = { type: "Text", props: { text: (p.items as string[] ?? []).map((x) => `• ${x}`).join("\n"), variant: "body" } }; break;
      case "badge": el = { type: "Badge", props: { text: p.label, variant: p.tone === "danger" ? "destructive" : p.tone === "accent" ? "default" : "secondary" } }; break;
      case "alert": el = { type: "Alert", props: { title: p.title ?? "", message: dynText("text"), type: p.tone === "danger" ? "error" : p.tone ?? "info" } }; break;
      case "link": el = { type: "Link", props: { label: p.label, href: p.href } }; break;
      case "image": el = { type: "Image", props: { src: p.src, alt: p.alt ?? "", width: null, height: null } }; break;
      case "button": {
        const acts: J[] = [];
        for (const a of ((b.on as J | undefined)?.click ?? []) as J[]) {
          if (a.do === "set" && typeof a.path === "string" && !(a.value && typeof a.value === "object" && "$event" in a.value)) acts.push({ action: "setState", params: { statePath: ptrOf(a.path), value: a.value } });
          else note(`a "${a.do}" handler has no portable json-render action and was left out`);
        }
        el = { type: "Button", props: { label: p.label, variant: p.variant === "danger" ? "danger" : p.variant === "secondary" || p.variant === "quiet" ? "secondary" : "primary", disabled: p.disabled ?? null }, ...(acts.length ? { on: { press: acts.length === 1 ? acts[0] : acts } } : {}) }; break;
      }
      case "text-field": case "text-input": el = input("Input", { label: p.label ?? "", name: p.name ?? id, type: p.kind === "email" ? "email" : "text", placeholder: p.placeholder ?? null, checks: null, validateOn: null }); break;
      case "number-input": el = input("Input", { label: p.label ?? "", name: p.name ?? id, type: "number", placeholder: null, checks: null, validateOn: null }); break;
      case "textarea": el = input("Textarea", { label: p.label ?? "", name: id, placeholder: p.placeholder ?? null, rows: p.rows ?? null, checks: null, validateOn: null }); break;
      case "dropdown": case "choice": {
        const opts = (p.options as J[] ?? []);
        if (opts.some((o) => o.value !== o.label)) note("option values differ from their labels; json-render's options are plain strings, so the labels are used as values");
        el = input(b.type === "choice" ? "Radio" : "Select", { label: p.label ?? "", name: p.name ?? id, options: opts.map((o) => o.label), placeholder: null, checks: null, validateOn: null });
        break;
      }
      case "checkbox": el = input("Checkbox", { label: p.label, name: id, checks: null, validateOn: null }, "checked"); break;
      case "switch": el = input("Switch", { label: p.label, name: id, checks: null, validateOn: null }, "checked"); break;
      case "slider": el = input("Slider", { label: p.label ?? null, min: p.min ?? null, max: p.max ?? null, step: p.step ?? null }); break;
      case "stat": el = withKids({ type: "Card", props: { title: p.label ?? "", description: p.caption ?? null } }); E[id + "-value"] = { type: "Heading", props: { text: String(read(id).value ?? ""), level: "h2" } }; el.children = [id + "-value"]; frozen.add(id); break;
      case "table": el = { type: "Table", props: { columns: (p.columns as J[] ?? []).map((c) => c.label ?? c.key), rows: (p.rows as J[] ?? []).map((r) => (p.columns as J[]).map((c) => String(r[c.key] ?? ""))), caption: null } }; break;
      case "accordion": el = { type: "Accordion", props: { items: (p.items as J[] ?? []).map((i) => ({ title: i.title, content: i.body })), type: "single" } }; break;
      case "carousel": el = { type: "Carousel", props: { items: (p.slides as J[] ?? []).map((s) => ({ title: s.title ?? null, description: s.text ?? null })) } }; break;
      case "tabs": { const k = boundKey(b, "value"); el = withKids({ type: "Tabs", props: { tabs: (p.tabs as J[] ?? []).map((t) => ({ label: t.label, value: t.id ?? t.value ?? t.label })), defaultValue: null, value: k ? { $bindState: ptrOf(k) } : null } }); break; }
      case "gauge": el = { type: "Progress", props: { value: Number(read(id).value ?? 0), max: p.max ?? 100, label: p.label ?? null } }; frozen.add(id); break;
      case "modal": el = withKids({ type: "Dialog", props: { title: p.label ?? "", description: null, openPath: "/" + id + "_open" } }); note("modal opens from state; check how your json-render renderer opens a Dialog"); break;
      default:
        el = withKids({ type: "Stack", props: { direction: "vertical", gap: "md" } });
        note(`${b.type} has no json-render equivalent (it was kept as a plain stack of its children, or empty)`);
    }
    if (!el) continue;
    if (b.visible !== undefined) { const v = vis(b.visible, id, notes); el.visible = v; }
    E[id] = el;
  }
  for (const el of Object.values(E)) if (el.children) el.children = el.children.filter((c) => E[c]);
  for (const id of frozen) notes.push(`${id}: a computed value was frozen at its initial state; json-render has no calculations`);
  const state: J = {};
  for (const [k, v] of Object.entries(doc.state ?? {})) state[k] = v;
  return { value: { root: doc.root, elements: E, ...(Object.keys(state).length ? { state } : {}) }, notes: [...new Set(notes)] };
}

/** A Kage `visible` expression as json-render conditions, for the forms that exist there. */
function vis(e: unknown, id: string, notes: string[]): unknown {
  const o = e as J;
  const single = (x: J): J | null => {
    if (x.$eq && x.$eq[0]?.$state !== undefined && typeof x.$eq[1] !== "object") return { $state: ptrOf(x.$eq[0].$state), eq: x.$eq[1] };
    if (x.$neq && x.$neq[0]?.$state !== undefined && typeof x.$neq[1] !== "object") return { $state: ptrOf(x.$neq[0].$state), neq: x.$neq[1] };
    if (x.$state !== undefined && Object.keys(x).length === 1) return { $state: ptrOf(x.$state) };
    if (x.$not && x.$not.$state !== undefined) return { $state: ptrOf(x.$not.$state), not: true };
    return null;
  };
  const s = single(o);
  if (s) return s;
  if (o?.$and) { const parts = (o.$and as J[]).map((x) => vis(x, id, notes)); return { $and: parts }; }
  if (o?.$or) { const parts = (o.$or as J[]).map((x) => vis(x, id, notes)); return { $or: parts }; }
  if (o?.$not) { notes.push(`${id}: a negated compound visibility condition is not portable; the block is always shown`); return true; }
  notes.push(`${id}: a visibility condition json-render cannot express was treated as always shown`);
  return true;
}

// ---------------------------------------------------------------- checking a spec

/** Required props per shadcn component (packages/shadcn/src/catalog.ts: the non-nullable fields). */
const REQUIRED: Record<string, string[]> = {
  Card: [], Stack: [], Grid: [], Separator: [], Tabs: ["tabs"], Accordion: ["items"], Collapsible: ["title"], Dialog: ["title"], Drawer: ["title"], Carousel: ["items"],
  Table: ["columns", "rows"], Heading: ["text"], Text: ["text"], Image: ["alt"], Avatar: ["name"], Badge: ["text"], Alert: ["title"], Progress: ["value"], Skeleton: [], Spinner: [],
  Tooltip: [], Popover: [], Input: ["label", "name"], Textarea: ["label", "name"], Select: ["label", "name", "options"], Checkbox: ["label", "name"], Radio: ["label", "name", "options"],
  Switch: ["label", "name"], Slider: [], Button: ["label"], Link: ["label", "href"], DropdownMenu: [], Toggle: [], ToggleGroup: [], ButtonGroup: [], Pagination: [],
};

/** Structural problems that would make a json-render renderer fail: unknown component, missing required prop, dangling or shared child, unreachable element. */
export function checkJsonRender(spec: JrSpec): string[] {
  const p: string[] = [];
  if (!spec.elements?.[spec.root]) return [`root "${spec.root}" is not among the elements`];
  const parent = new Map<string, string>();
  for (const [k, el] of Object.entries(spec.elements)) {
    if (!(el.type in REQUIRED)) p.push(`${k}: "${el.type}" is not a component of the shadcn catalog`);
    for (const r of REQUIRED[el.type] ?? []) if (el.props?.[r] === undefined) p.push(`${k}: ${el.type} needs "${r}"`);
    for (const c of el.children ?? []) {
      if (!spec.elements[c]) p.push(`${k}: child "${c}" does not exist`);
      else if (parent.has(c)) p.push(`${c}: is the child of both "${parent.get(c)}" and "${k}"`);
      else parent.set(c, k);
    }
  }
  const seen = new Set<string>(), walk = (k: string) => { if (seen.has(k) || !spec.elements[k]) return; seen.add(k); (spec.elements[k].children ?? []).forEach(walk); };
  walk(spec.root);
  for (const k of Object.keys(spec.elements)) if (!seen.has(k)) p.push(`${k}: is not reachable from the root`);
  return p;
}
