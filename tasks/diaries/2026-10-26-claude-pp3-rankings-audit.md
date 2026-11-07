# PP3 Rankings audit (Claude, 2026-10-26)

- Scope: read-only audit of every "PP3" deployment bucket outside `web/lib/socialShare` and `web/components/SocialShare`. No source edits, no prod reads, no git mutations.
- Where: `octoberBranch`, working tree as found (HEAD 0d173aed7). Output: `tasks/artifacts/pp3-rankings-audit-2026-10-26/REPORT.md`.
- State: grep plus a read of each site is done; report written. No checks run (audit only).
- Insight: every PP3 originates in `normalizePpDeploymentBucket` (`skaterDeploymentAggregation.ts:140`). No rating or WAR math weights PP3; it acts only as a label, a filter value and a peer-group key. Stored rows carry PP3 only if a writer ran with `deployment=PP3`. Whether any such rows exist was not checked, because that needs a DB read.
- Gotcha: if unit 3 becomes null, the `mostCommon` mode can flip a mostly-unit-3 player to PP2, and the PP3 players drop out of the deployment-tiers PP peer pool, which shifts PP1/PP2 percentiles.
- Next: TJ or the parent picks a fix scope. Diary can be retired once the report is accepted.
- Blockers: none.
