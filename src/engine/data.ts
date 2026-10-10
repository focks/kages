// The reference registry data, extracted verbatim from the oracle bundle:
// three design systems, 24 component contracts, 12 interfaces.
// Regenerate with scripts/extract-data.mjs if the reference changes.

import systemsJson from "./data/systems.json" with { type: "json" };
import contractsJson from "./data/contracts.json" with { type: "json" };
import interfacesJson from "./data/interfaces.json" with { type: "json" };

import type { System, Contract, Interface } from "./types.ts";

export const systems = systemsJson as unknown as Record<string, System>;
export const contracts = contractsJson as unknown as Record<string, Contract>;
export const interfaces = interfacesJson as unknown as Record<string, Interface>;
