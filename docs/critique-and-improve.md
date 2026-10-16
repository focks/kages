# Critique and improve

Kages does not call a model. It gives an agent the evidence and a rubric, stores the result, and offers controlled steps for the changes that follow.

## Critique

```sh
kages critique snowflake --screens 390,1200
```

The packet holds validation counts, findings by severity, structure, a text view of the page, the briefs and any render findings, plus a ten-heuristic rubric scored 0 to 4 and a protocol. The agent writes the review, ideally as two isolated assessments, and saves it:

```sh
kages critique save snowflake --file review.json
kages critiques snowflake
```

A saved critique is tied to the exact version it judged; once the Kage changes it is marked as older, and the Library shows its score, trend and open issues.

## Improve moves

Nine named moves give people and agents a shared vocabulary: critique, polish, distill, harden, clarify, onboard, adapt, quieter and bolder.

```sh
kages improve                    # the list
kages improve polish snowflake   # the playbook plus its context
```

Nothing runs by itself: the command assembles the playbook with the context the agent needs.

## Tune

`quieter` and `bolder` have a deterministic form that moves declared props along fixed ladders, such as section tone and spacing:

```sh
kages tune snowflake --quieter          # dry run
kages tune snowflake --quieter --apply  # one new version
```

## Deprecations

When a prop or role is retired, new work is warned off it and `kages migrate` moves existing Kages to the replacement; stored versions keep working.
