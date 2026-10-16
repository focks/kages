Feature: json-render interop and decision guides

  Scenario: A json-render spec comes in
    When a flat json-render spec on the shadcn catalog is imported
    Then it becomes a valid Kage whose bindings, visibility and setState actions behave the same
    And every component or action that could not be converted is named in the notes

  Scenario: A Kage goes out
    When a Kage is exported as a json-render spec
    Then the spec is structurally valid for the shadcn catalog
    And calculations are frozen at their initial values and reported, never dropped silently

  Scenario: A decision guide is built from an intake
    Given an intake with a reader, questions, assumptions, steps, a checklist and at least one https source
    Then the guide is valid with no lint findings, and the recommendation follows the answers
    And an intake with no source, an uncovered answer combination or an unknown assumption is refused with the reason
    And a guide says it is unverified until the author records who checked it and when

  Scenario: A local Kage is sent to a running app
    When "kages push" runs against a server
    Then the Kage is created there and the link is printed
    And pushing again changes nothing unless --replace is given, and nothing is ever deleted

  Scenario: A requested version is honoured
    When to_json_render is asked for a version
    Then that version is exported, an unknown version is not_found, and a malformed one is invalid_params
    And the head is never returned in place of a version that was asked for
