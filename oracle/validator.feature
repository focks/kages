Feature: Validator
  validate() returns {ok, errors, warnings, portable}. Every finding is
  {at: <JSON pointer>, code, msg}. A document that passes validate() never
  throws in any renderer.

  Scenario: Block id format
    Given a block id not matching ^[a-z][a-zA-Z0-9_-]{0,47}$
    When the document is validated
    Then an error names the offending id

  Scenario: Root must exist
    Given "root" names a block absent from "blocks"
    Then validation fails

  Scenario: Every slot child must exist
    Given a slot listing child id "ghost" with no such block
    Then an error points at that slot entry

  Scenario: A block has at most one parent
    Given two blocks whose slots both list block "kpi"
    Then the validator reports error code "two-parents"

  Scenario: No slot cycles
    Given block "a" whose slot contains "b" and block "b" whose slot contains "a"
    Then validation fails with a cycle error

  Scenario: Orphan blocks are reported
    Given a non-root block that no slot references
    Then the validator reports it as "orphan"

  Scenario: Only declared slots
    Given a card contract declaring slots "children" and "actions"
    When a block uses slot "footer"
    Then validation fails

  Scenario: Slot max and required are enforced
    Given shell declares sidebar with max 1 and main as required
    Then two sidebar children is an error
    And an empty main slot is an error

  Scenario: Required props present in props or bind
    Given the select interface requires "options"
    When a dropdown block has neither props.options nor bind.options
    Then validation fails at /blocks/<id>/props/options

  Scenario: Literal prop types and enums match the contract
    Given button declares variant as an enum
    When a block sets variant to a value outside the enum
    Then validation fails

  Scenario: Array items carry their requiredKeys
    Given dropdown options items require keys "value" and "label"
    When an option object lacks "label"
    Then validation fails

  Scenario: Unknown props warn
    When a block sets a prop the contract does not declare
    Then the validator emits a warning, not an error

  Scenario: Only declared events
    When a block handles event "hover" that its contract does not declare
    Then validation fails

  Scenario: Only known action verbs
    When an action uses a "do" verb outside the specification
    Then validation fails

  Scenario: call targets must exist and have the command
    When an action calls target "nav" command "fly"
    And "nav" exists but has no command "fly"
    Then validation fails

  Scenario: setLocal aimed at another block is rejected
    When a block's "on" handler uses setLocal
    Then the validator reports error code "foreign-local"
    Because setLocal is allowed only inside contract defaults and commands

  Scenario: $block references must target declared outputs
    When a binding reads {"$block": "kpi.internal"} and "internal" is not an output
    Then the validator reports error code "private-output"

  Scenario: $data and $state references must be declared
    Then a $data key absent from data and sources is an error
    And a $state key absent from the declared state is an error

  Scenario: No reference cycles
    Given block "a" binds to "b.value" and block "b" binds to "a.value"
    Then validation fails with a reference-cycle error

  Scenario: Limits produce warnings, not errors
    Given ledger/dropdown declares limits.maxOptions = 6
    When a block gives it 9 options
    Then the validator warns and suggests pinning core/dropdown@1

  Scenario: Portability is reported
    Given a Kage using only interface props and bare role types
    Then validate() reports portable: true
    And a Kage using a cross-system pin or x-props reports portable: false

  Scenario: Error shape
    When any rule fails
    Then the finding is {at: "/blocks/kpi/props/value", code: "<rule-code>", msg: "<human message>"}

  Scenario: The reference broken document is the fixture
    Given the Validator card's deliberately broken Kage
    When it is validated
    Then exactly 6 errors and 1 warning are returned, matching the card

  Scenario: The reference valid document passes everywhere
    Given fixtures/ops-console.kage.json
    When it is validated against core, ledger and atelier
    Then each run returns 0 errors, 0 warnings and portable: true
