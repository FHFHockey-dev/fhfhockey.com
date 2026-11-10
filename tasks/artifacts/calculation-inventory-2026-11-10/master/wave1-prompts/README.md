# Wave 1 run order (TJ runs each prompt in a Fable 5.2 session in the app)

Run in three batches, so downstream audits can read upstream results. Within a batch the prompts are independent, but run at most 3 at once: they share one small production DB.

- **Batch A (event and aggregate layer):** w1-1 xg-part1 · w1-2 nst-derived-stats · w1-3 rolling-player-averages-trends-part1 · w1-4 team-ratings-power-ctpi-sos · w1-5 goalie-starters-starter-odds
- **Batch B (models):** w1-6 forge-projections-part1 · w1-7 forge-projections-part2 · w1-8 player-forecasts-season-part1 · w1-9 sustainability-part1
- **Batch C (decisions):** w1-10 game-predictions-odds · w1-11 rso-roster-optimizer · w1-12 fantasy-scoring

Each writes `master/audits/<packet>.md`. Chef reviews and merges them into the fix plan. No code changes happen during the audit.
