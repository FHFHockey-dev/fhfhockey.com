# C7 ticket 22 — pre-push review of seven commits

**Reviewer:** Claude C7 lane session (not the author). Read-only: no `web/` edits, no Git mutations, no `GIT_DIR`, no live reads.
- Tests ran under the outbound network-deny preload.
- I didn't run `tsc`, as instructed; the orchestrator's clean-export run covers it.
- Evidence is in `r22-evidence/`.

| Commit | Verdict |
| --- | --- |
| `1d91cbdd8` WiGO season-guarded STD fallback | **Accept** (L1) |
| `1a84f58d0` docs: WiGO spec pointers | **Accept** |
| `e65c00f02` HIR best-total assignment (my H1–H3) | **Accept** |
| `d5413c688` lint: only the loader imports `validateEvidenceBundle` | **Accept with limits** (L2, L3) |
| `d7f8da538` WiGO percentiles `sanitizePercentileCohortGp` (C-05) | **Accept** (L4) |
| `f4954a79d` GS distinct slice colours | **Accept** |
| `86583ba6b` TG testkit rename, contract test T2, `runProjection.ts`, saved-run preview | **Accept** (L5) |

## Tests fail on the parent, pass on HEAD

For each code commit I built a scratch mirror of `web/`.
- Every top-level entry is symlinked, except the directories the commit touched. Those were copied, with the commit's **source** files reverted to `<commit>^` and its HEAD tests kept.
- Aliases point at the mirror, so both alias and relative imports and mocks resolve to the parent sources.

| Commit | HEAD | Parent | New tests failing on the parent |
| --- | --- | --- | --- |
| `1d91cbdd8` | 43/43 | 41/43 | "fills missing STD counts from totals only when the totals row is the dashboard season"; "clears player and aggregate state while the next player is still loading" |
| `e65c00f02` | 18/18 | 16/18 | "activates as many players as the spots and swap partners allow before maximising gain"; "says only the best can be activated…" (H3 wording) |
| `d7f8da538` | 8/8 | 6/8 | "treats NST GP above the canonical WGO GP as invalid"; "detects a stale cohort even when one contaminated row reports an impossible GP" |
| `f4954a79d` | 20/20 | 19/20 | "gives every goalie a distinct slice colour when the team palette repeats one" |
| `86583ba6b` | 29/29 | preview suite can't load (`../runProjection` absent); contract 9/9 | The new preview tests can't run on the parent. The added contract test T2 **passes on the parent too**, by design: it asserts existing memory-store behaviour. |

`1a84f58d0` (docs) and `d5413c688` (lint config) have no unit tests. I probed the lint rule directly (below).

## Per commit

### `1d91cbdd8` WiGO: `web/utils/fetchWigoPlayerStats.ts:241-246`, `web/hooks/useWigoPlayerDashboard.ts:165-168`

- **Change:** `seasonTotals` is used only when `String(totalsData.season) === String(stdSeasonId)`. That matches the text `"20262027"` against the numeric dashboard season. Otherwise the STD totals fallback is off, so last season's totals can't pose as STD.
- **Query:** the key now includes the season, and the query waits for `currentSeasonId`.
- **Callers:** the only caller of `fetchPlayerAggregatedStats` is this hook.
- **L1 (low):** `enabled` requires `currentSeasonId !== null`, and `currentSeasonId = useCurrentSeason()?.seasonId ?? null` (`:151`). If the season lookup fails or never resolves, the aggregates query **never runs**, so the matrix stays empty instead of showing an error. Consider surfacing the season failure.

### `1a84f58d0` docs

- **Changes:** two pointer edits.
  - `report.md` notes that the spec was deleted in `4436789f1`, which is "WiGO charts: one-page dashboard layout and audit fixes".
  - The PRD line swaps `wigo-single-viewport.spec.ts` for `wigo-one-page.spec.ts`.
- Both referenced paths exist. No code changed.

### `e65c00f02` HIR: `web/lib/rosterScheduleOptimizer/healthyReserves.ts:77-104`, `HealthyReserveAlert.tsx`

- **H1 fixed:** the search is exhaustive over each flagged player's options: an open spot (when any), then each eligible swap partner, then "none".
  - It respects the spot count and one use per partner.
  - It maximises `[activations, projected points (unknown = 0), active games]` lexicographically.
  - On my earlier counter-case (A: spot 10 or swap 9; B: spot 8 only), the best is A-swap plus B-spot, scoring `[2, 17]`, which beats `[1, 10]`. The new test covers that.
- **H2 fixed:** with `better` strictly greater, the first assignment found wins. The search visits players in roster order, so ties favour earlier roster players. The output is then sorted by `byGain` (stable), with unknown gains and unactivated players last.
- **H3 fixed:** if any activated player's gain is fully unknown, the text reads "Can be activated: …" and never "best".
- **Edge cases:**
  - 0 spots with no partners gives every pick `null` and no contest text.
  - The initial best score `[-1,0,0]` guarantees the all-`null` assignment is accepted.
  - Gains are still computed per player in isolation and then summed, as before; combined lineups aren't re-simulated.
  - **Search size:** (options + 1) per flagged player, with no explicit cap. It is small in practice (a few IR slots, and partners limited to IR-eligible actives), but an explicit cap or a comment on the worst case would be prudent.

### `d5413c688` lint: `web/eslint.config.mjs:118-140`

**Probed with stdin-only lints** (no files written; `lint-probe.txt`):

| Import | Flagged |
| --- | --- |
| Relative `./evidenceBundle` | yes |
| Alias `lib/player-cards/evidenceBundle` | yes |
| `../../lib/...` | yes |
| With `.ts` extension | yes |
| Renamed (`as v`) | yes |
| Namespace `import * as eb` | yes |
| `export { … } from` | yes |
| `export * from` | yes |
| Type-only import | **no**, correctly |
| Other named import (`EvidenceBundle` type) | **no**, correctly |
| `evidenceLoader.ts`, `evidenceBundle.test.ts` (ignored) | **no**, correctly |
| `evidenceLoader.test.ts` | yes, but it doesn't import the raw validator, so there are 0 real hits |
| Real tree (`lib/player-cards`) | 0 hits, so nothing legitimate is blocked |

My first two probe runs are kept as `lint-probe-run1/2.txt`. They wrongly showed 0, because my harness used a `--rule` override that errored and ESLint 9's removed `compact` formatter. Those were reviewer errors.

| # | Limit |
| --- | --- |
| **L2** (low) | **Dynamic `import("…/evidenceBundle")` and `require("./evidenceBundle")` are not caught.** `no-restricted-imports` only sees static import and export declarations. If this boundary matters, add a `no-restricted-syntax` selector for `ImportExpression` and `require` calls with that source, or rely on review. |
| **L3** (info) | This block is the config's **only** `no-restricted-imports` entry and applies to every file. In ESLint flat config, a later block's options for the same rule **replace** earlier ones rather than merging. Anyone who later adds another `no-restricted-imports` block for overlapping files will silently drop this restriction unless both are merged into one entry. A comment at the block would prevent that. |

### `d7f8da538` WiGO percentiles: `web/utils/fetchWigoPercentiles.ts:156-180`, `:272-276`

- **Change:** the selected player's NST GP above their canonical WGO GP is clamped to the WGO GP. Any cohort GP above the season's canonical maximum is nulled, which removes it from min-GP filters, TOI/GP and the staleness check. No new reads; it uses the already-fetched canonical rows.
- **L4 (low):** when `canonicalSeasonMaxGp` is `0` (unknown), cohort rows aren't sanitised, so contaminated GPs pass through as before. When `canonicalPlayerGp` is `null`, the selected player's GP falls back to the cohort rule. Clamping to WGO also means that if WGO lags NST by a day, the selected player shows the older GP, which errs conservative.

### `f4954a79d` GS colours: `web/components/GoalieShareChart/index.tsx:238-253`

- **Change:** team palette plus the five fallback colours, de-duplicated case-insensitively, with empty values dropped. Up to 10 distinct colours.
- **Edge cases:**
  - Equivalent forms like `#fff` and `#ffffff` aren't detected as duplicates; that is cosmetic.
  - More than 10 goalies in a window would run out of colours (previously the limit was 5).

### `86583ba6b` TG: `web/lib/forge-testing-grounds/runProjection.ts`, `runStore.ts`, `runnerContracts.ts`, `preview/*`, `runStoreContract.testkit.ts`

- **`runProjection.ts` is browser-safe:**
  - Its imports are `zod` and `import type { RunState } from "./runnerContracts"`, which is erased.
  - No `node:` modules.
  - The preview's import chain is `runProjection`, `operationalProgress` (zod), `dataHealth` (zod plus `../projections/evidenceTime`) and `previewFixtures` (type-only), so it has no Node imports either.
  - `runnerContracts` now imports `RUN_PHASES` from `runProjection`, and `runProjection` imports only a type back, so there is no runtime cycle.
  - `runStore` re-exports `MAX_LISTED_RUNS`, `RUN_EVENTS` and `runProgressSchema`, so existing importers are unchanged.
- **T1 (my nit) closed:** the file is renamed to `runStoreContract.testkit.ts`, with a header saying it's test-only.
- **T2 (my S06 L1) partly closed:** a new contract test, "binds revealed results to their own run, even for identical plans", makes every **store** keep revealed outputs per run. The read adapter still can't verify that binding itself, because the results carry no run id. It is acceptable now that it is a contract obligation.
- **Saved-run preview (`RunHistoryPanel`):** it renders only a listing that passes `z.object({ runs: z.array(runProgressSchema).max(50) }).strict()`, and otherwise shows a fixed alert.
- **L5 (low):** the panel calls `new Date(run.createdAtMs).toISOString()`, but `runProgressSchema` allows `createdAtMs` up to `Number.MAX_SAFE_INTEGER` (about 9.0e15). `Date` caps at 8.64e15, so a validated but absurd timestamp would throw a `RangeError` during render. Cap `createdAtMs` in the schema, or format defensively.
