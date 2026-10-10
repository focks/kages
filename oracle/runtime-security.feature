Feature: Runtime sandbox and host bridge
  A published Kage renders in a sandboxed iframe on its own origin with a
  strict CSP. The runtime never touches the network; the host bridge does,
  behind explicit capabilities.

  Scenario: Sandboxed origin
    When a published Kage is viewed
    Then it renders on its own origin (<id>.kages-usercontent.app)
    And the CSP sets default-src 'none', connect-src 'self', base-uri 'none' and form-action 'none'
    And scripts load only from self and the registry, styles from self and Google Fonts

  Scenario: Boot order
    Then the iframe loads the host bridge, React, the lockfile's SRI-pinned bundles,
      tokens CSS and the runtime
    And the Kage document arrives over postMessage
    And nothing in the document is evaluated as code

  Scenario: Trust tiers
    Then the Kage document is untrusted data, validated and never executed
    And design-system bundles are reviewed, signed, versioned and immutable
    And the planned core/html@1 escape hatch renders in a nested sandboxed iframe
      without same-origin, talks only through a typed message port,
      is marked in the editor and makes the Kage non-portable

  Scenario: Storage capability
    When a block writes a state key with persist "personal" or "shared"
    Then the bridge stores it in the matching scope
    And keys without persist are never stored
    And shared storage shows a notice before the viewer types into it

  Scenario: Model gateway billing
    Given a workspace configuration of viewer, workspace or owner billing
    When ask runs for the first time for a viewer
    Then the viewer is asked permission first
    And the configured payer is charged

  Scenario: Connector capability
    When a Kage source calls a connector
    Then the viewer approves that connector first
    And tools that need per-action approval are refused

  Scenario: Fetch allowlist
    Then proxy.fetch serves only URLs declared in sources, within a host-side allowlist

  Scenario: Viewer profile is minimal
    Then viewer.profile() exposes name and avatar only, and only if offered

  Scenario: Emit is rate-limited
    Then emit(name, payload) is rate-limited by the host

  Scenario: Accessibility
    Then each contract states its keyboard model and components own their ARIA
    And focus rings use the wire token at 2px with 2px offset in every system
    And text meets 4.5:1 and control edges 3:1 in light and dark across all three systems

  Scenario: Untrusted interpolation
    Given an ask prompt built with $tpl from user-entered state
    Then the gateway marks interpolated values as data, not instructions
