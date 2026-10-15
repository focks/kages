Feature: Rich visual and disclosure blocks
  Agents compose dashboards, guided flows and layered pages from the catalog
  alone. Blocks accept data, never markup, and every chart is also readable
  without sight.

  Scenario: Charts turn data into token-coloured geometry
    Given an area, donut, gauge, sparkline or heatmap block receives data
    Then non-finite, negative-where-invalid or hostile values never reach SVG attributes
    And geometry is finite for extreme magnitudes and single-point series
    And area, donut and heatmap expose their values as text or a data table
    And an empty series shows its empty message instead of a blank chart

  Scenario: Disclosure blocks keep native semantics
    Given accordion, stepper, timeline, alert or modal blocks are rendered
    Then accordion triggers report aria-expanded and control a labelled region
    And the current step is marked aria-current and interactive steps are buttons
    And danger and warning alerts announce immediately
    And a modal is a labelled aria-modal dialog that closes on Escape, backdrop or its button
    And all text from the document renders literally

  Scenario: Interactive blocks expose public state
    Given a stepper, accordion or modal has an unwired local default
    When the user changes it
    Then value or open updates without author wiring
    And the document can read it through outputs or bind it to declared state
    And a button opens or closes a modal through its declared commands
