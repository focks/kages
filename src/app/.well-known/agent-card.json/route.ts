// A2A discovery: agents fetch the agent card to learn Kages' skills and
// endpoints. Generated from the operation table's surfaces.

import { a2aCard } from "@/adapters/surfaces.ts";

export function GET() {
  return Response.json(a2aCard());
}
