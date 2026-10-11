// MCP adapter. Like every other surface it is a thin translation of the one
// operation set — here onto the Model Context Protocol:
//   • tools     — every operation (served from the generated mcpTools() schema)
//   • prompts   — the per-system skill packs (MCP has no "skill" primitive; a
//                 prompt is its analog — a named, discoverable instruction set)
//   • resources — each system's catalog and the agent card
// The leaf builders below are the single source of truth; two transports use
// them: createMcpServer() (stdio, via the SDK) and handleMcpMessage() (the
// Streamable-HTTP route's stateless JSON-RPC). The caller supplies `exec`, the
// same dispatch REST/CLI use, so an MCP client can do exactly what they can.
// See oracle/agent-access.feature.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { mcpTools, a2aCard } from "./surfaces.ts";
import type { OpResult } from "./operations.ts";
import { systems } from "../engine/data.ts";
import { catalog } from "../engine/catalog.ts";
import { pack } from "../packs/packs.ts";

export type Exec = (op: string, params: Record<string, unknown>) => Promise<OpResult>;

// The protocol revision we speak; initialize echoes the client's if it sends one.
const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "kages", version: "1.0.0" };
const CAPABILITIES = { tools: {}, prompts: {}, resources: {} };

// --- leaf builders (one source of truth for both transports) ---

const systemOf = (name: string) => {
  const id = name.replace(/^kages-/, "");
  return systems[id] ? id : undefined;
};

const promptList = () =>
  Object.values(systems).map((s) => ({
    name: `kages-${s.id}`,
    description: `Author Kages in the ${s.name} design system (${s.id}@${s.version}).`,
  }));

function getPromptResult(name: string) {
  const id = systemOf(name);
  if (!id) throw new Error(`unknown skill '${name}'`);
  return {
    description: `Kages authoring skill — ${systems[id].name}`,
    messages: [{ role: "user", content: { type: "text", text: pack(id)["SKILL.md"] } }],
  };
}

const resourceList = () => [
  ...Object.values(systems).map((s) => ({
    uri: `kages://catalog/${s.id}`,
    name: `${s.name} catalog`,
    description: `Component catalog for ${s.id}@${s.version}.`,
    mimeType: "text/plain",
  })),
  { uri: "kages://agent-card", name: "Kages agent card", mimeType: "application/json" },
];

function readResourceResult(uri: string) {
  if (uri === "kages://agent-card") {
    return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(a2aCard(), null, 2) }] };
  }
  const m = /^kages:\/\/catalog\/(.+)$/.exec(uri);
  if (m && systems[m[1]]) return { contents: [{ uri, mimeType: "text/plain", text: catalog(m[1]) }] };
  throw new Error(`unknown resource '${uri}'`);
}

async function callToolResult(exec: Exec, name: string, args: Record<string, unknown>) {
  const r = await exec(name, args ?? {});
  // Operation/business errors come back as a result with isError so the model
  // can self-correct (per the MCP tool-error convention), not as a transport fault.
  if (!r.ok) return { isError: true, content: [{ type: "text", text: `error ${r.error.code}: ${r.error.msg}` }] };
  const text = typeof r.data === "string" ? r.data : JSON.stringify(r.data, null, 2);
  return { content: [{ type: "text", text }] };
}

// --- transport 1: stdio (SDK Server) ---

export function createMcpServer(exec: Exec): Server {
  const server = new Server(SERVER_INFO, { capabilities: CAPABILITIES });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (req) =>
    callToolResult(exec, req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>));
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: promptList() }));
  server.setRequestHandler(GetPromptRequestSchema, async (req) => getPromptResult(req.params.name));
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: resourceList() }));
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => readResourceResult(req.params.uri));
  return server;
}

// --- transport 2: Streamable HTTP (stateless JSON-RPC over one POST) ---

interface JsonRpc { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown>; }

/** Handle one JSON-RPC message. Returns the response object, or null for a
 *  notification (no id → the route replies 202 with no body). */
export async function handleMcpMessage(exec: Exec, msg: JsonRpc): Promise<object | null> {
  const { id, method, params = {} } = msg;
  const ok = (result: object) => ({ jsonrpc: "2.0" as const, id, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0" as const, id, error: { code, message } });
  const isNotification = id === undefined || id === null;

  try {
    switch (method) {
      case "initialize":
        return ok({
          protocolVersion: (params.protocolVersion as string) ?? PROTOCOL_VERSION,
          capabilities: CAPABILITIES,
          serverInfo: SERVER_INFO,
        });
      case "ping":
        return ok({});
      case "tools/list":
        return ok({ tools: mcpTools() });
      case "tools/call":
        return ok(await callToolResult(exec, params.name as string, (params.arguments ?? {}) as Record<string, unknown>));
      case "prompts/list":
        return ok({ prompts: promptList() });
      case "prompts/get":
        return ok(getPromptResult(params.name as string));
      case "resources/list":
        return ok({ resources: resourceList() });
      case "resources/read":
        return ok(readResourceResult(params.uri as string));
      default:
        // Unknown notifications (e.g. notifications/initialized) are ignored.
        return isNotification ? null : fail(-32601, `method not found: ${method}`);
    }
  } catch (e) {
    return isNotification ? null : fail(-32603, (e as Error).message);
  }
}
