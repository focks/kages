# Decision guides

A decision guide turns a technical answer into something a customer can explore: an explanation with sources, a question that leads to a recommendation, a calculator with numbers they can change, setup steps, and a checklist. You write an **intake**; Kages builds the page, so the same process works for any subject. To see one before writing any intake, [build your first guide](/docs/build-a-guide) in the browser from an example.

## Build one

```sh
kages decision-guide --list
kages decision-guide --example queue-choice -o intake.json
kages decision-guide intake.json --create
```

Three examples ship with Kages: Snowflake reader accounts, choosing a message queue, and self-hosting Redis. Copy one, change the facts, and build.

## What the intake holds

- **The reader and the decision**: who this is for and what they must choose.
- **An explanation** in markdown, optionally with a diagram.
- **One to three questions** and a recommendation for every combination of answers. Kages refuses an intake that leaves a combination without one, so a reader never answers everything and sees nothing.
- **Assumptions** the reader can change (with sensible ranges) and **outputs** computed from them, optionally plotted as a curve.
- **Setup steps** with real commands, and a **checklist** that fills a readiness gauge.
- **Sources**: https links to the primary documentation. At least one is required.

## Honesty is built in

Starting values are labelled illustrative on the page. A guide says **Not yet verified** until a person has checked its facts and the intake carries `verified: { by, on }`; then it says who checked and when. Sources help a reviewer, but they do not make a claim true, so the check is a human one.

## Share and update

```sh
kages push intake-name --server http://localhost:3000 --publish
```

To change a fact, edit the intake and rebuild, then re-push with `--replace`; history is kept. See [getting started](getting-started.md) for the first run and [collaboration](collaboration.md) for how edits merge.
