Feature: Workspace init
  The first five minutes with Kages produce a grounded brief, a config and a clean
  .gitignore without a questionnaire.

  Scenario: Explore before asking
    When "kages init" runs in a project with a package.json description and a README
    Then those are shown as drafts and treated as a hypothesis, not approval
    And fields filled from them are listed as inferred until confirmed

  Scenario: At most three questions a round
    Then the first round asks who uses it, what it is for and what must never be invented
    And a second round (voice, constraints) happens only when both are still missing
    And no question is ever about visual style

  Scenario: Non-interactive runs never block
    When there is no terminal and no --answers file
    Then the workspace, config and .gitignore block are set up, no brief is written, and the exit code is 0
    And --answers supplies the answers, with anything not provided left unset

  Scenario: Re-running is safe
    Then a second run reports "nothing to change" and creates no new revision
    And an edited brief.md is never overwritten; the current export goes to brief.md.new

  Scenario: Only intended files appear in git
    Then after init the working tree shows .gitignore, .kages/config.json and .kages/brief.md, never screenshots, caches, logs or the local config

  Scenario: Agents get the same protocol
    Then the MCP prompt "kages-init" tells an agent to explore first, ask at most three questions, avoid visual questions, confirm inferences and then call set_brief
