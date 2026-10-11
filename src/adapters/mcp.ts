// MCP adapter. Like every other surface it is a thin translation of the one
// operation set — here onto the Model Context Protocol:
//   • tools     — every operation (served from the generated mcpTools() schema)
//   • prompts   — the per-system skill packs (MCP has no "skill" primitive; a
//                 prompt is its analog — a named, discoverable instruction set)
//   • resources — each system's catalog and the agent card
// It uses the low-level Server so tools/list can hand back the generated JSON
// Schemas verbatim (no Zod, no drift). The caller supplies `exec`, which is the
// same dispatch the CLI/REST use, so an MCP client can do exactly what they can.
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

/** The id behind a `kages-<system>` prompt/skill name, or undefined if unknown. */
const systemOf = (name: string) => {
  const id = name.replace(/^kages-/, "");
  return systems[id] ? id : undefined;
};

export function createMcpServer(exec: Exec): Server {
  const server = new Server(
    { name: "kages", version: "1.0.0" },
    { capabilities: { tools: {}, prompts: {}, resources: {} } },
  );

  // --- tools: the operation table ---
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools() }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const r = await exec(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>);
    // Operation/business errors come back as a result with isError so the model
    // can self-correct (per the MCP tool-error convention), not as a transport fault.
    if (!r.ok) return { isError: true, content: [{ type: "text", text: `error ${r.error.code}: ${r.error.msg}` }] };
    const text = typeof r.data === "string" ? r.data : JSON.stringify(r.data, null, 2);
    return { content: [{ type: "text", text }] };
  });

  // --- prompts: the skill packs (one per design system) ---
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: Object.values(systems).map((s) => ({
      name: `kages-${s.id}`,
      description: `Author Kages in the ${s.name} design system (${s.id}@${s.version}).`,
    })),
  }));
  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const id = systemOf(req.params.name);
    if (!id) throw new Error(`unknown skill '${req.params.name}'`);
    return {
      description: `Kages authoring skill — ${systems[id].name}`,
      messages: [{ role: "user", content: { type: "text", text: pack(id)["SKILL.md"] } }],
    };
  });

  // --- resources: catalogs + the agent card ---
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      ...Object.values(systems).map((s) => ({
        uri: `kages://catalog/${s.id}`,
        name: `${s.name} catalog`,
        description: `Component catalog for ${s.id}@${s.version}.`,
        mimeType: "text/plain",
      })),
      { uri: "kages://agent-card", name: "Kages agent card", mimeType: "application/json" },
    ],
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const uri = req.params.uri;
    if (uri === "kages://agent-card") {
      return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(a2aCard(), null, 2) }] };
    }
    const m = /^kages:\/\/catalog\/(.+)$/.exec(uri);
    if (m && systems[m[1]]) return { contents: [{ uri, mimeType: "text/plain", text: catalog(m[1]) }] };
    throw new Error(`unknown resource '${uri}'`);
  });

  return server;
}
