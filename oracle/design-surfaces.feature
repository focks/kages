Feature: Browser surfaces and motion
  The parts of a page nobody draws still carry the design, and motion is a considered
  response to a state change that stops when the reader asks it to.

  Scenario: Surfaces come from the palette
    Then text selection, the caret, form accents, placeholders, list markers and link underlines inside a Kage use the active system's tokens
    And a dark Kage declares color-scheme dark so native controls follow it
    And none of this reaches the host page, which keeps its own color-scheme and selection

  Scenario: Selected text stays readable
    Then in every system, theme and ground the selected text keeps at least 4.5:1 (ink) and 3:1 (muted ink) against the selection

  Scenario: Tab strips can be seen to scroll
    Then their scrollbars are thin and themed, not hidden

  Scenario: Reduced motion is honoured everywhere in a Kage
    When the reader asks for reduced motion
    Then every transition and animation inside a Kage lasts effectively zero, including those in the frozen reference stylesheet

  Scenario: Our own motion follows the policy
    Then it uses the motion duration and easing tokens, never overshoots, never loops, and never hides content at rest
