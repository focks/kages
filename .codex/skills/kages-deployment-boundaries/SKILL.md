---
name: kages-deployment-boundaries
description: Develop Kages self-hosting, deployment configuration and documentation, and hosted-service defaults while separating reusable source from private operations. Use when changing those boundaries; this skill does not initiate a deployment or require a full audit for unrelated changes.
---

# Kages deployment boundaries

Keep everything another operator needs to run their own Kages in the public
project. Keep the credentials and operational records of a particular installation
outside published source. Do not split application layers into private repositories
merely because the hosted service uses them.

## Decide where a file belongs

| Public project | Private installation |
| --- | --- |
| App, auth integrations, persistence code, database migrations | Populated environment files, service keys, OAuth secrets and sessions |
| Placeholder environment examples and local service configuration | Production database backups, data exports and customer content |
| Generic deployment templates and self-hosting guides | Admin/browser captures, revealed-key screenshots and incident records |
| Build, test and release workflow definitions | Provider account state, infrastructure state containing secrets and saved deployment credentials |

A provider name, public hostname, local project identifier, or environment-variable
name alone is not a secret. Inspect the actual contents and purpose. Generic
infrastructure definitions can be public; their live state and credentials need a
separate destination. A private operations repo is optional for account-specific
automation, not a prerequisite for developing Kages.

When cleanup is requested, prefer moving future operational outputs to an explicit
private location and narrowly ignoring their local directory. Avoid blanket ignores
for YAML, SQL, JSON, or images: they would hide legitimate source and migrations.
Ignoring a tracked file does not untrack it. Preserve existing backups and user
work unless their removal is authorized. Never reproduce a discovered credential
in a report, test, commit, or skill.

## Preserve the application boundaries

- Keep reusable auth, server, persistence, adapters, and migrations in this repo.
  Follow [kages-architecture](../../../.claude/skills/kages-architecture/SKILL.md)
  before changing their behavior.
- Read `src/server/auth-mode.ts` and its tests before changing startup guidance.
  Development or explicit `KAGES_LOCAL_MODE=1` grants local demo access. A built
  deployment without configured auth must remain closed to anonymous writes;
  do not suggest local mode to make a shared public host writable.
- Treat persistence and identity as separate settings. A `DATABASE_URL` does not
  supply authentication. Follow
  [persistence-backends](../../../.claude/skills/persistence-backends/SKILL.md)
  for backend precedence, migrations, and compare-and-swap guarantees.
- Keep service credentials server-side. Browser-visible configuration is a
  separate contract; verify the framework's build-time versus runtime behavior
  when documenting or changing public environment variables.
- Preserve published content-addressed assets. Read
  [artifact-sandbox](../../../.claude/skills/artifact-sandbox/SKILL.md) before
  changing asset deployment or retention: signed versions depend on old runtime
  and design-system bytes. CLI download archives and renderer history have
  different retention requirements; do not delete pinned assets as build clutter.

## Make self-hosting independent and explicit

Inspect `.env.example`, the scripts in `package.json`, `scripts/db-setup.mjs`,
`supabase/migrations/`, and the relevant auth routes when writing deployment
instructions. Document the supported local, persistent, and authenticated modes
with placeholders, including migration execution, build/start commands, auth
redirects, and how to check that writes require the intended identity.

Explain which values must exist during the build and which are read at runtime.
Include proxy, storage, or multi-instance constraints when the chosen target
needs them; verify current provider behavior in official documentation rather
than inferring it from another host. Add container or provider templates only
when the task calls for them.

Official hosted endpoints may remain defaults. When changing installation,
onboarding, or plugins, trace `src/distribution.ts`, `src/cli/auth.ts`,
`src/install/files.ts`, and `src/plugin/generate.ts` for assumptions about
`app.getkages.com`. Verify existing overrides and document an independent path.
Generated plugin files must come from their generator; follow
[kages-distribution](../../../.claude/skills/kages-distribution/SKILL.md).

## Completion and scope

For source or documentation work, deliver reviewable changes and the relevant
local checks. Use placeholders or an isolated test instance; never apply a setup
command to a production database merely to validate instructions. Record any
live behavior that remains unverified. For publication-wide checks, use
[kages-open-source-readiness](../kages-open-source-readiness/SKILL.md).

Execute deployments, production migrations, credential changes, or publication
only when included in the user's authorized task. Continue through already
authorized work without adding a separate approval ritual.

## Shared source

Maintain these instructions here. The matching
[Claude entrypoint](../../../.claude/skills/kages-deployment-boundaries/SKILL.md)
only routes to this file; update both discovery descriptions if the scope changes.
