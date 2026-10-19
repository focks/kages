// The New Kage picker: starting shapes a person can create in one click, independent of the product's navigation.
// Every picker entry is a complete portable document, also available to agents.
import type { KageDoc } from "../engine/types.ts";
import { freeFlowExamples, expressiveExamples, richExamples, appExamples, connectedExamples, chartExamples, contentExamples } from "./examples.ts";

/** Fresh documents on every call, so creating one starter never mutates another. */
export function starterDocs(): KageDoc[] {
  return [{ kages: "1.0", id: "blank", title: "Blank canvas", system: "core@1", root: "root", blocks: { root: { type: "page", props: { width: "wide" } } } }, ...freeFlowExamples(), ...expressiveExamples(), ...richExamples(), ...appExamples(), ...connectedExamples(), ...chartExamples(), ...contentExamples()];
}
