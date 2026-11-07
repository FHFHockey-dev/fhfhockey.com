# SS 5.0 lane C: Player vs Player

- **Scope:** `playerVsPlayer` five-file set, candidates JSON, lane barrel, E2E spec, `SENTIMENT-ASSESSMENT.md`, receipt. Subtasks 5.1-5.5. 5.6 stays open until TJ supplies or approves candidates.
- **Where:** `octoberBranch`, canonical checkout; base `7bddeaf0d`. Files under `web/lib/socialShare/modules/`, `web/components/SocialShare/modules/`, `web/e2e/`.
- **Decisions:**
  - Every state prints "No consensus established". A hand-picked file has no sampling frame, so even a one-sided set cannot establish one. No tallies or percentages.
  - Basis is `observed`, not `market-observation`: the claims are discussion, and calling them market data is the failure SS-R06 forbids.
  - Card shows two claims, chosen across sides so a conflict is never hidden by the cut. All claims with URLs go in the alt text.
  - Totals on differing samples get no "higher" mark.
  - `hasRows` also checks the loaded data against current settings, because the shell prints current settings after a change with no refresh.
- **Gotchas:** Gemini grounded results may not be cached, syndicated, analyzed or shown beyond the prompting user, which rules out the route as proposed. redditinc.com and the Reddit help pages refused the fetch, so Reddit terms are cited through secondary sources and flagged as such.
  - Layout pass after TJ's review: full-width stat block, one legend line, disclosures moved to `evidence.cohort` and alt text. The legend keeps a short "hand-picked" warning. URLs capped at 200 characters.
  - Bars after TJ's real-pair review: `pvpBarShares` sizes them, a missing value or uncompared row draws none, and the headline is one small line with no posts.
- **State:** 5.1-5.5 built, layout pass and bars done. 61 tests, eslint, pure check and tsc pass; E2E `--list` shows 4 tests, not run in a browser, so the fit at 860px is unproven.
  - SS-1103-C (2026-11-03): late newest nights trimmed via `completeThrough`, with a page note. Older gaps stay partial. No complete night means blocked. Teams' coverage is now dated games. 91 tests pass; tsc errors are only in other lanes' BLSH and player-card files.
- **Next step:** the lead runs the E2E at 13.0, which includes the fill check.
- **Blockers:** none. TJ decided 5.6 stays open until TJ adds candidates, and discovery stays blocked.
- **Gotcha:** default-heap `tsc` crashes; use `NODE_OPTIONS=--max-old-space-size=8192`.
