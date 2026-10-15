Feature: Seeing what you built
  An author, human or agent, can render a Kage and read objective findings about
  it, instead of guessing from the document.

  Scenario: A Kage is rendered at chosen widths
    When kages screenshot runs with one or more widths and optionally dark mode
    Then it writes a PNG per width of the finished page, after the design system, fonts and images settle
    And the MCP render_kage tool returns the same image as an image content block with the findings as text

  Scenario: Findings are objective
    Then a block that failed to render, a page that scrolls sideways, an image that did not load and a console error are reported
    And chart or diagram text rendered under 8px after scaling is reported
    And a page taller than the capture limit is cut and says so
    And a healthy Kage reports no problems, with --strict exiting non-zero otherwise

  Scenario: Wide figures stay legible on a phone
    Given a chart or diagram drawn 480 or more units wide
    Then it keeps a minimum width of 80% of its drawing and scrolls sideways inside its own box
    And the page itself does not scroll sideways

  Scenario: Missing prerequisites are explained
    When Chrome or a running Kages app cannot be found
    Then the command fails at once with how to fix it, and never hangs
    And the render page shows only a document it is handed and exposes no data
