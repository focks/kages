Feature: Critique
  Kages gives an agent the evidence and a rubric for a design review, stores the result
  and shows the trend. It never scores anything itself and never calls a model.

  Scenario: The packet is evidence, not opinion
    When critique_kage is called for a Kage
    Then it returns validation counts, findings by severity, structural stats, a fenced described view, the briefs and the render evidence if supplied
    And it carries the ten-heuristic rubric with 0 to 4 anchors, the personas, the severity scale and the protocol
    And it is read-only, deterministic and permission-checked

  Scenario: Isolated assessments, honestly labelled
    Given an agent runs the protocol
    Then the design reviewer has no tool that returns lint or validation output
    And a single-context run must say DEGRADED and why, and the saved critique records the method

  Scenario: Results are saved against the version they judged
    When save_critique is called
    Then scores must be integers 0 to 4 or null with a reason, at least three must be scored, and totals are computed by the store
    And the critique records the head digest, so it is reported stale once the Kage changes
    And only writers may save, readers may read, and strangers see nothing

  Scenario: The backlog is worked and closed
    Then each priority can be marked fixed or won't fix, and close_critique closes one critique and never a newer one
    And the trend shows the last five scores, with each denominator when the heuristic sets differ

  Scenario: The Library shows it
    Then a card carries the latest score chip, the detail panel has a Critique tab, and a filter finds Kages with open P0 or P1 issues in a current critique
