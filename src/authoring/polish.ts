// A conservative presentation proposal, shared by every operation adapter.
// Facts, bindings, events and explicit component pins are never rewritten;
// ambiguous color meaning is reported for the author instead of guessed.
import type { KageDoc } from "../engine/types.ts";
import { resolve, systemOf } from "../engine/resolve.ts";
import { applyPatch, type PatchOp } from "../collab/patch.ts";

export const PERSONALITIES = ["analytical", "editorial", "exploratory", "teaching", "showcase"] as const;
export interface PolishOptions { personality?: string; density?: string; appearance?: string }
export interface PolishFinding { block: string; message: string }
const pointer = (key: string) => key.replace(/~/g, "~0").replace(/\//g, "~1");

/** Produces a reversible patch and an unpinned preview without mutating the
 * signed source. Advice is subjective and deliberately separate from validation. */
export function planPolish(doc: KageDoc, options: PolishOptions = {}) {
  const patch: PatchOp[] = [], undo: PatchOp[] = [], findings: PolishFinding[] = [];
  const props = {
    personality: options.personality ?? "analytical",
    density: options.density ?? "comfortable",
    appearance: options.appearance ?? "inherit",
  };
  if (!PERSONALITIES.includes(props.personality as typeof PERSONALITIES[number]) || !["comfortable", "compact"].includes(props.density) || !["inherit", "light", "dark"].includes(props.appearance)) throw new Error("Invalid presentation choice");
  const root = doc.blocks[doc.root];
  if (!root) throw new Error("The document has no root block");
  const rootRole = resolve(systemOf(doc), root.type).contract?.name ?? root.type.split("/").at(-1)?.split("@")[0];
  if (rootRole === "canvas") {
    const path = `/blocks/${pointer(doc.root)}/props`;
    patch.push({ op: "add", path, value: { ...root.props, ...props } });
    undo.unshift(root.props ? { op: "replace", path, value: root.props } : { op: "remove", path });
    if (Object.keys(root.bind ?? {}).some(key => key in props)) findings.push({ block: doc.root, message: "Bound presentation properties override these defaults. Review those bindings before applying." });
    // Reposition whole block references, never rebuild their data or handlers.
    // Explicit component pins may lack the new slots and must remain untouched.
    if (!root.type.includes("@") && !root.slots?.lead?.length) {
      const children = root.slots?.children ?? [];
      const roleOf = (id: string) => { const block = doc.blocks[id]; return block ? resolve(systemOf(doc), block.type).contract?.name ?? block.type : ""; };
      const primary = children.find(id => /chart|diagram|small-multiples/.test(roleOf(id)));
      const controlRoles = new Set(["choice", "slider", "dropdown", "button", "text-input", "number-input", "source-status"]);
      const support = children.filter(id => id !== primary && (controlRoles.has(roleOf(id)) || roleOf(id) === "stack" && !!doc.blocks[id].slots?.children?.length && doc.blocks[id].slots!.children.every(child => controlRoles.has(roleOf(child)))));
      if (primary) {
        const slots = { ...root.slots, lead: [primary], support: [...(root.slots?.support ?? []), ...support], children: children.filter(id => id !== primary && !support.includes(id)) };
        patch.push({ op: "add", path: `/blocks/${pointer(doc.root)}/slots`, value: slots });
        undo.unshift(root.slots ? { op: "replace", path: `/blocks/${pointer(doc.root)}/slots`, value: root.slots } : { op: "remove", path: `/blocks/${pointer(doc.root)}/slots` });
      }
    }
  } else {
    let id = "presentation";
    while (Object.hasOwn(doc.blocks, id)) id += "_";
    patch.push({ op: "add", path: `/blocks/${id}`, value: { type: "canvas", props, slots: { children: [doc.root] } } }, { op: "replace", path: "/root", value: id });
    undo.push({ op: "replace", path: "/root", value: doc.root }, { op: "remove", path: `/blocks/${id}` });
  }
  const domains = new Map<string, string>(), serializedBlocks = JSON.stringify(doc.blocks);
  for (const [id, block] of Object.entries(doc.blocks)) {
    const contract = resolve(systemOf(doc), block.type).contract, role = contract?.name ?? block.type.split("/").at(-1)!.split("@")[0], p = block.props ?? {};
    if (/chart|histogram|box-plot|waterfall|small-multiples|treemap|sankey|heatmap/.test(role)) {
      if (!p.unit && !block.bind?.unit) findings.push({ block: id, message: "Add units or explain why the values are unitless." });
      if (!p.source && !block.bind?.source) findings.push({ block: id, message: "Identify the source or label the data as illustrative." });
      if (!p.takeaway && !block.bind?.takeaway) findings.push({ block: id, message: "Explain what the reader should learn from this chart." });
      if (Array.isArray(p.colorDomain)) {
        p.colorDomain.forEach((key, index) => {
          if (typeof key !== "string") return;
          const previous = domains.get(key), color = String(index % 8);
          if (previous !== undefined && previous !== color) findings.push({ block: id, message: `Category “${key}” has a different color position elsewhere. Align related colorDomain arrays.` });
          domains.set(key, color);
        });
        if (p.colorDomain.length > 8) findings.push({ block: id, message: "More than eight categories reuse colors. Add direct labels or split the comparison." });
      } else if (["donut-chart", "treemap", "sankey", "stacked-bar-chart", "combo-chart"].includes(role)) findings.push({ block: id, message: "Declare a shared colorDomain for related categorical charts." });
    }
    if (p.interactive === true && !block.on && !serializedBlocks.includes(`\"$block\":\"${id}`)) findings.push({ block: id, message: "Selection can be local, but consider connecting it to a useful explanation or related view." });
    if (role === "grid" && Number(p.columns) > 3) findings.push({ block: id, message: "Review this dense grid at 390px; responsive wrapping alone does not prove readability." });
    if (role === "diagram" && Array.isArray(p.nodes) && p.nodes.length > 12 && !p.explore) findings.push({ block: id, message: "Enable graph exploration or split this diagram into smaller explanations." });
  }
  const candidate = applyPatch(doc, patch) as KageDoc;
  const { resolved: _pin, ...preview } = candidate;
  return { patch, undo, findings, preview: preview as KageDoc, changes: [rootRole === "canvas" ? "Apply the selected canvas presentation." : "Wrap the existing content in a presentation canvas.", ...(patch.some(op => op.path.endsWith("/slots")) ? ["Move the primary visual into the lead area and supporting controls into an adaptive pane."] : []), "Preserve data, prose, controls and explicit component references."] };
}
