# FAQ

Short answers to the questions people ask first. If yours is not here, the [concepts](concepts.md) page explains the ideas behind them.

## Does Kages call a language model?

No. It gives an agent evidence, a rubric, storage and safe transformations. The judgement stays with the agent.

## Can a Kage run code?

No. A Kage is data: validated, never executed. Expressions come from a closed set and cannot reach the page's globals.

## Why patches instead of regenerating?

A patch is small, reviewable and mergeable, and it keeps history readable. Regenerating a Kage replaces everything and can silently drop work.

## What if the brief is wrong?

Edit it in the Library (the Brief button) or with `kages brief set`. Fields an agent filled in are marked as unconfirmed drafts until you edit them.

## How do I stop a noisy check?

Waive one finding with a written reason in the Kage's `meta.kages.lint.ignore`, or ignore a rule for the whole workspace with `lint.ignoreRules` in `config.json`. The advice log shows which rules get waived most.

## Where do my files go?

Into `./.kages`. `kages gitignore --write` keeps screenshots, caches, logs and your local config out of git while the shared files (`config.json`, `brief.md`, critiques) stay tracked.

## Is it safe to install the hook?

It only reads files in your project, never uses the network, never writes outside `.kages`, and fails silently if anything is wrong. The installer shows its change first and uninstalls cleanly.

## How do I report a bug?

Run `kages report`. It prints a markdown bundle with your versions, which environment variables are set (never their values), where each setting came from, the doctor's findings and, with `--kage <name>`, the validation and lint results for one Kage. Secrets, emails and home-directory names are removed, and document text is left out unless you pass `--include-doc` and confirm.

```sh
kages report --kage snowflake --verify --out report.md
```

Nothing is sent anywhere. Read the file, then paste it into a new issue yourself. `--open` only opens a pre-filled issue page after you say yes.
