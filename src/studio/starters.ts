// Starting shape is an author choice, independent of the product's navigation.
// Every picker entry is a complete portable document, also available to agents.
import type { KageDoc } from "../engine/types.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples } from "../packs/examples.ts";

/** Fresh documents let an author edit one starter without mutating another. */
export function studioStarters(): KageDoc[] {
  return [{ kages: "1.0", id: "blank", title: "Blank canvas", system: "core@1", root: "root", blocks: { root: { type: "page", props: { width: "wide" } } } }, ...freeFlowExamples(), ...expressiveExamples(), ...richExamples(), ...appExamples()];
}
