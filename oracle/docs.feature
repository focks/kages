Feature: Documentation as Kages
  Kages documents itself the way it asks agents to author.

  Scenario: Every page is a valid, clean Kage
    Then each docs page and the index validate with no errors and no lint findings in Core, Ledger and Atelier
    And each declares the read mode

  Scenario: Links cannot rot
    Then a link to a missing page or heading is a build error, and a command named in a page must exist

  Scenario: References are generated
    Then the CLI and operation pages are produced from the CLI help and the operation table, and fail the build when stale

  Scenario: The site is public and static
    Then /docs and /docs/<page> render without signing in, and an unknown page is a 404

  Scenario: The pages read as one set
    Given the published docs pages
    Then every page has an introduction under its title and belongs to a group
    And no generator marker is visible to a reader
    And the interactive lesson uses the same frame and heading style as the other pages
