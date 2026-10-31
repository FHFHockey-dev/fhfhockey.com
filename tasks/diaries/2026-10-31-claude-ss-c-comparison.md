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
- **State:** 5.1-5.5 built. 34 post tests, eslint, pure check and tsc (my files) pass; E2E `--list` shows 3 tests, not run in a browser.
- **Next step:** the lead runs the E2E at 13.0, and TJ answers 5.6.
- **Blockers:** 5.6 needs TJ. The lead asks.
