# Exact next public-source verification

Purpose: verify one current Kucherov NHL card against real identity/season-GP metadata, game-log counts and final-game schedule. No private database/project/tables, credentials, writes, refreshes, provider fallback, uploads or other players.

One execution, three sequential public HTTPS GETs at concurrency one:
1. https://api-web.nhle.com/v1/player/8476453/landing
2. https://api-web.nhle.com/v1/player/8476453/game-log/20262027/2
3. https://api-web.nhle.com/v1/club-schedule-season/TBL/20262027

If landing identifies a different team, stop without substituting another URL. Per response: 512KiB and five seconds; total 1.5MiB and fifteen seconds. No redirects or retries. At most 100 game-log rows and 140 schedule rows. Stop on an identity, season, GP-count, finality or chronology mismatch. Preserve non-sensitive raw responses/hashes/capture time before using them.

These are public production NHL reads. None has been executed in this slice. The current instruction forbids new external reads; this is a handoff proposal, not an execution claim.

Success would qualify basic selected-player counts/rates for a current observation. It would not prove actual game-end timestamps, a historical cutoff, NST metric definitions, career milestones, a complete all-NHL comparison population, ranks or percentiles.
