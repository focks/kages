Feature: Artifactory
  Kages stores every save as an immutable, signed version with provenance,
  under workspaces, repositories, lifecycle, RBAC and audit.

  Scenario: Repository kinds
    Then a workspace offers repos of kind kages, systems, templates, skills and data
    And every object has an address kages://<workspace>/<repo>/<name>@<version>

  Scenario: Every save is a new immutable version
    When a Kage is saved
    Then a new version is created and no existing version is modified
    And the version carries a digest, a signature, a lockfile and createdAt

  Scenario: Provenance on every version
    When any principal writes
    Then the version records principal, onBehalfOf if present, framework, model,
      adapter, run id, a change summary with ops count and blocksTouched, and inputs
    And nothing stored is anonymous

  Scenario: Lifecycle states
    Then a version moves draft -> review -> published -> deprecated -> archived
    And review is optional per workspace
    And published versions are immutable and shareable
    And deprecated and archived versions still render from their lockfile, flagged
    And an archived version needs a restore before rendering
    And old drafts are collapsed after 30 days

  Scenario: Visibility defaults private
    When a Kage is published
    Then its visibility starts as private
    And may be widened to workspace, link or public explicitly

  Scenario: Three kinds of principal
    Then user: authenticates via SSO or OAuth
    And agent: authenticates via OAuth client credentials or a signed API key, one identity per agent
    And service: authenticates via workload identity

  Scenario: Permission model
    Then grants are read, write, review, publish and admin, per repository or per Kage
    And an agent acting onBehalfOf a user gets the intersection of its grants and the user's
    And every write lands in an append-only audit log

  Scenario: Search before making
    When an agent calls search_kages with query, system, author, tag or state filters
    Then it gets full-text matches over titles, block text and meta
    And search_templates({intent}) returns ranked templates to fork
    And every Kage exposes a card: title, system, summary, block count, last author, thumbnail

  Scenario: Events are emitted
    Then the store emits CloudEvents kage.version.created, kage.published,
      kage.state.changed, kage.action.emitted, kage.comment.created and system.published
    And agents subscribe per workspace stream or webhook

  Scenario: Quotas protect the workspace
    Given per-workspace and per-agent quotas on versions per hour, storage and ask spend
    When an agent exceeds a quota
    Then it receives a rate-limit error, not an unbounded bill

  Scenario: Export and import
    Then a Kage exports as JSON with lockfile, static read-only HTML, Markdown from describe, and PNG
    And import accepts the JSON form and re-validates it
