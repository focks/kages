Feature: Tune (bolder and quieter)
  A controlled step in a page's intensity, made only by moving declared semantic props
  along their ladders. It is a reviewable patch, never a rewrite.

  Scenario: Dry run first
    When tune_kage is called without apply
    Then it returns the patch, the knobs changed with their before and after values, what it skipped and why, and the validation
    And nothing is written

  Scenario: Only knobs move
    Then a tune writes only section tone, inset, gap, page width, grid minimum size and text or button variants
    And never copy, data, state, wiring, heading levels, alert or badge tones, danger buttons or any bound prop

  Scenario: The direction holds and the ladders clamp
    Then quieter never raises the page's loudness and bolder never lowers it
    And repeating a step converges, then reports "already at the floor" or "already at the ceiling" with an empty patch

  Scenario: Mode decides what may get louder
    Then persuade and experience pages may gain a louder hero, a wider canvas and a display line
    And read and operate pages only gain hierarchy (a display title, a promoted primary action)
    And a page keeps at most one accent section, and exactly one primary action per container after quieter

  Scenario: Applying is one version
    When apply is true
    Then one version is created with change.kind "tune" and the summary "tune quieter ×1 (scope: doc)"

  Scenario: Planning is a read
    When tune_kage or migrate_kage runs without apply
    Then it is treated as a read: allowed over GET and for anonymous readers of a public Kage, and it commits nothing
    And with apply:true it is a write: refused over GET and for anonymous callers when sign-in is required
