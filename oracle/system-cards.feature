Feature: System cards
  Each design system is described by one generated document, so a person or agent
  choosing or extending a system reads one place instead of tokens, registry and catalog.

  Scenario: The card is generated from the same data the system renders from
    When get_system_card is called for a system
    Then it returns the tokens for light and dark, the type ramp, spacing, shape, components and named rules
    And changing a token changes the card

  Scenario: Contrast is computed, not asserted
    Then every declared text-on-ground pair shows its WCAG ratio in every theme
    And a pair below its minimum is listed under known issues and fails the design-system build unless waived with a reason

  Scenario: The card is public design data
    Then it can be read without signing in, over REST, MCP, the CLI and /packs/<system>/SYSTEM.md
