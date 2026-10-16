// The names of the improvement moves (`kages improve <command>`). Only the names live
// here, in the pure engine, because storage validates against them (a saved critique
// may suggest one); the playbooks themselves are in src/packs/commands.
export const IMPROVE_COMMANDS = ["critique", "polish", "distill", "harden", "clarify", "onboard", "adapt", "quieter", "bolder"] as const;
export type ImproveCommand = (typeof IMPROVE_COMMANDS)[number];
export const isImproveCommand = (s: unknown): s is ImproveCommand => typeof s === "string" && (IMPROVE_COMMANDS as readonly string[]).includes(s);
