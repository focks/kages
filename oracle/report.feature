Feature: Diagnostic report
  A person can produce a bundle that helps a maintainer without leaking anything private.

  Scenario: Nothing is sent
    When "kages report" runs with the network unavailable
    Then it succeeds and prints markdown to stdout, and nothing is uploaded

  Scenario: Secrets and content stay out
    Given the environment, user config, workspace config, a document, a comment and the brief each hold a unique secret
    Then none of them appears in the report
    And environment variables show only whether they are set
    And config shows keys and layers, never values unless asked, and never a secret's value

  Scenario: The document is opt-in
    When "--include-doc" is given with a Kage
    Then the size and a warning are shown and a confirmation is required
    And only the document's text is added, truncated to 50 KB

  Scenario: Files and the browser
    Then "--out" writes a private file and refuses to overwrite without --force
    And "--open" refuses without a terminal, asks first, and pre-fills only a title and environment line
