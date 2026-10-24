---
name: agent-onboarding
description: Login, destination readiness and skill discovery across Kages browser, CLI and MCP. Read when changing first-run setup, authentication guidance or agent discovery.
---

# Agent onboarding

Browser cookies, the CLI session and a hosted MCP Bearer credential are separate.
Never imply that signing into one authenticates the others. Cloud workspaces are
provisioned on first authenticated access; `kages init` prepares local files.
A missing workspace brief does not block a clear user task.

Every client starts with `get_setup`, verifies the destination, then calls
`get_context`. Context includes the generated authoring skill; the normal tool
`get_authoring_guide` retrieves exact allowlisted reference paths. MCP prompts
are user-controlled and some hosts omit them. Keep initialize instructions,
resources and prompts as additional discovery paths, not the only path.

Stdio re-reads auth on each tool call. Without login, refuse cloud mutations;
never silently switch to a local store after login failure or logout. `--local`
is the explicit offline mode. A local publish cannot yield a hosted URL. Rendering
by stored name must use the same destination as authoring.

The browser onboarding status proves browser connectivity only. Checklist marks
are progress, not a test of the agent connection. Always ask the agent itself to
call `get_setup` before the first creation.

Codex skills live in `.agents/skills/<name>/SKILL.md` at project or user scope,
with relative references. Do not install into legacy `.codex/prompts`. Use the
same generated skill content in installers, plugins, MCP and get_context.

`src/distribution.ts` pins onboarding to the tested release tarball. Publish that
asset before deploying instructions that depend on it. The npm registry may lag;
never claim `npm install @ifocksh/kages` contains unreleased fixes.

Verify with an empty config home: initialize, read guidance, refuse unauthenticated
creation, add a test login while the process runs, create against a fake cloud,
logout and prove no local fallback. Keep real credentials out of tests and logs.
