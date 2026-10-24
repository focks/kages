Feature: Explicit public gallery publication and upvotes
  Scenario: Publish a private Kage to the gallery
    Given a valid Kage and a user with publish permission
    When the user chooses Publish to gallery
    Then the current Kage is published with public visibility
    And it is discoverable at /gallery without signing in
    And ordinary public Kages are not automatically listed

  Scenario: One removable upvote per authenticated account
    Given a Kage listed in the gallery
    When an authenticated account upvotes it repeatedly
    Then only one vote is counted for that account
    And concurrent votes from other accounts are retained
    When the account removes its vote
    Then its vote is removed without affecting other votes
    And anonymous callers cannot vote
    And discovery exposes counts but never voter identities

  Scenario: Withdraw discovery without exposing private content
    Given a Kage listed in the gallery
    When its owner removes the listing
    Then the public share link remains available
    And its votes are retained for an explicit later listing
    When its owner saves a new draft or revokes public access
    Then the listing is withdrawn in the same persisted transaction
    And reads and votes recheck eligibility after workspace lookup
    And previous private versions are never served through gallery operations
