// Artifactory domain types. The store is agent-neutral: a principal may be a
// user, an agent, or a service, and every one of them writes through the same
// permission model and leaves the same provenance. See oracle/artifactory.feature.

import type { KageDoc, ValidateResult } from "../engine/types.ts";
import type { Signature } from "./crypto.ts";

export type PrincipalKind = "user" | "agent" | "service";
export type Grant = "read" | "write" | "review" | "publish" | "admin";
export type LifecycleState = "draft" | "review" | "published" | "deprecated" | "archived";
export type Visibility = "private" | "workspace" | "link" | "public";
export type RepoKind = "kages" | "systems" | "skills" | "data";

export interface Principal {
  /** e.g. "user:ada", "agent:acme/support-triage", "service:ci". */
  id: string;
  kind: PrincipalKind;
}

export interface Runtime {
  framework?: string;
  model?: string;
  adapter?: string;
}

/** Who wrote a version and how — the record that makes a shared store trustworthy. */
export interface Provenance {
  principal: string;
  onBehalfOf?: string;
  runtime?: Runtime;
  run?: string;
  inputs?: Array<{ kind: string; ref: string; redacted?: boolean }>;
}

export interface VersionRecord {
  ref: string; // kages://<ws>/<repo>/<name>@v<n>
  parent: string | null;
  name: string;
  uuid: string; // stable opaque id, generated once at create and carried across versions — used for /k/<uuid> share links so they don't leak the name
  v: number;
  digest: string;
  signature: Signature;
  createdAt: string;
  author: Provenance;
  /** `kind` marks changes made by a tool rather than an author (e.g. "migration"). */
  change: { summary: string; ops: number; blocksTouched: string[]; kind?: string };
  resolved: NonNullable<KageDoc["resolved"]>;
  validation: { ok: boolean; errors: number; warnings: number };
  state: LifecycleState;
  visibility: Visibility;
  doc: KageDoc;
}

export interface AuditEntry {
  at: string;
  principal: string;
  action: string;
  ref: string;
}

/** A CloudEvent-shaped change notice emitted on the workspace stream. */
export interface KageEvent {
  type:
    | "kage.version.created"
    | "kage.published"
    | "kage.state.changed"
    | "kage.deleted"
    | "kage.action.emitted"
    | "kage.comment.created"
    | "kage.comment.resolved"
    | "kage.comment.deleted"
    | "workspace.brief.updated"
    | "workspace.design.updated"
    | "workspace.project.updated"
    | "system.published";
  ref: string;
  at: string;
  data?: Record<string, unknown>;
}

export interface WriteResult {
  ok: boolean;
  version?: VersionRecord;
  validation?: ValidateResult;
  error?: { code: string; msg: string };
}
