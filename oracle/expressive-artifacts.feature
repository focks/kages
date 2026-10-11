Feature: Expressive declarative artifacts
  Agents build data-driven tools, reusable compositions and visual explanations
  without executing strings or writing HTML.

  Scenario: A collection expands into stable control instances
    Given a block repeats an array with a string or numeric item key
    When items are filtered, reordered or nested
    Then each instance reads its item, index and named outer scopes
    And local state follows the item key, not its position
    And event handlers and sibling references use the same instance
    And duplicate keys, missing keys and recursion are rejected

  Scenario: Arithmetic remains safe and deterministic
    Given formulas use arithmetic, comparisons, rounding, sorting or formatting
    Then inputs and datasets are never mutated or coerced into code
    And invalid numeric domains, overflow and division by zero yield null
    And number formatting uses en-US and date formatting uses UTC

  Scenario: An agent defines a reusable composition
    Given a document defines typed inputs, a root and installed blocks
    When a composition is instantiated with inputs
    Then each instance has independent locals and a public value output
    And missing inputs, wrong types and recursive definitions are rejected
    And expressions remain intact through strict generation round trips

  Scenario: Visual and content blocks are passive data
    Then scene shapes use a closed SVG geometry vocabulary and token colors
    And diagrams and numeric charts fit the artifact container
    And chart data is accessible as a table
    And interactive shapes support pointer, Enter and Space selection
    And rich text and links never execute markup or executable URL schemes

  Scenario: Named forms validate before submitting
    Then native required, type and range checks prevent invalid submission
    And valid submission emits named values as strings or arrays of strings

  Scenario: Studio offers a choice of starting shape
    Then an author can start a blank canvas or select a complete example
    And preview at phone, tablet or available width
    And save a new draft through the create_kage operation
