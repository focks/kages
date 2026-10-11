Feature: Free-flowing artifact composition
  An agent chooses the shape that fits the artifact. Navigation is optional.
  New shared contracts extend the reference oracle without changing published refs.

  Scenario: Root is any catalog block
    Given a reading page, a landing page or a split interactive tool
    Then no shell or sidebar is required
    And each document validates with zero errors and warnings in all three systems
    And the generation envelope preserves its props, slots and bindings

  Scenario: Container-responsive layouts
    Given a wide browser with a narrow artifact preview
    Then grids reduce their column count to fit the preview
    And split panes stack in source order
    And content does not overflow horizontally

  Scenario: Unwired native inputs
    When a textarea, slider or checkbox emits change
    Then its declared local output updates without an agent-authored handler
    And an explicit binding and handler can connect it to declared app state

  Scenario: Literal content and passive images
    Then code and list text are never interpreted as markup or scripts
    And image sources accept HTTPS, local paths or raster data URLs
    And executable schemes and SVG data URLs are refused

  Scenario: Existing sidebar-free shells
    Given a shell containing only main content
    Then its body fills the available width
    And the original ops-console and broken-fixture acceptance results remain unchanged
