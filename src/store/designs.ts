// Workspace designs as store records: the validated definition plus the bookkeeping the brief already uses
// (revision for optimistic writes, who and when). Pure types and helpers; permissions and persistence live in
// the store, exactly as for the brief.
import type { DesignDef } from "../engine/design.ts";

export interface DesignRecord {
  id: string;
  def: DesignDef;
  revision: number;
  /** The design new Kages start in. At most one record holds it. */
  default?: boolean;
  updatedAt: string;
  updatedBy: string;
}

export const MAX_DESIGNS = 50;
