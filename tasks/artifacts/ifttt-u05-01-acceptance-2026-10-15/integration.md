# U05.01 — dedicated IFTTT routes restored locally

**Local implementation is complete and verified; authentic inbound acceptance remains open.** The exact previously accepted v3 candidate was recovered and restored in `/Users/tim/Code/fhfhockey.com` on `octoberBranch`, HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`. Changes are uncommitted. This handoff supersedes the earlier checkpoint's local-code state and provisional lowercase route proposal.

## Dedicated endpoint contracts

| Exact endpoint | Stored source group / key | Account | Binding name |
| --- | --- | --- | --- |
| `POST /api/v1/sources/ifttt/DFOFantasy-tweet?process=true` | `dfo / dfofantasy` | `DFOFantasy` | `IFTTT_DFOFANTASY_WEBHOOK_SECRET` |
| `POST /api/v1/sources/ifttt/NHL-Rosters-tweet?process=true` | `nhl_rosters / nhl_rosters` | `NHL_Rosters` | `IFTTT_NHL_ROSTERS_WEBHOOK_SECRET` |

The existing `x-fhfh-ifttt-secret` authentication mechanism and JSON `text`, `username`, `link_to_tweet`, and `created_at` fields are preserved. No applet changes are required by these paths. The two routes opt into source-account validation after authentication; case and an optional leading `@` remain tolerated, but `NHL-Rosters` is rejected as an account because the approved account contains an underscore.

The shared helper preserves raw payloads, duplicate-ignore upserts on `source_key,tweet_id`, timestamp parsing, POST-only validation, configured-origin dispatch, and raw-first retry behavior. Immediate follow-up now includes the route's `sourceGroup`; without it, `update-line-sources.ts` defaults to `gdl_suite` and cannot select either new source's rows.

The accepted candidate also restores pending retries for both sources, with the correct group/key pairs. Existing GameDay and CCC routing is retained. This changes the future enabled retry pass from four processor calls to six, each still limited to five current-day events. It adds at most ten candidate events per pass. No retry was invoked and no cron settings changed.

## Recovered acceptance and precise missing integration

The recovered source is:

`/Users/tim/Documents/Codex/2026-10-11/task-2/ingestion-reliability/dfo-nhl-ifttt-local-candidate-v3/`

Its manifest SHA-256 is `fd94cad005127fd011a365fe4500535e54cf569bf1ab74891a1751b1bc4a0a84`; all 20 members were verified. Reviewer thread `01a12c1b-882b-7872-969d-ae4edecee02f`, turn `01a12d0e-4624-72a3-a289-4993a4f6bf02`, explicitly accepted v3 and closed the source-group P1. That acceptance and its exact hashes are retained in [integration-receipts.json](integration-receipts.json).

The accepted code existed only as physical private candidate files. It was never integrated into the canonical route directory or shared receiver. Both current shared files exactly matched the candidate's original baselines, and both new endpoints/tests were absent. The patch therefore applied without conflict or merge.

The original inspection used the correct canonical checkout and project. Local `master` and `origin/master` equal observed production SHA `90d3d5963f47dccfe690d5582dae3d23a598e16d`; `octoberBranch` and its tracking ref equal the current HEAD above. Both canonical `.vercel/project.json` files identify project `fhfhockey / prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw` and team `team_KVFicHhQJARTbO6wRD2x6jpq`, matching the inspected READY deployment `dpl_HxdhE1sPUQM9RXaBuUJK1y4VFcPW` and its production domain aliases. The historic `fhfhockey-october` checkout was only read and also lacked the new routes.

## Exact review scope

| Canonical path | Integration result |
| --- | --- |
| `web/pages/api/v1/sources/ifttt/DFOFantasy-tweet.ts` | Added; byte-identical to accepted v3. |
| `web/pages/api/v1/sources/ifttt/NHL-Rosters-tweet.ts` | Added; byte-identical to accepted v3. |
| `web/lib/sources/lineSourceIftttReceiver.ts` | Restored account validation and source-group-aware immediate/retry routing; byte-identical to accepted v3. |
| `web/lib/sources/lineSourceIftttReceiver.test.ts` | Restored exact six-route/group/key retry assertions; byte-identical to accepted v3. |
| `web/__tests__/pages/api/v1/sources/ifttt/DFOFantasy-tweet.test.ts` | Recovered test moved into the established test tree, changing only the handler import. |
| `web/__tests__/pages/api/v1/sources/ifttt/NHL-Rosters-tweet.test.ts` | Same relocation/import-only adaptation. |

The test relocation keeps test modules outside the Pages Router API tree. No runtime implementation was rewritten.

[The complete applied diff](integration-recovered.diff) has SHA-256 `b2bcc2e913aaf795279e3e642b199a5ca2b7116d3506f9c5e4194160b67fec93`. Source and test hashes are recorded in the receipt. This exact candidate is ready for the parent's independent integration review.

## Checks actually run

- **Passed: 34/34 tests, four files.** From `web/`:

  `npm test -- --run lib/sources/lineSourceIftttReceiver.test.ts __tests__/pages/api/v1/sources/ifttt/DFOFantasy-tweet.test.ts __tests__/pages/api/v1/sources/ifttt/NHL-Rosters-tweet.test.ts __tests__/pages/api/v1/sources/ifttt/ccc-tweet.test.ts`

  These cover both actual route exports, auth-before-validation, exact source identity including underscore handling, raw evidence preservation, duplicate handling, bounded dispatch with source group, pending retention on failure, and existing receiver compatibility. They use mocked database/fetch calls; no inbound event was submitted.

- **Passed:** scoped TypeScript syntactic/semantic checks for the six owned canonical files using the owning `tsconfig.json` options; zero diagnostics. This is not an aggregate web type-check.
- **Passed:** ESLint for the six explicit paths; zero output and exit 0. The first `npm run lint -- --file ...` attempt failed because this repository invokes ESLint directly. It was corrected to the installed ESLint binary with explicit paths, without changing tooling.
- **Passed:** `git diff --check`, accepted-byte/adaptation comparisons, manifest verification, and preservation of all 13 recorded parser/identity/adjacent source hashes.
- **Not run:** full suites, aggregate type-check, local/remote builds, browser probes, live receiver/processor calls, or repeated database queries.

## Remaining acceptance and release boundary

The owner reports both applets are already configured; their exact approved paths are now implemented locally. Production still uses the previously inspected deployment, which lacks these endpoints. Production secret-binding presence was not inspected, and no secret was read or printed.

U05.01 cannot yet close as an end-to-end inbound acceptance task. After a separately authorized release, retain one ordinary natural delivery per source: safe applet activity/run ID and exact destination, original tweet ID/time, raw event UUID with the correct source fields, existing deployment/request correlation where available, and the processing capture key joined to snapshot `metadata.iftttEventId`. Preserve the actual classification/filter outcome and do not infer parsing success from HTTP 200. The earlier bounded read-only results remain in [receipts.json](receipts.json); they showed no target events/snapshots and are not replaced by these mocked tests.

Suggested parent-register update:

> U05.01: local dedicated routes restored from independently accepted v3 and verified (34 tests; six-file lint/types). Ready for integration review. Release and authentic inbound acceptance remain open. Exact candidate and receipts: `tasks/artifacts/ifttt-u05-01-acceptance-2026-10-15/integration.md`.

No parser/alias edits, DB mutations, live ingestion/cron calls, replay, applet/credential changes, pushes, deployments, sealed-outcome reads, or server/port actions occurred. No owned command remains running. Receiver/test ownership can transfer to the parent reviewer; preserve the unrelated dirty tree.
