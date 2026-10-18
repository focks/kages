# Use cases

Most pages people ask an agent for fall into a handful of shapes. Each shape below has a complete, working example you can open, fork and change, so an agent starts from something that already passes the checks instead of from a blank page. Ask for a starter with the `search_templates` operation, or copy one with `clone_kage`.

## Pick the closest example

| You want to | Start from | What it shows |
|-------------|------------|---------------|
| Teach or test something | Study quiz | Questions that score themselves and explain each answer |
| Help someone memorise | Flashcards | A searchable deck where each card hides its answer |
| Explain how a system fits together | Architecture explainer | A diagram you select from, with a description beside it |
| Make something playful | Tic-tac-toe | A two-player game with turns, a winner and a draw |
| Sell or propose something | Pricing proposal | Plans, seats and a live estimate that follows the choices |
| Plan a trip or an event | Trip itinerary | Day tabs, a budget chart and a packing list that keeps its ticks |
| Guide people through a procedure | Incident runbook | Steps that unlock as the previous one is done |
| Record a meeting | Meeting notes | Decisions and a filterable table of action items |
| Show your work | Project portfolio | A filterable gallery and a contact form |
| Build a long, sourced page | [Research brief](research-briefs.md) | Citations, quotes, figures and a self-check |
| Turn a technical answer into a guide | [Decision guide](decision-guides.md) | Sources, a calculator and a checklist |

The other starters cover dashboards, forms, boards, calculators and live data: open the list in the Library, or ask for a template by describing what you need.

## Choose blocks by what the reader does

| The reader will | Reach for | Notes |
|-----------------|-----------|-------|
| Read | `rich-text`, `section`, `toc`, `table` | Use a `page` with a reading width; add a contents list when there are more than three sections |
| Choose or answer | `choice`, `dropdown`, `switch`, `slider` | Bind each to state and show the result on the page as they change it |
| Compare | `table`, `grid` of `card`, `bar-chart` | Put the number that decides first |
| Follow steps | `stepper`, `checkbox`, `code-tabs` | Gate the next step on the last one with `visible` and a bound `disabled` |
| Explore | `diagram`, `scene`, `data-grid`, `tab-panel` | Let a selection drive a second block |
| Play | `scene` with `interactive`, `button` | Keep all game state in `state`; every rule is an expression |
| Send something back | `form`, `text-field`, `textarea` | Validate in the form; show a confirmation, not a blank |

## How the examples are built

Each one is a single Kage: its data in `data`, what changes in `state`, and every behaviour written as an expression the engine checks. Open any of them and read it: nothing is hidden in code.

- **Scores and totals are computed**, never typed in. The quiz adds up its own right answers; the estimate multiplies the plan by the seats.
- **Lists come from data.** The flashcards, the portfolio and the action items repeat one block over rows, so adding a row adds a card.
- **A selection drives a view.** In the architecture explainer, choosing a node in the diagram filters the parts list down to one row, and that row is described beside it.
- **Everything is reachable from the keyboard.** The game board is a set of real buttons inside one drawing, so Tab and Enter play it.
- **Figures are labelled as illustrative** when they are made up, as the pricing page does.

To adapt one, change the `data` and the wording, keep the structure, then run `kages lint` and `kages screenshot` before you share it. For how to author well from scratch, read [authoring with agents](authoring-with-agents.md).
