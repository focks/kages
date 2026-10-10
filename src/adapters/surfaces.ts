// Adapter surfaces, GENERATED from the operation table. Because every surface
// comes from OPERATIONS, adding an operation adds it to REST, MCP, A2A and the
// tool defs at once, and none can describe an operation the dispatcher doesn't
// implement. Hand-writing any of these would let them drift from the validator;
// generation makes drift impossible. See oracle/agent-access.feature.

import { OPERATIONS, type OpSpec } from "./operations.ts";

type Json = Record<string, unknown>;

function paramSchema(spec: OpSpec): Json {
  const properties: Json = {};
  const required: string[] = [];
  for (const raw of spec.params) {
    const optional = raw.endsWith("?");
    const name = optional ? raw.slice(0, -1) : raw;
    // The table carries param NAMES, not types; the real contract is enforced
    // by validate()/the engine, so the transport schema is intentionally
    // permissive rather than falsely precise.
    properties[name] = { description: `${name} parameter` };
    if (!optional) required.push(name);
  }
  return { type: "object", properties, required, additionalProperties: true };
}

/** OpenAI-style function-calling tool definitions — one per operation. The REST
 *  adapter's OpenAPI doubles as these for frameworks that read either. */
export function toolDefs(): Json[] {
  return OPERATIONS.map((o) => ({ type: "function", function: { name: o.name, description: o.summary, parameters: paramSchema(o) } }));
}

/** MCP tools manifest: tools mirror the operations; resources (catalogs, cards)
 *  are served separately by the MCP adapter. */
export function mcpTools(): Json[] {
  return OPERATIONS.map((o) => ({ name: o.name, description: o.summary, inputSchema: paramSchema(o) }));
}

/** OpenAPI 3.1. Every operation is POST /op/{name} with a params body — uniform
 *  so the generator is trivial and the file doubles as function-calling defs. */
export function openapi(baseUrl = "/api"): Json {
  const paths: Json = {};
  for (const o of OPERATIONS) {
    paths[`/${o.name}`] = {
      post: {
        operationId: o.name,
        summary: o.summary,
        requestBody: { required: o.params.some((p) => !p.endsWith("?")), content: { "application/json": { schema: paramSchema(o) } } },
        responses: { "200": { description: "ok" }, "4XX": { description: "operation error (code + msg)" } },
      },
    };
  }
  return { openapi: "3.1.0", info: { title: "Kages API", version: "1.0.0" }, servers: [{ url: baseUrl }], paths };
}

/** A2A agent card at /.well-known/agent-card.json. Other agents delegate whole
 *  tasks ("make a dashboard of this CSV") and receive a Kage reference. */
export function a2aCard(baseUrl = "https://kages.app"): Json {
  return {
    name: "Kages",
    description: "An artifactory for agents: build, revise and read interactive Kages.",
    url: baseUrl,
    version: "1.0.0",
    capabilities: { streaming: true },
    endpoints: { jsonrpc: `${baseUrl}/a2a` },
    skills: [
      { id: "build-kage", name: "Build a Kage", description: "Create a Kage from a description, CSV, or data. Returns a kages:// reference." },
      { id: "revise-kage", name: "Revise a Kage", description: "Patch an existing Kage by reference." },
      { id: "describe-kage", name: "Describe a Kage", description: "Return the text view of a Kage for agents without vision." },
    ],
  };
}
