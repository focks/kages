Feature: Security properties

  Scenario: The event stream is as private as the Kages
    Given a private Kage with a comment and a public Kage
    When an anonymous caller subscribes
    Then it sees events only about the public Kage, and never the private Kage's name, ref or comments
    And its cursor still advances over the whole log

  Scenario: Authentication fails closed
    Given neither or only one of the Supabase variables is set
    When local mode was not requested (no KAGES_LOCAL_MODE=1 and not `next dev`)
    Then every caller is anonymous and nothing can be written
    And a notice says what to set

  Scenario: Cross-site pages cannot change state
    When a write arrives from another site, a sibling subdomain or a sandboxed page, with or without cookies
    Then it is refused with 403
    And a write from the app's own page, or carrying a bearer token, or from a non-browser client, is accepted

  Scenario: Limits hold between requests
    Given a persistent deployment restores a fresh store for every request
    Then the hourly version and comment limits still apply, and dry runs are limited per server process

  Scenario: History follows the current sharing decision
    When a Kage's head becomes private or unpublished
    Then no earlier version of it is readable by anyone without a grant, and a private draft is not exposed by a later publication

  Scenario: Redirects stay on the site
    When login is asked to continue to a "next" address
    Then only a local path is followed; "@host", "//host", "/\host", absolute and script addresses go to the home page

  Scenario: Fetch allowlists compare hosts, not text
    Given https://api.example.com is allowed
    Then https://api.example.com.evil.test and https://api.example.com@evil.test are refused, and a path entry matches whole segments only

  Scenario: A private Kage cannot be told from a missing one
    When an anonymous caller runs any operation naming a private Kage
    Then the answer is the same as for a Kage that does not exist, and never names the project
    And a caller who can read the Kage still gets the specific reason they were refused

  Scenario: Responses carry baseline security headers
    Then every page is served with nosniff, a same-origin framing policy, a referrer policy and a restrictive permissions policy

  Scenario: Version history and project lists respect read access
    Given a Kage whose published head is public and whose earlier version is a private draft
    When an anonymous caller lists its versions
    Then only the versions that caller may read appear
    And a project the caller cannot read, with its Kage count, is not listed
