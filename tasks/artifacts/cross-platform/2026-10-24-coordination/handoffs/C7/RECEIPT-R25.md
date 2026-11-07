# C7 ticket 25 — review of `bd71843dc` (PC WIRING-1 applied) and `97ab3f03c` (WiGO A-03 "N of M games")

**Reviewer:** Claude C7 lane session (not the author). Read-only: no `web/` edits, no Git mutations, no `GIT_DIR`, no live reads. Tests ran under the outbound network-deny preload, against a clean `git archive HEAD` snapshot at `/private/tmp/c7-r25` (HEAD `97ab3f03c`). Evidence is in `r25-evidence/`.

| Commit | Verdict |
| --- | --- |
| `bd71843dc` Player cards: first evidence wiring | **Accept** (L3 build check still open) |
| `97ab3f03c` WiGO team drivers: "N of M games" at 90% | **Accept** |

## `bd71843dc`: `web/lib/player-cards/cardEvidenceVerdict.ts`, `pages/social-share/player-cards.tsx`, `cardEvidenceVerdict.test.ts`

**My R23 findings:**
- **L1 (fixed):** `EvidenceVerdict` is now `{ state, metrics: Record<MetricId, State>, issueCodes: string[], liveActivation: false, premiumActivation: false }` (`cardEvidenceVerdict.ts:13-16`).
  - Reason text, the bundle id, receipts, the card, values and ranks are gone.
  - `issueCodes` are deduplicated, sorted and filtered to code-defined kebab-case (`CODE`, `:19`), so free text can't pass.
  - **My rerun of R23 K1** (`c7/r25Leak.test.ts`) used a bundle whose population and definition references carry `c7-internal/receipt-path.json#x` and `c7-internal/def.json#y`, with bundle id `c7-secret-bundle-id`. None of those strings, nor `sha256` or `reasons`, appear in the verdict JSON.
  - `getServerSideProps` returns exactly the five keys.
  - The probe's only hit was my over-broad search term "receipt", which matches the coded enum `receipt-not-retained`, not leaked data (`r25-leak.json`). That was a reviewer error in the probe wording.
- **L2 (fixed):** the guard test's `loads(name)` regex (`cardEvidenceVerdict.test.ts:25-27`) now matches static `from`, dynamic `import()` and `require()`, including template strings and `.ts`/`.tsx` extensions. A self-test asserts all four forms.
  - Boundaries: only the loader names `validateEvidenceBundle`; only `cardEvidenceVerdict.ts` loads `evidenceLoader`; only the page loads `cardEvidenceVerdict`; no `components/` file loads any evidence module.
  - Together with `dffd3b2d0` (lint for dynamic or `require` access to `evidenceBundle`), the raw-validator and loader boundaries are covered statically and by test.
- **L4 (fixed):** the out-of-lease page test was dropped. Its assertions moved into `cardEvidenceVerdict.test.ts`, which imports `getServerSideProps`.
- **L3 (still open, as the commit says):** a local `next build` is still needed to confirm `node:fs` and `evidenceLoader` are absent from the page's client chunk.

**Fail-closed and boundary (unchanged from R23, re-read):**
- It always loads through the server-fixed root and `validateAdmittedEvidence`; there is no caller root or evidence parameter.
- An absent root gives `retained-file-missing`, so the verdict is incomplete (my R23 K3).
- The studio fixture's self-asserted proof gives `incomplete` with all four `*-missing` codes.

**Tests:**
- **HEAD 6/6.**
- **Parent (`cc4886a81`):** the suite can't load (`./cardEvidenceVerdict` absent). The module is new, so every test in it fails on the parent.

## `97ab3f03c`: `web/components/WiGO/teamPerformanceDriverModel.ts:1-115, :301-303`, `fetchTeamDriverSnapshots.ts`, `TeamPerformanceDrivers.tsx:12-13, :92-102`

- **Rule:** `meetsCoverage = expectedGames > 0 && covered / expected >= 0.9` (`:22-23`). A team at or above 90% renders with "N of M games to {date}" and the note "Partial coverage: rates use covered games only". Below 90% it stays incomplete. At exactly 100%, `partialCoverage` returns `null`, so the display is unchanged and there's no label (`:301-303`).
- **Missing is never zero:**
  - **5v5:** only expected dates count. A row whose `gp` doesn't match the expected count, or whose metric is null, non-finite or negative, is **dropped as missing**. `gp` = covered games, and xGF, xGA and GF are summed over covered rows only, so per-GP rates divide by the covered count.
  - **Special teams:** only rows for **expected** regular-season game ids are passed in (`fetchTeamDriverSnapshots.ts`, `regularRows`). Unusable counts are dropped. PP% and PK% are ratios of summed counts over covered games, and every team has an expected count, so coverage can't exceed 100%.
- **Threshold edges** (`c7/r25Coverage.test.ts`, E1; `r25-coverage.json`):

  | Case | 5v5 | Special teams |
  | --- | --- | --- |
  | Every M from 10 to 820 (step 10), exactly 90% | shown | shown |
  | One game fewer than 90% | hidden | hidden |
  | **899 / 1000 (89.9%)** | hidden | hidden |
  | **900 / 1000 (90.0%)** | shown | shown |
  | **82 / 82 (100%)** | complete, no label | complete, no label |
  | **M = 0** | hidden | hidden |

  There are no floating-point misses at exactly 90%.
- **Covered-only rates** (E2):
  - 18 of 20 games gives `gp = 18`, and xGF/GP equals the mean over the 18 covered games.
  - PP% = 9 / 54 over covered opportunities.
  - One row with `xgf: null` among 10 gives `gp = 9` and xGF = 27: dropped, **not** counted as 0.
- **Fixtures:** the e2e fixture adds a `teamGameGaps` option that removes the fictional team's first N team-game rows. Team ids and abbreviations are public; there is no player data.
- **Tests:**
  - **HEAD 35/35** (the owner's 33 plus my 2).
  - **Parent (`bd71843dc`): 21/33, with 12 failures:** the coverage-label component test, two `fetchTeamDriverSnapshots` tests and nine model tests, including "keeps 9 of 10 games and computes rates over the covered games only" and "treats an unusable row as a missing game, not a zero".

**Note (info):** percentiles now compare a team at 90–99% coverage with complete teams, on per-covered-game rates. That is correct for rates, and the card discloses the partial coverage. "N of M games to {date}" uses the latest *covered* date, which can be earlier than the cutoff when the last game is the missing one; that is accurate as worded.
