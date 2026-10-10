Feature: Component contracts
  A contract is the only thing an agent knows about a component. If the
  contract does not declare it, a block cannot use it.

  Scenario: Contract completeness
    Given any published contract
    Then it carries id, version, ref, system, name, role, implements, summary,
      props, slots, local, outputs, events, commands, defaults, limits, tokens and agent guidance
    And ref "<system>/<name>@<version>" is globally unique and immutable once published

  Scenario: implements is honoured
    Given a contract listing "kages/select@1" in implements
    Then it includes every interface prop, event, output and command with compatible types

  Scenario: Local state is private to writes
    Given dropdown declares local "value"
    Then only the component's own defaults and commands may write it via setLocal
    And other blocks change it only by calling a declared command

  Scenario: Outputs are the only public reads
    Given sidebar declares outputs ["value", "collapsed"]
    Then $block "nav.collapsed" is a valid read
    And any key not listed in outputs is private

  Scenario: Commands are the only cross-block writes
    Given sidebar declares commands toggle, collapse and expand
    When a button runs {"do": "call", "target": "nav", "command": "toggle"}
    Then the sidebar's collapsed local state flips
    And a command body may only use setLocal on its own state, plus emit

  Scenario: Defaults run before block handlers
    Given dropdown defaults.change does setLocal value = $event.value
    And a block's on.change sets app state region
    When the change event fires
    Then the default runs first, then the block's handler
    And an unwired dropdown still remembers its pick

  Scenario: Events carry their declared payload
    Given select declares change with payload {value, label}
    When the component fires change
    Then the payload has exactly those fields with the declared types

  Scenario: The 12 interfaces exist with their declared surface
    Then kages/shell@1, nav@1, select@1, tabs@1, button@1, text-input@1,
      card@1, stack@1, text@1, badge@1, stat@1 and table@1 are defined
    And each declares exactly the props, slots, events, outputs and commands in the interface table

  Scenario: Agents cannot style
    Then no contract exposes colour, pixel or CSS props
    And spacing is only a stack "gap" step on the 4px grid
