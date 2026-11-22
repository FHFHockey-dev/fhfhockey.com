# BLSH pilot re-date on master 523ba0108: X and Y (local only)

Nothing was pushed, deployed, applied or armed. The only git writes are the two rc refs below and their objects.
octoberBranch's `verifiedForgeReleases.ts` was not touched.

| | SHA | Tree | Ref | Parents |
|---|---|---|---|---|
| X | `b5e18f49078addde4bda3e5679e5602f8ed58393` | `596918577eaebf61ef89e6b9257b12793f17d1f4` | `refs/rc/blsh-pilot-redate-20261122-x` | 523ba0108 (master), 16f5c4603 (pilot) |
| Y | `1efdfb4364dffa73a9c249f382dbfebe22ebbbd2` | `0b3ef7de02d8db2b1e800048f267b05df6d7957c` | `refs/rc/blsh-pilot-redate-20261122-y` | X only (fast-forward of 523ba0108) |

Author/committer TJ, fixed dates 2026-11-21 23:00:00Z (X) and 23:10:00Z (Y), no attribution. Built in
/private/tmp/blsh-pilot-x (fresh repo, shallow-since 2026-11-14 fetch), re-created byte-identically in canonical
(commit-tree; Y via a temporary index) and stored with create-only update-ref.

## Merge
`git merge-tree --write-tree --messages 523ba0108 16f5c4603` → `596918577e…`, exit 0, no conflicts, nothing resolved
(merge-tree.out). Merge base is R′ 0d8b141bc; master's 32 changed files and the pilot's 23 are disjoint.

## Migration order
Master's newest is `20261121205959_luna_fxtwitter_receipts.sql`; `20261121210000_blsh_official_pilot_redate_20261122.sql`
sorts directly after it. No duplicate version prefix in X's `supabase/migrations/`.

## Gates on exact X (clean export, HEAD=X, no tracked changes; all rerun, no receipts reused)
| Gate | Result | File |
|---|---|---|
| pg15-validate.py (redate-20261123) | 69/69, output identical to the committed .out | pg15-validate-on-X.out, pg15-diff-vs-committed.txt |
| supabase/tests/blsh_official_pilot.py | 3/3 PASS | blsh_official_pilot.out |
| vitest focused (lib/blsh, scripts/blsh, lib/cron, cron-audit-wrappers) | 890 passed, 19 failed, 3 skipped; all 19 are the pre-existing `bootstrap_wrong_checkout` in nativeProcessCaptureBootstrap.test.ts (same 19 on R′ and 16f5c4603) | vitest-focused.txt |
| vitest related (officialPilotHandler/Store/Acquisition, readHostedOfficialV6.mjs, both testHelpers, nstClassification, nstCoordination) | 18 files, 519/519 | vitest-related.txt |
| npm run typecheck | exit 0 | typecheck.txt |
| npm run lint | exit 0 (70 pre-existing warnings, none in touched files) | eslint.txt |
| CSS Modules pure check | 241/241 | css-pure-check.json |
| SOURCE_PINS (reviewNativeV6Packet.mjs) | 10/10 | source-pins.json |
| info: supportedBaselineMigration.test.ts | 1/21 fails (168 vs 156 entries); pre-existing on R′ and 16f5c4603, master adds 3 migrations; registry owner reconciles | vitest-supportedBaseline-on-X.txt |

## FORGE producer closure
| Commit | Verified | Closure | Modules | Findings | Receipt sha256 |
|---|---|---|---|---|---|
| master 523ba0108 | yes | `0446100e09f468bc061dbc7049ddc1fddec54237a617d7e63ca4835a66b48223` | 243 | 0 | bac6463d…05517 |
| X b5e18f490 | yes | `d6520f1c72711fcd151c1484f81c0379fc15c57e80963e72e024c1cd4e23e1e2` | 243 | 0 | 8c2d3a3ca8b513f009ae6f74e75745e6cd1b547e890ff3fadbca0d5a7d069dba |
| Y 1efdfb436 | yes | `d6520f1c…` (= X) | 243 | 0 | 4b7ffdec…3df8a |

X differs from master. Same 243 module paths; the only closure modules whose content differs are the restored L7
files `lib/cron/nstClassification.ts` and `lib/cron/nstCoordination.ts`. (d6520f1c equals the illustrative preview
merge onto 096b78b62.)

X receipt: `tasks/artifacts/blsh-replay-2026-11-20/live-pilot-20261121/b5e18f49078addde4bda3e5679e5602f8ed58393.json`
(sha256 8c2d3a3c…), written in the working tree and committed in Y.

## Y
Y = X + the X receipt (path above) + one registry entry appended LAST in `VERIFIED_FORGE_PRODUCER_CLOSURES` (after
0446100e/e2f8c6bc9) with master's field names + the matching test row in the same position (Y-registry.diff).
Registry test on Y's export: 28/28 (vitest-registry-on-Y.txt). Y's closure equals X's.
