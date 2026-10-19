# REST API

Every capability in Kages is one operation, and the REST API is the plainest way to call it: an HTTP POST per operation, a JSON body of parameters, and a JSON result. The CLI, the MCP server and the generated OpenAPI all speak to the same operation table, so anything documented here works the same from each.

## Reading a share link as markdown

A published Kage's share link `/k/<uuid>` returns markdown when the request says `Accept: text/markdown`, and `/k/<uuid>.md` always does. The page starts with install and call instructions, then the Kage as text inside a fenced block marked as the author's data. It follows the same read rules as `GET /api/shared/<uuid>`: a private Kage answers exactly like one that does not exist. `/agents.md` is the site-wide guide for agents (connect, the order to call operations, rules), and `/llms.txt` indexes both.

## Routing

Each operation is `POST /api/<op>` with a JSON body holding its parameters. A read operation also accepts `GET /api/<op>` with the parameters as query string values. A write over GET is refused with `405`, because a safe method must never change data.

## Authentication

There are three ways a request is identified, and which one applies depends on how the deployment is configured.

| Mode | How | Sees |
|------|-----|------|
| Anonymous | No credentials | Published link and public Kages only; writes are refused |
| Bearer token | `Authorization: Bearer <token>` from `kages auth login` | Your workspace |
| Browser session | The signed-in cookie | Your workspace (REST only) |

With authentication enabled, an anonymous write returns `401`. Running with no auth configured (local development) treats every request as the demo owner, so everything works without signing in. The MCP endpoint is bearer-only — it ignores cookies so a web page can never make a request with a visitor's ambient session.

## Responses and status codes

A successful call returns the operation's data with `200`. A failure returns `{ "error": { "code": "...", "msg": "..." } }` with a status that matches the kind of failure.

| Code | Status | Meaning |
|------|--------|---------|
| `not_found` | 404 | No such operation, Kage or version |
| `unauthorized` | 401 | Sign in to write |
| `forbidden` | 403 | The caller lacks the grant |
| `conflict` | 409 | A concurrent change, or a name already taken |
| `claimed` | 409 | A block is leased by someone else |
| `rate_limited` | 429 | Too many writes in the window |
| `invalid_content` | 422 | The document or patch did not validate |
| `unavailable` | 503 | Storage is unreachable |

## Examples

Read a Kage by name with a token:

```sh
curl -H "Authorization: Bearer $KAGES_TOKEN" \
  "https://your-app/api/get_kage?name=weekly-report"
```

Publish it to a shareable link:

```sh
curl -X POST -H "Authorization: Bearer $KAGES_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"weekly-report","visibility":"link"}' \
  https://your-app/api/publish_kage
```

The full parameter list for every operation is in the [operations reference](mcp.md), generated from the same table these routes serve.

## The MCP endpoint

`POST /api/mcp` is a stateless Streamable-HTTP MCP server. One POST carries one JSON-RPC message, or a batch of up to a hundred, and the server answers with `application/json`. It exposes every operation as a tool, the per-system authoring guides as prompts, and the catalogs as resources. Because it keeps no session, it scales flat. An agent host connects once and gets the whole operation set.

## OpenAPI and the agent card

Two descriptions are generated from the operation table, so they never fall behind it. `GET /api/openapi.json` is an OpenAPI 3.1 document for the REST surface; `GET /.well-known/agent-card.json` is the A2A agent card. The CLI prints the same artifacts with `kages openapi`, `kages agent-card` and `kages mcp-tools`, which is handy for wiring a client without a running server.

## Public reads

A published Kage with `link` or `public` visibility is readable without a workspace. The share page is `/k/<uuid>`, keyed by the Kage's opaque id rather than its name, and `GET /api/shared/<uuid>` returns the document behind it. How a Kage reaches that state, and who may read each visibility level, is covered in [lifecycle and sharing](lifecycle-and-sharing.md).
