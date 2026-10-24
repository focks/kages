# Account, workspace and agent onboarding

The first-run flow previously omitted required cloud login in the CLI track,
called cloud authentication optional in the npx track, and treated checking boxes
as proof that the agent could create. MCP processes captured login state at
startup; an unsigned process could write locally after the user signed in.
Skills were mostly exposed as prompts, and the Codex installer wrote legacy
manual prompts instead of discoverable skill folders.

The revised flow is account → install → agent login → verify cloud workspace →
connect MCP/load guidance → create and verify a first Kage. Browser and agent
credentials are explained separately. A cloud workspace is automatically
provisioned on authenticated access; local `kages init` is not cloud setup.
The browser status panel identifies its own scope and offers retry on failure.
A missing product brief does not block a clear creation request.

`get_setup` reports identity, destination and next steps without returning tokens.
`get_context` includes the selected generated skill. `get_authoring_guide` exposes
exact skill/reference/example paths as an ordinary tool. Initialize instructions,
`kages://start` and skill resources provide additional discovery. MCP prompts are
optional: [MCP describes their user-controlled interaction model](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/server/prompts.mdx).

Stdio rechecks the session on every tool call. Missing login or logout blocks
cloud writes instead of falling back locally. Intentional local work uses
`--local`; rendering a stored name follows the same destination as authoring.
Codex skills now install to `.agents/skills` at project or user scope, matching
[the documented discovery locations](https://learn.chatgpt.com/docs/build-skills).

The published viewer again exposes “Are you an agent?” directly in its header,
including on phones. It opens the updated instructions and links to onboarding;
it is no longer nested inside “Use this Kage”.

Version 0.1.2 ships its tested CLI tarball at
https://app.getkages.com/downloads/ifocksh-kages-0.1.2.tgz. The versioned asset and
onboarding instructions deploy together. GitHub release assets are not suitable
for anonymous onboarding while the repository is private; the failed anonymous
download check caught this before the instructions went live. The npm registry
may lag. Existing installations must upgrade/reconnect to refresh their MCP tool
list. CLI login alone cannot authenticate hosted HTTP MCP; configure its Bearer
credential or use signed-in stdio. Run build:distribution after the final CLI
changes and before committing a release; never overwrite an already deployed
version's bytes.

Validation includes a real stdio client with an empty config home, blocked
creation, login while running, first cloud creation against a fake authenticated
server, logout and proof of no local fallback; tool-only skill/reference loading;
Codex project/user installation; browser anonymous/connected/unavailable states;
mobile/desktop onboarding; restored agent entry and existing preview scroll checks.
Real Google sign-in is user-interactive and was not automated by these tests.

Four conversion recipes cover Markdown, structured data (CSV/TSV/JSON/spreadsheets),
binary/text documents and webpages. One generated source is distributed through
plugins, both installers, MCP prompts/resources and get_authoring_guide(name).
get_context includes their discovery index. The documented Markdown example runs
through the actual transport schema, including its corrected toc enum.

Copy as Markdown sits above Download and Print in the published viewer. It resolves
current app-state bindings and block visibility without exporting arbitrary state
or diagnostic wiring. Charts become labelled data tables; diagrams become nodes
and relationships. Tables include all rows, and disclosures/tab panels include
content rather than depending on local expansion. Local-only zoom/pagination is
not captured. Clipboard refusal shows a selectable textarea. Export errors and
size limits are explicit. Unit checks cover code fences, quotes, table escaping,
chart families and source fidelity; the browser test imports CSV, copies that
view and exercises clipboard denial.
