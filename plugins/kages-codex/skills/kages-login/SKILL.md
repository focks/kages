---
name: kages-login
description: "Sign in to a Kages deployment so you can work in the user's own workspace instead of the local one or the anonymous read-only demo: `kages auth login`, checking the session, getting a token for push or the hosted MCP server, and what to do when the sign-in fails or expires. Use when a command says 'not signed in', a write is refused as anonymous, or the user wants their Kages in the cloud."
---

# Signing in to Kages

Without a session you work in the local `./.kages` workspace, or read the anonymous demo. Signing in points the CLI and `kages mcp` at the user's cloud workspace.

## 1. Check first
```
kages auth status      # "signed in as <email> @ <deployment>" or "not signed in"
```
If it says signed in, stop: do not log in again. Expired access tokens refresh by themselves; only a dead refresh token asks for a new login.

## 2. Ask the person to sign in
`kages auth login` opens a browser for Google sign-in and waits up to three minutes for it. **You cannot complete it for them**, and you must never ask for their password or a Google code. Run it only where they can see the browser: ask them to run `kages auth login` in their own terminal and tell you when it prints `signed in as`.

For a self-hosted deployment add `--url https://their-host` (or set `KAGES_API`). It prints the sign-in URL as well, for a machine where no browser opens: they can open it anywhere, but the callback needs port 52525 on the machine running the command, so over SSH forward that port.

When it prints `signed in as <email>`, run `kages auth status` to confirm. `kages mcp login` is the same sign-in, for the stdio MCP server.

## 3. Use the session
- `kages remote <op> '<json>'` calls any operation on the deployment as them, e.g. `kages remote list_kages`.
- `kages mcp` (stdio) routes to their cloud workspace while signed in, else to `./.kages`; `kages mcp info` states which.
- `kages push` and the hosted MCP server (`/api/mcp`) take a bearer token, not the cached session: `--token` or `KAGES_TOKEN`. The token is `session.access_token` in `~/.kages/config.json` and lasts about an hour. Put it in the environment for one command; never print it, paste it into a file, a Kage, a commit or a chat message.

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
