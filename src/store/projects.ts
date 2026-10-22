// Projects as an ADDITIVE, mutable, workspace-scoped layer on top of the signed
// identity. A Kage's home `repo` is baked into its immutable ref and drives
// permissions; projects never touch that. They add two things the ref cannot:
// a registry of project names that exist even when empty (so a brand-new project
// persists and shows in the sidebar), and a per-Kage set of EXTRA projects it
// belongs to. Membership is organizational only — reading a Kage still flows
// through its home repo, never through a project it was merely tagged into.

/** A project name has the same shape as a repo so the two namespaces are
 *  interchangeable in the UI (a project filter is a repo filter). */
export const PROJECT_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** A listing row: the project and how many readable Kages are in it (home repo
 *  OR membership). A registry entry with no members still appears, with count 0. */
export interface ProjectCount {
  project: string;
  count: number;
}
