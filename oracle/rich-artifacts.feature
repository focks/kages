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

  Scenario: Work-app blocks keep interaction state public and transient state private
    Given a combobox, tree, data-grid, kanban, calendar, carousel or switch
    When the user selects, moves or toggles without author wiring
    Then the declared output (value, selected, board, index, checked) updates
    And sort order, filters, paging, expansion and the search query stay private
    And keyboard use works: arrows, Enter and Escape for the combobox, arrows for the tree
    And cells, card titles and labels render as literal text

  Scenario: Markdown and math render as elements, never HTML
    Given markdown text or TeX contains raw tags, script text or unsafe link schemes
    Then no raw HTML, script or executable URL reaches the page
    And only http(s), local, anchor and mailto links are active
    And unknown TeX commands render as text and nesting depth and length are bounded

  Scenario: A chart selection drives other blocks
    Given an interactive donut or heatmap
    When a slice or cell is clicked, or focused and activated with Enter or Space
    Then it emits select with its label/value or row/column/value
    And its public selected output updates without author wiring
    And selecting the same slice again clears it
    And other blocks may filter on that output with $filter equals and skipIf

  Scenario: Live data loads only through the host bridge
    Given a document declares a source and a fetch action names it
    Then the request is made only if the host allowlist permits the url
    And only https GET requests without credentials, redirects or private hosts are made
    And the response must be JSON within the size and time limits
    And prototype-polluting keys are dropped and arrays are bounded by maxItems
    And a denied or failed load leaves the action's mock (or null) in state

  Scenario: Conditional behaviour uses ordinary expressions
    Given visible, a bound disabled prop and an action when reference state
    Then each updates as the state changes
    And a guarded action does nothing if its condition fails, even when the event still arrives
