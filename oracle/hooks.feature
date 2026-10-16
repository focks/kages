Feature: Edit hooks
  A coding harness tells Kages when it edits a Kage file, and Kages answers only when there
  is something worth saying.

  Scenario: A finding comes back in the harness's own shape
    Given a harness reports that it edited a *.kage.json file
    When the file has a lint finding
    Then the answer is the harness's documented context shape, with at most 8 lines and 2 KB
    And the same finding is not repeated on later edits, but a fixed finding that returns is reported again

  Scenario: It never gets in the way
    Then an empty, malformed, oversize or unrecognised payload, a missing file, a symlink out of the project and a dependency folder all produce no output and exit 0
    And nothing is ever written to stderr

  Scenario: Only impossible Kages are refused
    When a harness proposes to write full content that is not valid JSON or fails validation
    Then a pre-write hook that can deny does so with the reason, while lint findings never block

  Scenario: The end of the turn adds the deeper pass once
    Then the deep rules run over the Kage files edited this session, without repeating what was already said, and the pending list is cleared

  Scenario: Installing is reversible and consented
    Then "kages setup hooks" shows the exact change, asks before writing, keeps unrelated settings, is idempotent, and uninstall restores the file byte for byte
    And a malformed existing file is never overwritten without --force, and then only after a backup
