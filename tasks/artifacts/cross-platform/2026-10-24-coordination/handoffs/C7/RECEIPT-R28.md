# C7 ticket 28 — review of the 4 local commits since `a553d5b72`

**Reviewer:** Claude C7 lane session (not the author). Read-only: no `web/` edits, no Git mutations, no `GIT_DIR`, no live reads, no `tsc`.
- Unit tests ran under the outbound network-deny preload, against a clean `git archive HEAD` snapshot at `/private/tmp/c7-r28` (HEAD `f633654d5`).
- Evidence is in `r28-evidence/`.

| Commit | Verdict |
| --- | --- |
| `7d2df2ba9` C3-5: in-loop rejected batch gives 500 (test) | **Accept** |
| `76748c62f` WiGO-6: stop reading `wigo_rates` | **Accept** |
| `ca7818dd2` TG-4: manifest from the validated plan | **Accept** |
| `f633654d5` PC-4: studio evidence status line | **Accept with limits** (P1, P2) |

## Tests: fail on the parent or under mutation

| Commit | HEAD | Parent or mutation |
| --- | --- | --- |
| `7d2df2ba9` (test-only) | 38/38 | **Mutation:** with the route's in-loop `writeErrors.push` removed in a scratch copy, **37/38**. Only the new "fails the run when an in-loop 200-player batch upsert is rejected…" fails, so the test is mutation-meaningful. |
| `76748c62f` | 30/30 | Parent: 29/30. The new "reads wigo_career, wigo_recent and season totals but never the writerless wigo_rates table" fails. |
| `ca7818dd2` | 47/47 | Parent: 46/47. The extended ownerRoutes test with the manifest read fails. |
| `f633654d5` | 8/8 | Parent: the suite can't load (`./evidenceVerdictCopy` absent), so every new test fails. |

## `7d2df2ba9` C3-5: `web/__tests__/pages/api/v1/db/calculate-wigo-stats.test.ts`

- **Setup:** 250 players with a batch size of 200. The **first** (in-loop) `wigo_recent` upsert is rejected, and the final batch of 50 writes.
- **It asserts:**
  - 500, with `writeErrors` exactly `["wigo_recent: synthetic batch failure"]`;
  - two upserts;
  - the written ids are exactly players 201–250, so later batches still write.
- The mutation run above proves it guards the in-loop path, which my R21 receipt could only reason about. Test-only; the route is unchanged.

## `76748c62f` WiGO-6: `web/utils/fetchWigoPlayerStats.ts:627-691`

- **Change:** `fetchPlayerAggregatedStats` reads `wigo_career`, `wigo_recent` and `wgo_skater_stats_totals` (the new test asserts exactly those three tables) and passes `ratesData: null`.
- **No dependants:**
  - `ratesData` is consumed only inside `buildPlayerAggregatedStats` (`:272-292`), where a non-null value could **override** the STD, LY, CA and 3YA per-60 values from `wigo_career`.
  - With `null`, those per-60 values come from `wigo_career`, and recent per-60 values from `wigo_recent`. That is exactly what happened already for any player with no `wigo_rates` row (`maybeSingle()` returned `null`).
  - **No code writes `wigo_rates`.** A repo-wide grep of `web`, `functions`, `webhooks`, `scripts`, `sql` and `migrations` finds only the schema baseline, grant migrations, an e2e `schema.json`, a stale `.next-codex-reconcile/` copy, and this reader and its test.
  - So per-60 sources are unchanged in practice, and the latent override risk is removed.
- **Note (info):** `buildPlayerAggregatedStats` still accepts `ratesData` and keeps the override branch for its existing unit tests. That is harmless, since the only caller passes `null`.

## `ca7818dd2` TG-4: `web/lib/forge-testing-grounds/runStore.ts` (`readOperational`), `memoryRunStore.ts`, testkit

- **How a manifest is answered:**
  - It reads the run's validated projection first, which gives the owner scope and `planHash`.
  - It calls `store.manifest`.
  - It re-parses the result with the strict `parsePlan` and requires `contentHash(plan) === planHash`.
  - Otherwise it returns `invalid_projection`.
  - It returns `{ runId, planHash, plan }`, and the plan holds configuration references only, no outputs.
- **Scope:** health, logs and export still fail closed. It is offline: the memory store returns the plan frozen at acceptance. The testkit adds a manifest contract test for every store.
- **My M1** (`c7/r28Manifest.test.ts`, real memory store plus adapter):

  | Case | Result |
  | --- | --- |
  | Genuine plan | returned, `planHash` matches |
  | **Tampered** plan (changed candidate hash) | `invalid_projection` |
  | Plan with an **extra field** | `invalid_projection` (strict parse) |
  | **Another run's plan** returned for this run | `invalid_projection` (hash binding) |
  | **Another owner** | `run_not_found` |

  Validates, never fabricates, stays offline.

## `f633654d5` PC-4: `web/lib/player-cards/evidenceVerdictCopy.ts`, `pages/social-share/player-cards.tsx`, `cardEvidenceVerdict.test.ts`

- **Rendering:** the page renders `<p role="status" data-evidence-state={state}>` with fixed `{title, detail}` chosen **only** by `state`, inside `SocialShareAccessGate`. An unknown state falls back to the "rejected" copy. The test renders the page from real `getServerSideProps` and asserts the HTML contains the fixed copy and none of the issue codes.
- **C1 lint and boundary still hold:**
  - `evidenceVerdictCopy.ts` imports nothing; it mirrors the state union.
  - ESLint on `lib/player-cards` and the page: exit 0.
  - The boundary guard test passes: the page is still the only importer of `cardEvidenceVerdict`, and `components/` imports no evidence module.
  - My first attempt at re-running the guard and render tests used a minimal config that lacked the `components/` alias and React plugin the render test's mocks need. That was a reviewer error; the full-config run is the one in the table (8/8).

| # | Severity | Finding |
| --- | --- | --- |
| **P1** | Clarification | **Codes reach the client as page data, not as rendered text.** `getServerSideProps` still returns the full `EvidenceVerdict` (`state`, per-metric `state`, `issueCodes`, flags), so `issueCodes` are in `__NEXT_DATA__` for every request. The status line doesn't render them. That is the shape accepted in R25: code-defined kebab enums with no ids or reasons. If the requirement is strictly "no codes reach the client", reduce the prop to `{ state }` now that the page renders only the state copy. |
| **P2** | Low | **The "incomplete" copy is preview-specific.** It reads "Fabricated preview, no admitted evidence. Ranks are illustrative." That is true for today's only caller (the studio's fabricated preview), but `evidenceStatusCopy` is a shared helper. A future real bundle that is incomplete for another reason (e.g. missing finality) would wrongly say "Fabricated preview". Pass the context in, or word it neutrally ("Not all evidence is admitted"). |
| **P3** | Info | The page is unstyled and not browser-checked (the commit says so). The status line renders after the studio inside the gate, so signed-out or no-role visitors don't see it, though they still receive the prop (P1). |
