Feature: Session context
  One call gives an agent the grounding it needs and says what is missing, within a
  fixed size. Everything in it is derived from data that already exists.

  Scenario: A fresh workspace asks for a brief
    When get_context is called on a workspace with no brief
    Then it carries a NO_BRIEF directive with the command that fixes it
    And after set_brief the directive is gone

  Scenario: A Kage adds its own section
    When get_context is called with a Kage name
    Then it reports validation, finding counts, the five most severe findings, open comments and the mode with whether it was declared or inferred
    And it adds directives such as NO_MODE, LINT_P0, LINT_P1, CRITIQUE_OPEN, CRITIQUE_STALE and SYSTEM_MISMATCH when they apply

  Scenario: The result is bounded
    Then the JSON stays within 6000 characters, trimming findings, then comments, then system rules, then the project list in that order
    And full lifts the limit

  Scenario: Untrusted text is fenced and permissions hold
    Then the brief, findings and other authored text are inside untrusted data fences in the text form
    And an anonymous caller sees counts of public Kages only and no brief
