Feature: Actions and the runtime event pipeline
  Actions are declarative effects run on events. Handler lists run as a
  transaction. Rendering is a pure function of (document, state, locals,
  data, lockfile).

  Scenario: set writes app state at a dot path
    When {"do": "set", "path": "filters.region", "value": "west"} runs
    Then state.filters.region becomes "west"

  Scenario: toggle flips a boolean
    Given state.dark is false
    When {"do": "toggle", "path": "dark"} runs
    Then state.dark is true

  Scenario: call runs another block's command
    When {"do": "call", "target": "search", "command": "clear"} runs
    Then the text-input's local value is cleared
    And target "$self" addresses the block's own commands

  Scenario: Handler lists are transactional
    Given a click handler with three actions
    When the second action's expressions are evaluated
    Then they see the first action's writes
    And the draft commits once after the whole list
    And only blocks whose evaluated outputs changed re-render

  Scenario: when guards skip actions
    Given an action with "when" evaluating to falsy
    When its handler list runs
    Then that action is skipped

  Scenario: Call depth is bounded
    Given commands that call each other
    When the nesting exceeds 8
    Then the runtime stops the chain

  Scenario: visible controls rendering, not state
    Given a block whose visible expression is falsy
    Then the block and its subtree do not render
    And their local state is kept for when they return

  Scenario: ask goes through the model gateway
    When {"do": "ask", "prompt": <expr>, "into": "summary", "pendingInto": "busy"} runs
    Then the host sends the evaluated prompt through the workspace model gateway
    And state.busy is true while pending
    And the answer lands in state.summary, as text or as JSON matching "schema"
    And "model" is a capability hint (fast, smart, vision) or an allowed provider/model id

  Scenario: agent delegates to a registered agent
    When {"do": "agent", "agent": "acme/fulfilment", "input": <expr>, "into": "result"} runs
    Then the host invokes that registered agent over A2A
    And the task result lands in state.result

  Scenario: fetch refreshes a declared source
    When {"do": "fetch", "source": "orders"} runs
    Then the host refreshes sources.orders through its connector or proxy
    And a key not declared in sources is refused

  Scenario: emit raises a host-level event
    When {"do": "emit", "name": "approve-order", "payload": <expr>} runs
    Then the host emits kage.action.emitted with that name and payload
    And subscribed agents receive it

  Scenario: Host action failure is contained
    Given an ask action with onError actions
    When the gateway call fails
    Then null is written into "into", pendingInto becomes false, and onError runs

  Scenario: Event pipeline order
    When a component fires an event
    Then the runtime builds a draft of state and locals
    And contract defaults run, then the block's own handlers
    And the draft commits and dependent blocks re-render
    And host actions start asynchronously after the commit

  Scenario: Per-block failure isolation
    Given a block with an unresolved type, missing reference target or thrown component error
    When the Kage renders
    Then only that block shows an inline error box
    And sibling blocks keep working

  Scenario: Unknown system version
    Given a lockfile entry naming a bundle the host cannot load
    Then the Kage shows a full-frame notice naming the failed lockfile entry

  Scenario: Runtime cycle guard
    Given a reference cycle that slipped past the validator
    When outputs are evaluated
    Then the runtime throws "Reference cycle through block 'x'" caught by the error boundary

  Scenario: Performance budget
    Given a 60-block Kage with bundles loaded
    Then first render completes under 50ms
    And each system bundle is under 120KB gzipped

  Scenario: Reference renderer flow (the oracle test)
    Given the ops-console Kage rendered by KageRenderer
    When the viewer picks region "West" and types "ti" into search
    Then the table shows exactly 1 row and the revenue stat shows $2,275
    When the viewer presses Reset
    Then the region returns to "all" and the search clears
    When the viewer presses the sidebar toggle button
    Then the nav collapses and the heading text changes
    And the same flow passes under core, ledger and atelier
