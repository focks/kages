Feature: Doctor
  One report of drift between the files Kages writes and what this version reads.

  Scenario: A healthy workspace is quiet
    Given a project initialised with "kages init"
    Then "kages doctor" prints "No drift found" and exits 0

  Scenario: Each fault is named with its fix
    Given a damaged config, an edited brief.md, a legacy store with orphaned comments, a stale hook, a missing .gitignore block and a tracked screenshot
    Then each appears once with a stable id, a severity (auto, mention or route) and the command that fixes it
    And a credential in a shared file is named but never printed

  Scenario: Reporting is not repairing
    Then doctor writes nothing unless --fix is given
    And --fix applies only safe findings, leaves the rest to a person, and a second --fix does nothing

  Scenario: Network and strictness are opt-in
    Then the database check runs only with --online and never shows the connection string
    And --strict exits 1 when anything needs action
