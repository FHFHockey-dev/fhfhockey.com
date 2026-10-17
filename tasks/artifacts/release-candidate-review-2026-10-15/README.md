# Proposed incremental release candidate — 2026-10-15

Ten increments have bounded independent local acceptance. The proposed bundle is exactly **38 current files (25 modifications, 13 additions) plus 3 deletions**, based on octoberBranch HEAD `a8f58de6178e282acd3a71851c66f4a56b119f14`. No application source was edited by this reviewer; nothing was staged, committed, merged, pushed or deployed.

- `proposed-release-manifest.json`: exact file actions, HEAD/current SHA-256, increment ownership, compiler result and gates.
- `proposed-release.patch`: complete replayable 41-path source/test patch. Independently applied in memory to HEAD; every resulting byte/deletion matches the manifest/current source.
- `proposed-release-files.sha256` and `proposed-release-deletions.json`: simple inclusion lists.
- `integration-verification.json`: patch/base/current comparison, collision and preservation observations.
- `full-tree-typecheck-receipt.json` / log: one coordinated 8GB no-emit TypeScript pass, exit 0, 50.358 seconds, no diagnostics and no candidate drift.

## Accepted versus pending evidence

| Increment | Independent disposition | Retained verification | Report |
| --- | --- | --- | --- |
| RSO waiver timestamp | ACCEPT, existing acceptance rechecked | 39 affected tests, including 6 new; scoped lint/diff | accepted-increments-review-history.md |
| DFOFantasy/NHL_Rosters receivers | ACCEPT, existing acceptance rechecked | 34 tests; scoped lint/types | accepted-increments-review-history.md |
| Compact initial resolver | ACCEPT, existing acceptance rechecked | 26 new + 135 existing; focused types | accepted-increments-review-history.md |
| Reset-password state | ACCEPT, existing acceptance rechecked | 11 tests; scoped lint/diff | accepted-increments-review-history.md |
| API test relocation | ACCEPT, existing acceptance rechecked | 11 before/after; discovery, route map, lint | accepted-increments-review-history.md |
| Public-page usability | ACCEPT for exact local increment | Historical 17 tests, scoped lint/types, 9 synthetic browser scenarios; original raw /tmp files now unavailable | public-page-independent-review.md |
| Game-page recovery | ACCEPT for exact local increment | Historical 18 mocked tests, scoped lint/diff; author reconfirmed freeze; raw /tmp files unavailable | game-page-independent-review.md |
| Admin Host bypass | ACCEPT for direct non-loopback Host-spoof boundary | 93 tests, scoped lint/types; local-relay limitation explicit | admin-bypass-independent-review.md |
| SSRF proxy | ACCEPT for exact four-file boundary | 130 tests, scoped lint/types; live compatibility and rate-limit guarantees unclaimed | ssrf-independent-review.md |
| Combined radar scope/direction | ACCEPT for exact four-file increment | 59 tests, scoped types/lint (1 unchanged img warning) | ../radar-scope-integration-2026-10-15/independent-review.md |

The only fresh aggregate execution was TypeScript 5.7.3 under Node 22.11.0 with 8GB heap, no emit/incremental output. Accepted tests were reused because their file hashes did not change. Application build was not run: Next page generation can execute service reads. No local/production browser/account, provider/DNS/network/DB operation was performed by this review.

## Integration and exclusions

No overlapping file ownership or source collision among the ten included increments. Three test moves are explicit additions/deletions; no test modules remain under pages/ in the inspected file glob. Compact-initial's approved playerIdentity hash supersedes the older IFTTT preservation pin; other parser observations are in integration-verification.json. The older 24-file RSO cohort still matches all retained hashes but is **not automatically included** in this additional bundle. All other dirty FORGE, parser, RSO, NST, billing, task and unrelated changes remain outside the proposed inclusion set.

The full-tree compiler result applies to the current checkout, which contains preserved unrelated changes. It is not evidence that an isolated HEAD-plus-this-patch tree has completed its own build/runtime acceptance. The bundle is a concrete proposal for selection; no resulting release commit SHA exists yet.

## Remaining gates

1. Select/approve this exact incremental file set and reconcile the intended final release tree. Do not blanket-stage the working tree. Preserve unrelated work. Validate the eventual isolated commit/tree before release.
2. Complete any required application build/SSR/hydration validation with bounded offline inputs or explicit service-read authorization; no build success is claimed.
3. Preserve human/provider/account acceptance gates: RSO authentic rules/availability/nonzero continuity/protected account backup/save/restore/concurrency/entitlements, qualified original-issued forecasts, and authentic natural IFTTT delivery with configured secret binding presence. Do not infer those from mocked tests or setup credentials here.
4. Any release needs explicit target project/environment/branch/exact candidate commit approval, deployment-trigger inventory and bounded smoke budget under AGENTS.md. No remote release action is authorized by this proposal.
5. Historical /tmp evidence loss is disclosed. Exact public-page patch was cryptographically recovered; the game patch is labeled reconstructed. No historical test/browser evidence was fabricated or rerun to conceal missing originals.

## Coordination

RSO and combined radar owners confirmed frozen application/test files and no competing compiler/build; admin/SSRF authors were idle with completed scoped checks. OS process-list probing was unavailable (sysmond missing), so concurrency is based on coordinator reservation and owner attestations. Reviewer compiler session completed; no reviewer-owned process remains.

Before Scout's new old-chat speed rule arrived, two older authors were resumed solely to check artifact availability. They returned idle without source edits or reruns; their actual settings were not exposed or inferred. No new agents/review tasks were spawned. See coordination-boundaries.md for exact thread IDs. No further old chat was restarted.
