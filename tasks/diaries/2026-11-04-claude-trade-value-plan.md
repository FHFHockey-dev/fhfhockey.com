# 2026-11-04 · Claude · Trade-value pipeline plan (decision 6)

## Scope
Planning only for BLSH decision 6: write `tasks/artifacts/trade-value-pipeline-2026-11-04/PLAN.md` and put the 2–4 decisions it depends on to TJ in pop-ups. No code, provider calls, database access, deploys or pushes. May commit only PLAN.md and this diary.

## Where
- Branch `octoberBranch`, canonical checkout. Started from f98d28dc7.
- Inputs read: DECISIONS.md §6; `web/lib/player-cards/analysisEvidence.ts`; `web/lib/buyLowSellHigh/{market,trade}.ts`; `web/lib/integrations/yahoo/{oauth,providerClient,yahooIdentity,pollPolicy,tokenManager}.ts` (read-only); both lease files; Codex 10-27 Trade Market PoC in `/Users/tim/Documents/Codex/2026-10-27/task-5/`; Roster Autopsy PRD FR8; MASTER-LIST LM-TRADE-MARKET.

## State / checkpoints
- Found the source: the Trade Market is a website page `hockey.fantasysports.yahoo.com/hockey/playertrades?pid=<yahoo pid>&type=player`, not an API resource. Two normal fetches on 10-27 returned 429. No real HTML, zero observations.
- TJ reported Yahoo permission (logo condition) and "I have permission for this specifically" (Codex record, 10-27). Agreement text is not inspected; scope is unknown.
- Identity path exists: Yahoo key → `fhfh_player_external_identities` → `fhfh_player_identities.nhl_player_id`.
- Codex already drafted a ten-table `yahoo_trade_market_*` schema (unapplied, untested).
- Lease check: Codex holds `playerWriter.ts`, `ingestionLifecycle.ts`, `discovery.test.ts`, `writerPermissions.test.ts`; Claude lane RSO-YAHOO-DIET-P2 (active) holds `rosterPlanning`, `planningConfirmations`, `providerClient.ts`, `starterBoard.ts`.
- Terms research done (read-only subagent; I re-read the API ToU §1(g)/2(a)/2(b) and the ToS §2(d) 9–10 myself). Public terms bar scraping, storage past 24 h and disclosure without Yahoo's permission.
- PLAN.md written. TJ pop-ups answered (recorded verbatim in PLAN §7):
  - D1: the permission covers all four uses.
  - D2: "Scrape and upsert to supabase", so storage comes before the canary and the parser runs on stored bodies.
  - D3: the wider universe (~700 pages a week, 1 every 15 min).
  - D4: VOR + season-to-date + projected + weighted ADP with a plausibility guard. This amends decision 6 for ADP only.

## Next
Commit PLAN.md + diary (done in this step). Next owner: build lane P0 → P4, plus a separate valuation lane P5. Each external step (migration, canary, cron) needs its own TJ approval.

## Blockers / approvals
Not blocked. The §6 questions (volume, retention length, Trade Hub overlap, attribution) wait on TJ's Yahoo contact.

## Gotchas
- Lease file `as_of` dates are 10-31 / 11-01; the status of the leases may have moved on.
- TJ's D4 answer overrides decision 6's "ADP is not a price" rule for ADP only. Ownership stays context only.
- Vercel cost: about 96 cron calls a day at P4. Inventory against AGENTS.md before switching it on.
