Feature: Improve commands
  Nine named moves give people and agents a shared vocabulary for refining a Kage.

  Scenario: The moves are listed
    When "kages improve" runs without arguments
    Then it lists critique, polish, distill, harden, clarify, onboard, adapt, quieter and bolder by category

  Scenario: A move assembles its playbook with context
    When "kages improve polish <kage>" or get_improve_packet runs
    Then the result holds the playbook, the session context, the open critique backlog, the top findings and a trimmed described view
    And it stays within 10 KB, with anything authored inside an untrusted data fence
    And nothing is executed by it

  Scenario: Playbooks cannot point nowhere
    Then every operation and CLI command a playbook names exists, every hand-off names a real move, and each playbook has the same seven sections and states the bounded-verification rule

  Scenario: The moves are available everywhere an agent works
    Then each is an MCP prompt "kages-improve-<command>" taking a target, a plugin slash command and a plugin reference file, all generated from one source
