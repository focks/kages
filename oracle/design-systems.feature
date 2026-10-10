Feature: Design systems, resolution and lockfiles
  A design system is a token set plus a role map. It may extend another
  system. Resolution answers: which implementation runs for a block's type.

  Background:
    Given systems core@1.4.0, ledger@2.1.0 extending core@1, and atelier@1.0.0 extending core@1

  Scenario: A system manifest lists only what it owns
    Given ledger's manifest components map
    Then it lists sidebar, dropdown, tabs, button, card and stat only

  Scenario: Inherited roles fall through to the parent
    When role "table" is resolved in a ledger Kage
    Then it resolves to core/table@1.0.0 restyled by ledger's token scope

  Scenario: Bare role name resolves through the Kage's system
    Given a Kage with system "ledger@2"
    When a block's type is "dropdown"
    Then it resolves to ledger/dropdown@2.0.0

  Scenario: Major-pinned role must match
    When a block's type is "dropdown@2" in a ledger Kage
    Then it resolves to ledger/dropdown@2.0.0
    And resolution fails if the system's dropdown is not major 2

  Scenario: Cross-system pin overrides the Kage's system
    Given a Kage with system "ledger@2"
    When a block's type is "core/dropdown@1"
    Then it resolves to core/dropdown@1.3.0 even inside ledger

  Scenario: Fully qualified versions are for lockfiles only
    When a block's type is "core/dropdown@1.3.0"
    Then it resolves to exactly that version

  Scenario: Resolution errors are specific
    When a type cannot be resolved
    Then the error names what was asked and what exists

  Scenario: The lockfile is written on save
    When a Kage is saved
    Then the version records resolved.system and resolved.blocks with exact versions
    And the viewer runtime loads exactly those bundles

  Scenario: Upgrading is explicit
    Given a published Kage locked to ledger@2.1.0
    When ledger@2.2.0 is published
    Then the Kage keeps rendering from its lockfile unchanged
    And an upgrade re-resolves, re-validates and saves a new version

  Scenario: The same Kage renders in all three systems
    Given the portable ops-console Kage
    When its system field is switched between core@1, ledger@2 and atelier@1
    Then it renders in each without modification

  Scenario: Extension props apply per system
    Given a card with props.x.ledger.code "ORD-01" and props.x.atelier.eyebrow "This week"
    When the Kage renders under ledger
    Then only the ledger extension props apply
    And each x group is validated against that system's contract

  Scenario: Components read only --kg-* variables
    Then every component implementation reads tokens only through --kg-* custom properties
    And bundle.css maps each system's tokens onto them under .kg-sys-core, .kg-sys-ledger and .kg-sys-atelier

  Scenario: Every system defines the 16 colour roles
    Then each system defines paper, surface, sunken, ink, ink-muted, line, line-control,
      accent, accent-ink, accent-soft, wire, focus, success, danger, danger-soft and the documented remainder
    And text contrast is at least 4.5:1 and line-control at least 3:1 in light and dark

  Scenario: Contract versioning rules
    Then adding an optional prop, output, event, command or slot is a minor bump
    And a visual-only change is a patch bump
    And removing or renaming anything, requiring a prop, narrowing an enum,
      changing a payload or changing implements is a major bump

  Scenario: Bundles are immutable
    Given a published system bundle
    Then it is never modified; a fix is a new patch version
    And bundles are SRI-pinned via the manifest integrity hash

  Scenario: A new root system implements all 12 interfaces
    When a system without extends is published
    Then it must map every one of the 12 roles

  Scenario: New-system conformance suite
    When a system is submitted for publishing
    Then every interface event fires with the declared payload
    And every command works and outputs match
    And the ops-console Kage renders with zero runtime errors in light and dark
