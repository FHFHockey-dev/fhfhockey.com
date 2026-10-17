# Manager-confirmed rule mapping; no state applied

Source: TJ response relayed by Scout,2026-10-16T01:36:32Z: same day; one acquisition per free-agent/waiver add;2remaining this week; reset Sunday into Monday at3am, described as EST. Scout has already asked whether EST means America/New_York with DST or a fixed EST offset. Do not repeat the question or finalize an instant until answered.

Existing entry: **League settings** → **League rules and scoring** → **Acquisition rules** (`#rso-acquisition-rules`). The existing **Scoring, budgets, and lock windows → Review acquisition rules** bridge opens the same controls.

| Confirmed fact | Existing visible control | Value/field | Handling |
| --- | --- | --- | --- |
| Adds usable same day | Acquisition timing | Same day; acquisitionTiming=same_day | Manager-confirmed supplement to unknown provider timing. |
| Each free-agent/waiver add costs one allowance unit | Acquisition cost |1; acquisitionCost=1 | Units per add, separate from waiver bids or FAAB. |
|2moves remain in the current week | Moves left, within a correctly scoped acquisition period | remaining=2; source=manager | Applicable only to this current allowance period. Do not populate a future period or infer an unlimited allowance. |
| Reset at Monday3am | Period Start/End | Exact interval pending | Time-zone interpretation is unanswered. Existing controls only accept dates and write local-midnight start/next-midnight end; they cannot faithfully encode3am. Do not substitute midnight. |

Implementation inspected at RosterScheduleOptimizer.tsx1113–1122. The Start field calls leagueDayBoundary(date,timeZone); End calls leagueDayBoundary(date,timeZone,true). Add acquisition period proposes the selected full-date range and null remaining; that proposed interval is not evidence of the actual reset. A numeric2can be stored by the existing handler, but an inaccurate surrounding interval would not be a truthful rule application. No period or workspace patch was created/applied here.

Known manager values remain separate from Yahoo-verified facts. Yahoo Week3one-used evidence does not itself verify the total cap or a future reset/allowance. Waiver mode/bid budget/clearance, future allowance, goalie progress, locks, other unknown league settings and whole-week schedule qualification remain unchanged. No actual console, localStorage, account PUT or live provider/database action occurred.

The smallest follow-up after the zone answer is to decide how to represent the confirmed intraday reset within the current accepted controls, with a narrowly authorized UI change if required. This note does not authorize or implement such a change. Known-pool evaluation work is complete independently of this pending rule interval.
