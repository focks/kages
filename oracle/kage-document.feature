Feature: Kage document
  One Kage is one flat JSON document: every block lives in one blocks map
  keyed by id, and the tree exists only through slots.

  Scenario: Required top-level keys
    Given a document missing any of "kages", "id", "title", "system", "root" or "blocks"
    When it is validated
    Then validation fails naming the missing key

  Scenario: Document format version
    Given a valid Kage
    Then its "kages" key is "1.0"

  Scenario: Optional top-level keys
    Given a valid Kage
    Then "state", "persist", "data", "sources" and "meta" may be absent
    And an absent state key means no app state is declared

  Scenario: persist maps state keys to storage scopes
    Given persist {"region": "personal", "approvals": "shared"}
    Then "region" is stored per viewer and "approvals" is shared by all viewers
    And a state key absent from persist resets on reload

  Scenario: resolved is written by the API only
    When an agent submits a document containing "resolved"
    Then the server ignores or rejects the agent-written lockfile
    And on save the server writes "resolved" itself

  Scenario: Block shape
    Given a block
    Then it may carry "type", "props", "bind", "slots", "on", "visible" and "meta"
    And "meta" is ignored by the runtime

  Scenario: bind wins over props and local state
    Given a dropdown block with props.value "a", local value "b" and bind.value evaluating to "c"
    When its output "value" is read
    Then it returns "c"

  Scenario: Output precedence without bind
    Given a block with no binding for a key
    Then its output is: contract prop default, overridden by local state, overridden by literal props

  Scenario: A literal prop seeds local state
    Given a sidebar contract declaring local "collapsed" with default false
    And a block with props {"collapsed": true}
    When the Kage first renders
    Then the block's local "collapsed" starts as true

  Scenario: Editing is JSON Patch
    When an agent edits a Kage
    Then the change is a list of RFC 6902 operations on block ids
    And the API validates the patched result before committing
    And an invalid patch is rejected atomically with no partial write

  Scenario: Streaming creation renders placeholders
    Given a skeleton whose slot lists name block ids not yet added
    When the runtime renders
    Then unresolved slot children render as quiet placeholders until they arrive

  Scenario: Ids are stable across edits
    When a block must be renamed
    Then the edit is a remove plus an add, never an in-place rename
