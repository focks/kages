// The OpenAPI 3.1 document, generated from the operation table. It doubles as
// function-calling tool definitions for frameworks that read OpenAPI.

import { openapi } from "@/adapters/surfaces.ts";

export function GET() {
  return Response.json(openapi("/api"));
}
