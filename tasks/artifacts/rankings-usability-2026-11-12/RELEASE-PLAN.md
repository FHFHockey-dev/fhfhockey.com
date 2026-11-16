# Rankings future release packet

State: **prepared locally; no release/build slot allocated or consumed**. No commit was created. No index/ref/source mutation, push, build, deployment, provider call, database call or production request was performed for this preparation.

## Exact candidate and independent review

The release content remains exactly:

| File | Candidate SHA-256 |
| --- | --- |
| `web/pages/rankings.tsx` | `6dfc9f9f598707cf8d7d9f07491ff9705eb969751493a8ae6551ad6f12490d04` |
| `web/__tests__/pages/rankings.test.tsx` | `24cb7433184acd1fe7d21b4ece79fcc234ac2d90bfbc3b9ee578e3b381a7b9d3` |

`SOURCE.patch` SHA-256: `b520d6a1ad0d6b6602a76bed8cde536ebc2007dcefeeab92429ef0717bd6f779`. It contains those two files only. Original implementation/review base: `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f`.

`INDEPENDENT-REVIEW.md` verified these exact file pins and found no actionable issue or local blocker. Evidence in `CHECKS.json`: 23 passing fixture tests; 13 passing isolated Chromium scenarios; typecheck and scoped lint passed (three existing image warnings); scoped accessibility checks passed at 320/390/1440 pixels. No metrics, request builders, API response types, migrations, shared components or stylesheet changes are part of this patch.

There is **no final release commit SHA yet**. The future release owner must assemble these exact contents on the then-confirmed release parent, record the resulting SHA, and reconcile other accepted lanes before publication. This packet is not permission to use local `master` or publish the entire dirty checkout.

## Base reconciliation and conflicts

`RELEASE-PREFLIGHT.json` records read-only refs captured during this preparation; HEAD advanced concurrently due to other owners' coordination commits. No moving ref is treated as a permanent pin.

| Base observed | SHA | File-only patch result |
| --- | --- | --- |
| Canonical `octoberBranch` HEAD at capture | `f821bcf8018c0a38badbf785e7f7a8ce5fce8597` | Clean apply; exact reviewed file hashes reproduced |
| Cached `origin/master`, also the latest retained production receipt | `866b90bc46a169b42cbc3c54a7d64b0daf764121` | Clean apply; exact reviewed file hashes reproduced |
| Pending Goalie source-release candidate | `4243bcd4e29889c035e832562e25850d14af0ee1` | Clean apply; exact reviewed file hashes reproduced; not asserted deployed |
| Local `master` | `3c03df7dc815cc74aefbf19d5c5a16333985b1e5` | **Does not apply**; this older/different Rankings baseline is not a suitable assembly base without reconciliation |

Tests above used temporary directories containing only `git show` exports of the two files; `git apply --check`, then file-only application and hash comparison. No alternate or canonical index, branch or worktree was created. Temporary exports were removed. The shared index was empty when observed and remains untouched by this task.

Conflict risks to preserve:

- `web/styles/Rankings.module.scss` now has another owner's dirty button-tint changes. They are **excluded**. Its committed hash on the review/HEAD/retained-production baselines is still `12e372e4301fa66a13cbda6c17d4d751afcf3acc244b680ec4921848c02bdfa5`, matching the stylesheet used for the retained browser evidence. If accepted shared styling is later included, rerun the isolated browser checks against that assembled styling; do not call the current dirty style already qualified by the earlier screenshots.
- Related committed Rankings components/lib, season hook, package manifest/lock and page/style paths show no changes from the original review base to the observed HEAD, or from retained production to the pending Goalie candidate. No new shared-dependency test run is warranted solely for the mailbox/base movement. Recheck this at actual assembly.
- Preserve all unrelated dirty files, shared admission/forecast work, DRM work, coordination receipts and the shared index. Release artifacts, diaries and harness files are not source release files.

## Serial order and future build plan

The acknowledged order is Trends repair → Goalie source release → Claude summary/goalie refresh → wider DRM repair → Goalie H1. Rankings has no place allocated in that sequence. Do not interrupt it or infer a build slot from a database handoff. The later `CLAUDE-FIX-SPRINT-DB-HANDOFF-2-20261112` ends Claude's phase E and advances the agreed sequence; it does not grant Rankings a slot.

When Scout/TJ allocates a future release slot:

1. Confirm exact current production parent, final candidate SHA, target **fhfhockey / production / master / root `web`**, and approval for that remote action. The local project link identifies `prj_LV0wbwH5gRjOsZlowzEFNGRuX7Lw`, team `team_KVFicHhQJARTbO6wRD2x6jpq`. Do not change integration/settings or enable previews.
2. Re-inventory all repository-linked Vercel projects and their current root/branch/ignored-build behavior, including previous deployment SHAs. Check for a successful or in-progress deployment of the exact final SHA/environment; reuse or await it. Do not launch a duplicate.
3. Cached inventory at `../drm-ddatv-2026-11-12/VERCEL-READ-ONLY-PREFLIGHT.json` (2026-11-12 17:41Z) lists `fhfhockey`→`web`, `cms-fhfhockey`→`cms`, `functions-fhfhockey`→`functions`, and `fhfhockey.com`→repository root; all production branches `master`. Local rules still show root `exit 0`, CMS/functions directory-only diffs and web/cron-schedule diff detection. For a clean two-file web-only delta, the expectation is **four deployment entries: one web build and three ignored/cancelled companion entries**. This is conditional on fresh settings/previous-SHA checks, not a verified future count. If a companion would build, stop for an approved targeted skip/filter plan; never silently change settings.
4. Reuse existing verification when content/dependencies match. If the assembled base changes relevant runtime/styling, run the narrow page tests, isolated fixture browser checks, scoped lint/typecheck as warranted. No routine local production build is needed; no remote preview build is proposed. The future authorized production deployment is the one expected web build. Record actual entries/builds and inspect any failure before proposing another attempt.

## Rollback plan

- No data/schema/state migration is introduced. Rankings-specific rollback needs no database operation, regeneration or cache purge.
- At final assembly, preserve the two pre-change blobs from the exact release parent and their hashes. The retained production/Goalie/observed-HEAD baselines currently agree: page `98ccd3fcd5d3675ae01a71682b0132b778278f8f982ad4c06ff130621babca6c`; test `fa5ac67007af9fb3d18455e61ca85bd9b08ec9e7f818070328d89e88d257afa6`.
- For a post-release regression, prefer a narrowly reviewed source revert/fix of only this patch, preserving intervening accepted work. Its additional deployment requires a coordinated slot and authorization; no blind reverse patch against an evolved tree, checkout reset or shared-index overwrite.
- An emergency Vercel traffic rollback is a separate owner decision: record the **actual immediately preceding known-good deployment ID/SHA at release time**, assess other bundled lanes, and obtain approval before promotion/rollback. Do not hard-code the old DRM deployment or undo Goalie/other accepted work by assumption. Stop on an uncertain result and inspect metadata rather than retrying blindly.

## Bounded smoke plan, after an authorized release only

Plan, **not executed**. First confirm READY and final SHA through deployment metadata. Then use at most **two sequential raw HTTP GETs, concurrency one**, no browser JavaScript, no retries, no cache busting, and stop on the first failure or unexpected identity/content:

1. `https://fhfhockey.com/rankings?entity=skaters&tab=rankings&season=20252026&window=last5&strength=all&min_gp=1&min_toi=600&page=1&page_size=10` — require 200 HTML and the Rankings page shell/title. Do not execute downloaded scripts or follow their request fan-out. The page and `_app` have no `getServerSideProps`, `getStaticProps` or `getInitialProps`; page data fetching is client-side. Recheck this assumption on the final candidate if either changes.
2. `https://fhfhockey.com/api/v1/contextual-rankings/metadata` — require 200 JSON, `success: true`, and the expected metadata structure. The inspected handler calls the in-memory metadata builder; no database/provider client is in that route's implementation. Reconfirm on the final candidate if dependencies change.

These two cheap read paths verify serving and metadata compatibility, not live calculation correctness or interactive recovery. Actual recovery, keyboard/focus, request bounds and reflow acceptance comes from the isolated fixture harness. Do not run live matrix/comparison/trending requests, the live rankings E2E suite, cron/refresh/recompute/sync endpoints, or an unbounded browser crawl for this lane. A broader production smoke requires its own explicit bounds/approval.

## Remaining release gates

- Scout/TJ's future slot and exact remote-release authorization.
- Fresh production parent/project inventory, assembled candidate SHA and duplicate-deployment check.
- Requalification only if accepted source/dependencies differ from this packet (especially shared styles).
- Native screen-reader speech and full Next.js-shell behavior remain unverified; no full accessibility-conformance or production performance/cost claim.

No additional local code change is needed for the two-file candidate. Preparation preserves the shared index and other owners' edits.
