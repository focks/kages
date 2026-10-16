Feature: Distribution
  Kages installs into the coding harnesses a person uses, safely and reversibly, from a
  package that runs without a build step.

  Scenario: The published CLI is self-contained
    Given the packed tarball is unpacked into an empty directory
    Then "kages" runs on a Node without TypeScript support and does not need the source or node_modules
    And it contains the bundle and the plugin files but no source or oracle

  Scenario: Install shows its work and asks first
    When "kages install" runs in a project that uses a coding harness
    Then it lists the files and hook changes it will make and writes nothing until consent or --yes
    And a second run changes nothing, and --dry-run never writes

  Scenario: Only recorded files are touched afterwards
    Then update, check and uninstall act only on files listed in .kages/install.json
    And a file edited by hand is kept and reported
    And check exits 1 when something is missing or older than the CLI

  Scenario: Plugins cannot drift
    Then every plugin file is generated from the sources, the committed files equal the generated ones, and one version number appears in every manifest
    And a private build changes only the MCP address
