# Pilot: do people come back, and do they share?

A two-week pilot with ten people who repeatedly explain technical choices, costs or setup to customers (solutions engineers, technical consultants). It tests one hypothesis: **they will reuse the guide format for a second real task, and send a guide to a real recipient.** Visual quality is already shown; this measures repeat use.

The thresholds below were set before the pilot, as decision aids. They are not benchmarks or forecasts.

## Before you start
- The clean-machine path works: build the CLI, `kages install`, open the docs page `/docs/build-a-guide`, create a guide, `kages push --publish`, open the link. Walk it yourself on a fresh directory and fix what breaks before inviting anyone.
- Each participant gives informed consent to being observed and knows exactly what is measured (below). Nobody's source material or answers are collected.
- Recruit people with a **real, recurring** task, and ask them to bring their own notes and a real question. Do not give them a topic.

## What is measured
Only what `kages pilot stats --json` prints: counts and whole days, derived from the participant's own workspace. No titles, text, names or ids. They send the file if they choose to. Everything else comes from observation and interviews.

| Signal | Source | Threshold (of ten) |
| --- | --- | --- |
| Produced a useful first guide with minimal help | Observed session; time to first useful guide and every intervention you made | 7 |
| Created or substantially updated another guide within a week, unprompted | `daysToSecondGuide <= 7`, then ask whether you prompted | 5 |
| Shared a guide with its intended recipient | `shared >= 1`, then confirm the recipient was real | 3 |
| Got feedback from that recipient | `withFeedback >= 1` | 2 |
| Came back on a different day | `activeDays >= 2` | 5 |
| Would commit to a paid pilot | A concrete ask, not a hypothetical price question | any |

`kages pilot summarize a.json b.json ...` applies the numbers and exits 1 when any is missed.

## Sessions
1. **Setup (30 minutes, observed).** They follow the getting-started page alone. Note every stall and every question. Stop the clock at the first guide they would show someone.
2. **Their real task.** They bring notes and a question and build with their own agent. Do not coach; record what you would have said.
3. **Share.** They send it to a real recipient through their usual channel. Ask for the recipient's permission to talk to them.
4. **Revise.** After feedback, they ask their agent for one change. Note whether the history, patch and review workflow was used or ignored.
5. **Day 7 and 14.** Short calls. Did they return? Why or why not? What did they use instead?

## Interviews
**Author:** What were you going to use otherwise? What did the guide let you do that a document or chat answer would not? What did you not trust, and what did you check? What stopped you sharing sooner?

**Recipient (with permission):** What did you do on the page? Did you change a number or answer a question? What did you decide, or do differently, because of it? Would you have wanted a plain document instead?

## Reading the result
- A guide that looks good but is never reused is a signal to change the use case, not to add components.
- A high critique score is not the success measure; a recipient making a useful decision is.
- If the thresholds are met but the recipients say a document would have done, the product has an interaction problem.
- Choose the next engineering work from observed obstacles only; each item should name the participant stall it removes.
