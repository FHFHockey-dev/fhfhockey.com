# Cost follow-through (separate from release scope)

Three different things are easy to conflate. This file keeps them apart:
- **deployment entries:** what Vercel lists
- **completed builds:** what ran a full build
- **billable spend:** what was charged

Only the first two are observed here.

## Observed (read-only, 2026-10-17T19:58Z)

Method: one `vercel api GET /v6/deployments` per window, for team `team_KVFicHhQJARTbO6wRD2x6jpq` (CLI 60.0.1), plus GitHub status, deployment and check-run reads. Project settings were not re-read, because that response carries env metadata. Receipt: `vercel-github-observation.json`.

| Window | Deployment entries | Completed builds | Canceled / ignored | Billable spend |
|---|---|---|---|---|
| since 2026-10-15T00:00Z | 4, all for `457435eb` at 04:52Z on 10-16 | **1** (`fhfhockey`, `dpl_6ccUfnYgqnueRsNEbSESqZmSbzPu`, READY) | 3 CANCELED (`fhfhockey.com`, `cms-fhfhockey`, `functions-fhfhockey`) | unknown |
| since 2026-10-17T00:00Z, which covers the `448231eca` push (~17:10Z) and the `ceceb407a` push (~19:51Z) | **0** | 0 | 0 | unknown |

- Previews: all four projects were `previewDeploymentsDisabled=true` when the register session read them on 2026-10-17. That was not re-read here.
- Canceled is not the same as free. Per the 10-16 logs, ignored CMS/functions entries still did setup, clone and cache work. Dollar cost and hosted prerender request counts remain **unknown**.
- Runtime usage (function CPU, invocations, data transfer from the cron fleet) was not measured. Nothing here supports a savings claim.

## Expected cost of the proposed actions

| Action | Expected entries | Builds |
|---|---|---|
| R1 release push to `master` | 4 | 1 web production build + 3 canceled |
| Cleanup C2 or docs-only pushes to octoberBranch | 0 (previews disabled; root has `ignoreCommand: exit 0`) | 0. Re-confirm after the push |
| Any push to `master`, even docs-only | 4 | Expected 0 completed (web path filter). The canceled entries still cost setup |

## Open items, each needing TJ

1. **Measure spend.** Register row 90 needs the "Weekly Usage Summary for fhfhockeydev's projects" email. Row 93 (post-release savings) stays blocked until then.
2. **Node mismatch.** `cms-fhfhockey` and `functions-fhfhockey` run Node 20.x; web runs 22.x (`web/.nvmrc` 22.11.0). Node 20's upstream end of life was 2026-04-30. Check Vercel's own deprecation date for those projects before their next intentional build. Aligning them is a project-settings change and needs approval. Not proposed here.
3. **The empty-root `fhfhockey.com` project.** It always cancels, through the root `vercel.json` `ignoreCommand: "exit 0"`, but it still adds one entry and its setup work to every `master` push. Disconnecting it is a settings change. Decide its purpose first (row 91).
