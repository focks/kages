Feature: Numeric, text and handler expressions
  Common formulas and reactions must behave the same on the server and in the browser, deterministically,
  without running author code.

  Scenario: Whole-number and text operators
    Given $floor, $ceil and $abs take [value], $join takes {list, separator?} and $truncate takes {value, length?, suffix?}
    Then the pure engine and the oracle return the same result for each
    And a malformed argument is refused by validation and evaluates to null

  Scenario: Compact numbers and relative dates
    Given $format with notation "compact" or style "relative" with an explicit relativeTo instant
    Then the result is en-US and does not depend on the clock
    And a relative date without relativeTo is null

  Scenario: A repeated row writes to itself
    Given a handler inside a repeat whose set path is an expression yielding "list.<index>.field"
    When the row's control changes
    Then only that row's field changes
    And a path that is not a plain dot path, or names a prototype key, writes nothing and is logged

  Scenario: Watching a path
    Given a block with watch {"cart": [actions]}
    When a transaction changes state.cart
    Then the actions run once on the same transaction
    And writing an equal value does not run them
    And handlers that keep changing what they watch stop after four passes and are reported
