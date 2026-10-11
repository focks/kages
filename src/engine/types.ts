// Core Kages types. Loose where the reference is dynamic; precise at the
// boundaries the oracle feature files pin down.

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** An expression is a Json value; objects whose first key is an operator are evaluated. */
export type Expr = Json;

export interface PropSpec {
  type?: string;
  enum?: Json[];
  default?: Json;
  required?: boolean;
  items?: PropSpec;
  properties?: Record<string, PropSpec>;
  requiredKeys?: string[];
  description?: string;
}

export interface SlotSpec {
  max?: number;
  required?: boolean;
  accepts?: string[];
}

export interface Contract {
  $contract: "kages.contract/1";
  id: string;
  version: string;
  ref: string;
  system: string;
  name: string;
  role?: string;
  implements: string[];
  summary: string;
  props: Record<string, PropSpec>;
  slots: Record<string, SlotSpec>;
  local: Record<string, { type: string; default?: Json }>;
  outputs: string[];
  events: Record<string, { handler: string; payload: Record<string, string> }>;
  commands: Record<string, Action[]>;
  defaults: Record<string, Action[]>;
  limits: Record<string, number>;
  tokens: string[];
  agent: { use?: string; avoid?: string };
  a11y?: Json;
}

export interface System {
  id: string;
  name: string;
  version: string;
  className: string;
  extends: string | null;
  summary: string;
  components: Record<string, string>; // role -> contract ref
}

export interface Interface {
  role?: string;
  summary?: string;
  props: Record<string, PropSpec>;
  local?: Record<string, { type: string; default?: Json }>;
  slots?: Record<string, SlotSpec>;
  events?: Record<string, { handler: string; payload: Record<string, string> }>;
  outputs?: string[];
  commands?: Record<string, Action[]>;
}

export interface Action {
  do: string;
  when?: Expr;
  path?: string;
  value?: Expr;
  target?: string;
  command?: string;
  args?: Expr;
  key?: string;
  prompt?: Expr;
  into?: string;
  pendingInto?: string;
  onError?: Action[];
  source?: string;
  name?: string;
  payload?: Expr;
  message?: Expr;
  model?: string;
  schema?: Json;
  agent?: string;
  input?: Expr;
  mock?: Json;
}

export interface Block {
  type: string;
  props?: Record<string, Json>;
  bind?: Record<string, Expr>;
  slots?: Record<string, string[]>;
  on?: Record<string, Action[]>;
  visible?: Expr;
  repeat?: { each: Expr; as?: string; key?: string };
  meta?: Json;
}

export interface Composition {
  inputs: Record<string, PropSpec>;
  root: string;
  blocks: Record<string, Block>;
  output?: Expr;
  outputType?: PropSpec;
}

export interface KageDoc {
  kages: string;
  id: string;
  title: string;
  system: string;
  root: string;
  blocks: Record<string, Block>;
  state?: Record<string, Json>;
  persist?: Record<string, "personal" | "shared">;
  data?: Record<string, Json>;
  sources?: Record<string, Json>;
  compositions?: Record<string, Composition>;
  resolved?: { system: string; blocks: Record<string, string> };
  meta?: Json;
}

export interface Finding {
  at: string;
  code: string;
  msg: string;
}

export interface ValidateResult {
  ok: boolean;
  errors: Finding[];
  warnings: Finding[];
  system: string;
  portable?: boolean;
}

/** Everything evaluate() can read. Nothing executable; `output` resolves a block's outputs. */
export interface EvalContext {
  state?: Record<string, Json>;
  data?: Record<string, Json>;
  locals?: Record<string, Record<string, Json>>;
  self?: string;
  event?: Json;
  item?: Json;
  index?: number;
  scope?: Record<string, Json>;
  input?: Record<string, Json>;
  output?: (id: string) => Record<string, Json> | undefined;
}

export interface ResolveOk {
  ref: string;
  contract: Contract;
  error?: undefined;
}
export interface ResolveErr {
  error: string;
  ref?: undefined;
  contract?: undefined;
}
export type ResolveResult = ResolveOk | ResolveErr;
