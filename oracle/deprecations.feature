Feature: Deprecations
  A retired prop, role, value or field stops steering new work without breaking the past.

  Scenario: Nothing is deprecated until a decision says so
    Given the shipped registry is empty
    Then no finding, pack section or directive mentions deprecation

  Scenario: Use is flagged with its replacement
    Given a registry entry for a prop
    When a Kage sets or binds that prop
    Then "deprecated-usage" (P2) names it, the version it was deprecated in, why, and what to use

  Scenario: Migration is mechanical where it can be
    When migrate_kage runs on a Kage that uses automatic entries
    Then it plans JSON Patch operations and, with apply, creates one version marked as a migration
    And entries that need a decision are listed as manual steps and never guessed
    And running it again plans nothing

  Scenario: History is untouched
    Then a stored version that uses a deprecated feature still validates and renders after the entry is added

  Scenario: A workspace can stop the problem growing
    Given lint.deprecations is "block-new"
    Then a write that adds deprecated usage is refused with the usages, while untouched legacy usage is allowed
