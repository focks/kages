Feature: Multi-agent collaboration
  Several agents and the people they work for edit, review and act on the
  same Kage. The unit of ownership is a block.

  Scenario: Optimistic concurrency with block-level merge
    Given agents A and B both patch from baseVersion v11
    When their ops touch disjoint blocks
    Then both patches apply cleanly as v12 and v13

  Scenario: Same-block conflict
    Given agents A and B both patch block "kpis" from v11
    When B saves second
    Then B receives {conflict: {blockId: "kpis", theirs, yours}} and nothing is written for B

  Scenario: Claims lease block subtrees
    When agent A calls claim_blocks({kage, blocks: ["kpis", "kpi*"], ttl: 300})
    Then other agents' patches to claimed blocks are refused naming A as claimant
    And the claim expires after its ttl, so a crashed agent cannot hold a Kage hostage

  Scenario: Structural ops need root claim and workspace write
    When a patch touches /root, /state or /system
    Then it requires a workspace-level write grant and a claim on root

  Scenario: Roles map to grants physically
    Given a workspace mapping reviewer agents to comment-only grants
    Then a reviewer agent cannot patch, by permission, not convention
    And a data agent may refresh sources but never touch blocks

  Scenario: Comments anchor to blocks
    When an agent comments {block: "kpiRevenue", text, suggestedPatch?}
    Then the comment attaches to that block
    And a suggestedPatch is valid JSON Patch the block's owner accepts or rejects

  Scenario: Handoffs pass references, not copies
    When agent A hands work to agent B over A2A
    Then the task artifact is a kages:// reference
    And B reads it with describe_kage

  Scenario: Attribution is visible
    Then every block shows its last author, human or agent
    And hovering shows the provenance record

  Scenario: Deletion guardrail
    Then an agent never deletes blocks it did not create unless it holds admin

  Scenario: Publishing guardrail
    Then an agent may publish only with a publish grant and a validation-clean version
    And a workspace can require human review for versions written only by agents

  Scenario: In-Kage actions never use the author's credentials
    When ask, agent or emit runs inside a viewed Kage
    Then it runs with the viewer's or the workspace's budget and permissions, as configured

  Scenario: A proposed patch can be checked without being applied
    When validate_patch is called with the ops of a patch
    Then it returns the verdict patch_kage would give, the validation, the advice and a block diff
    And no version, quota, audit entry or event is created
    And an invalid op is reported with its position (opIndex) and a message naming it
    And findings the patch would introduce are listed as regressions, existing ones are not
