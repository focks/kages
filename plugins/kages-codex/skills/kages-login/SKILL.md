---
name: kages-login
description: "Sign in to a Kages deployment so you can work in the user's own workspace instead of the local one or the anonymous read-only demo: `kages auth login`, checking the session, getting a token for push or the hosted MCP server, and what to do when the sign-in fails or expires. Use when a command says 'not signed in', a write is refused as anonymous, or the user wants their Kages in the cloud."
---

# Signing in to Kages

Without a session, cloud MCP creation is blocked. Offline CLI commands may use local files; intentional local MCP requires `kages mcp --local`. Signing in points the CLI and `kages mcp` at the user's cloud workspace.

Install or update the tested release first: `npm install -g https://app.getkages.com/downloads/ifocksh-kages-0.1.2.tgz`. Reconnect MCP after upgrading so the client refreshes its tool list.

## 1. Check first
```
kages auth status      # "signed in as <email> @ <deployment>" or "not signed in"
```
If it says signed in, call `kages remote get_setup` and verify the intended host and workspace. A cached login is not proof that your current HTTP MCP connection is authenticated. Expired access tokens refresh by themselves; only a dead refresh token asks for a new login.

## 2. Ask the person to sign in
`kages auth login` opens a browser for Google sign-in and waits up to three minutes for it. **You cannot complete it for them**, and you must never ask for their password or a Google code. Run it only where they can see the browser: ask them to run `kages auth login` in their own terminal and tell you when it prints `signed in as`.

For a self-hosted deployment add `--url https://their-host` (or set `KAGES_API`). It prints the sign-in URL as well, for a machine where no browser opens: they can open it anywhere, but the callback needs port 52525 on the machine running the command, so over SSH forward that port.

When it prints `signed in as <email>`, run `kages auth status` to confirm. `kages mcp login` is the same sign-in, for the stdio MCP server.

## 3. Use the session
- `kages remote <op> '<json>'` calls any operation on the deployment as them, e.g. `kages remote list_kages`.
- `kages mcp` (stdio) routes to their cloud workspace while signed in. It rechecks the session on every call; without login it requires setup. Use `--local` for intentional offline work; `kages mcp info` states which.
- `kages push` and the hosted MCP server (`/api/mcp`) take a bearer token, not the cached session: `--token` or `KAGES_TOKEN`. The token is `session.access_token` in `~/.kages/config.json` and lasts about an hour. Put it in the environment for one command; never print it, paste it into a file, a Kage, a commit or a chat message.

After connecting, call get_setup from the agent itself, then get_context. The latter includes the authoring skill; get_authoring_guide fetches individual references even when MCP prompts/resources are unavailable. A personal cloud workspace is provisioned automatically. Set a workspace brief only from confirmed audience, purpose and constraints; a missing brief does not block a clear task.

Browser login, the CLI session, and an HTTP MCP Bearer header are separate. If a plugin remains anonymous after terminal login, switch that connection to signed-in stdio or configure its Bearer credential securely. Never promise that CLI login authenticates an existing HTTP connection.

## 4. When it fails
| Message | Meaning and fix |
| --- | --- |
| `not signed in — run kages auth login` | No session. Section 2. |
| `session expired — run kages auth login again` | The refresh token is dead. Ask for a new login. |
| `<url> has authentication disabled` | That deployment has no sign-in (a local dev server). Use `--server` with no token, or the local workspace. |
| `timed out waiting for sign-in` | Nobody finished the browser step in three minutes. Ask again; check port 52525 is free. |
| anonymous caller refused a write | The request had no token. Sign in, then retry. |

## 5. Signing out
`kages auth logout` clears the session from `~/.kages/config.json`. Do it only when asked, or when switching accounts.
