# Getting started

Kages is an artifactory for agents: an agent builds a versioned, interactive page from blocks in a design system, and never writes HTML. This page takes you from nothing to a stored, checked Kage in a few minutes.

## Install

The quickest way to run Kages is with npx — no install, no checkout (Node 18 or newer):

```sh
npx kages --version
```

To work on Kages itself, run it from a checkout instead (Node 22.18 or newer):

```sh
git clone https://github.com/focks/kages && cd kages
npm install
npm run build:cli          # writes dist/kages.mjs, which runs on Node 18+
alias kages="node $PWD/dist/kages.mjs"
kages --version
```

Then, in the project where you work, `kages install` shows the files it would write for the coding tools it finds (Claude Code, Cursor, Codex, Copilot) and writes nothing until you agree. Add `--dry-run` to only look, or `kages setup skills` to add just the authoring skills.

## Set up a workspace

Run this in your project folder:

```sh
kages init
```

It reads your `package.json` and README, asks up to three questions about who the work is for and what must never be invented, and saves the answers as the workspace brief. Agents read the brief first, so they stop guessing your audience.

## Make a Kage from prose

Write some markdown and turn it into a page:

```sh
kages from-markdown notes.md --mode read --create
```

Headings become sections, tables become tables, `> Note:` lines become callouts, and a page with several sections gets a contents sidebar. `--mode` says what the reader is trying to do: read, operate, persuade or experience.

## Check it

```sh
kages validate notes
kages lint notes
```

Validation says whether the page is correct. Lint says what is valid but wrong, such as a button that does nothing, with the fix for each finding.

## See it

A Kage you create with the CLI lives in `./.kages/store.json`. The web app keeps its own store, so a Kage made on the command line does not appear in its Library until you push it.

- **From the terminal:** `kages screenshot notes --width 390,1200` renders it in headless Chrome and reports layout problems; `kages describe notes` prints a text view of it.
- **In the Library:** start the app with `npm run dev`, then send the Kage across:

```sh
kages push notes --server http://localhost:3000
```

It creates the Kage in the running app and prints the link to open. Run it again with `--replace` to update the app's copy (history is kept; nothing is deleted) and `--publish` to make it shareable. For an app with hosted accounts, pass `--token` or set `KAGES_TOKEN`; `kages auth login` signs the whole CLI in so it writes to your cloud workspace directly.

## Next

- [Concepts](concepts.md) explains the few ideas everything is built from.
- [Authoring with agents](authoring-with-agents.md) shows the loop an agent follows.
- [Blocks](blocks.md) and [expressions and data](expressions.md) are the authoring reference.
- [The CLI reference](cli.md) lists every command, and the [REST API](rest-api.md) covers calling operations over HTTP.
