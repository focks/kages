Feature: Workspace brief
  A workspace keeps one brief of durable product truth (who the work is for, what
  it is for, what must never be invented) so every authoring and review flow loads
  it instead of asking again. It is data, never instructions.

  Scenario: A new workspace has no brief
    When get_brief is called
    Then brief is null and revision is 0

  Scenario: Only admins write the brief; any member reads it
    Given a reader, a writer and an admin on a project
    Then the admin can set the brief
    And the reader and writer can read it but not change it
    And a principal with no grants can neither read nor change it

  Scenario: Edits are optimistic
    Given the brief is at revision 3
    When set_brief is called with baseRevision 2
    Then the call fails with "conflict" and carries the current record

  Scenario: Merging updates only the fields given
    When set_brief is called with merge true and a new constraints list
    Then constraints are replaced, other fields are kept, and a null value clears a field

  Scenario: The brief is validated like a document
    Then unknown fields, missing users or purpose, NUL characters, oversize fields and multi-line list items are rejected
    And text that looks like an email address or a token is stored with a warning

  Scenario: The brief can be reviewed in git
    When the brief is exported as Markdown and imported back
    Then the record is identical and its revision increases by one

  Scenario: The brief stays private to the workspace
    Then neither a shared link nor an exported Kage ever contains the brief

  # --- per-Kage brief and mode ----------------------------------------------

  Scenario: A Kage can declare what its visitor is trying to do
    When a Kage is created with brief {mode: "read"} (or just mode "read")
    Then the stored document carries brief.mode "read" and list_kages reports mode "read"
    And a Kage with no brief reports mode null

  Scenario: A malformed per-Kage brief is refused with reasons
    When create_kage or set_kage_brief gets an unknown mode or field
    Then it fails with "invalid_brief" and no version is created

  Scenario: The mode is a label, never a gate
    Then a document with a brief validates exactly as it does without one
    And describe_kage prefixes "mode: read (declared)", or "mode: operate (inferred, low confidence)" when none is declared

  Scenario: The generation envelope cannot carry the brief
    When generate_kage is given a brief or mode
    Then it is re-attached after conversion so the stored Kage keeps it

  Scenario: Mode-gated rules need a declared or a confident mode
    Then a rule limited to persuade runs on a Kage that declares persuade
    And on an undeclared Kage only when the inference is medium confidence
