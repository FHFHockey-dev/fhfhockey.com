# Side-branch salvage report

Frozen committed target: `octoberBranch=8a6ac8adccee73fae8e07045c86b374ce8c98008`. Captured 2026-10-19T22:48:46.368412+00:00. Local, read-only Git inspection; only P4 report/evidence files written. No patch applied, refs changed, test/route/provider/hosted request made.

## Findings and owner decisions

| Requested commit | Actual commit subject | Content verdict | Whole patch forward / reverse | Decision |
| --- | --- | --- | --- | --- | --- |
| `9592e2e6c023cbfb665ba5b4674ff9c366c7637a` | Explain retained native diagnostic incompatibility without bypassing validation | **ABSENT** | FAIL 1 / FAIL 1 | ABSENT adapter compatibility fix; both loader and test files absent. Patch requires its parent diagnostic implementation, so not independently applicable. Claude/TJ only. |
| `894fe7eabe8925806d808a76a507a66c4daed05c` | Keep Starter Board scoring and source evidence truthful | **PARTIAL** | FAIL 1 / FAIL 1 | PARTIAL; scoring/source truthfulness work remains missing or rewritten, and current source has newer admission/expiry semantics. Whole patch conflicts. Claude/TJ only. |
| `8b6332d4e0dfeee75baad010b7383624a41b2e85` | Add versioned local physical shift interval grouping candidate | **PARTIAL** | FAIL 1 / FAIL 1 | PARTIAL literal test overlap; both actual grouping modules absent, and grouping-specific test additions missing. New modules forward-check individually; test hunk conflicts. Claude/TJ FORGE proposal only. |
| `2331cc1ba64eaf202223941f29b33793f47571c9` | Add schedule-only social share studio with PNG exports | **PARTIAL** | FAIL 1 / FAIL 1 | PARTIAL; social studio/export/fonts mostly retained, shared source adapters and docs differ. Several differences are intentional local compatibility/scope repairs. Do not restore old shared changes wholesale. |
| `76d507ea84634a91a69f61648d0a58e85e76571b` | Keep approved preseason shift defects from blocking scheduled work | **PARTIAL** | FAIL 1 / FAIL 1 | PARTIAL FORGE ingestion/shift exception patch; not draft/WiGO. Exception helper and regression file absent; route changes conflict. Owner must correct attribution before deciding any integration. |

The request says six side-branch commits but supplies five distinct resolvable hashes plus five missing hashes. Rows 7/8 and 72/81 each repeat one commit. All ten distinct named hashes are covered. `76d507e` resolves unambiguously to preseason FORGE work (`76d507ea84...` shown in full above); it provides no evidence for draft recovery, WiGO timeframe, or chevron integration. No substitute draft/WiGO hash is inferred.

## Method and limits

- `git show --stat --oneline <sha>` and `git diff-tree --no-commit-id --name-only -r <sha>` enumerate every touched file; full immutable source patch text is retained in the five `P4-<requested>.patch.txt` files. Binary font bodies are represented by blob IDs and byte equality rather than copied binary data.
- Compare `git show <sha>:<path>` and each `git show <sha> -- <path>` addition against `git show 8a6ac8adc:<path>`. Every touched path in the live checkout was equal to those committed target bytes, including matching absence, at dry-run time. This byte check makes the working-tree apply checks valid for the frozen target without changing an index or constructing a worktree.
- Dry runs: `git show --format= --binary --no-ext-diff <sha> | git apply --check` and the same with `--reverse`, both whole commit and `-- <path>` per file. Exit 0 = PASS; exit 1 = FAIL. All raw diagnostics and per-file hashes are in `P4-EVIDENCE.json`. None of the whole patches is cleanly applicable in either direction.
- “Exact added lines” counts literal line presence anywhere in that file, including blank/brace/import repetitions. It is an upper bound on literal presence, **not an integration percentage** or functional equivalence. FULLY-PRESENT means all source additions are retained (or reverse-check passes); PARTIAL can include generic overlap and changed contexts. Added-file byte equality and reverse checks provide stronger evidence. Deletions/context are preserved in patch evidence; failed reverse alone does not prove missing behavior.
- For each non-complete file below, every source hunk is listed with exact missing addition line ranges in the source commit. The JSON records every added line and its presence flag, providing the complete missing text. Where all lines exist individually but reverse fails, context/deletion differences still require review.
- The current dirty tree belongs to other owners and is separate from the committed target. Its snapshot is retained; only the selected touched paths were used for applicability. No tests, TypeScript, lint, build, or production validation is needed or claimed for this report.

## Per-commit file and hunk ledger

### `9592e2e6` — Explain retained native diagnostic incompatibility without bypassing validation

Full SHA `9592e2e6c023cbfb665ba5b4674ff9c366c7637a`; `git merge-base --is-ancestor <sha> 8a6ac8adc` exit 1 (not ancestor). Evidence: `P4-9592e2e6.patch.txt` and `P4-EVIDENCE.json`.

| File | Exists in target | Exact added lines present | Content | Forward / reverse |
| --- | --- | --- | --- | --- |
| `web/lib/forecast-diagnostics/loader.test.ts` | no | 0/24 | ABSENT | FAIL 1 / FAIL 1 |
| `web/lib/forecast-diagnostics/loader.ts` | no | 0/8 | ABSENT | FAIL 1 / FAIL 1 |

Whole-patch diagnostics:
```text
forward: error: web/lib/forecast-diagnostics/loader.test.ts: No such file or directory
error: web/lib/forecast-diagnostics/loader.ts: No such file or directory
reverse: error: web/lib/forecast-diagnostics/loader.ts: No such file or directory
error: web/lib/forecast-diagnostics/loader.test.ts: No such file or directory
```

**`web/lib/forecast-diagnostics/loader.test.ts` — missing/context ledger**

- `@@ -1,5 +1,8 @@`: missing source addition lines **3–5** (3/3 additions). First missing: `import { mkdtempSync, rmSync, writeFileSync } from "node:fs";`.
- `@@ -10,6 +13,7 @@ import { forecastDiagnosticsJson, forecastDiagnosticsMarkdown } from "./contract`: missing source addition lines **16** (1/1 additions). First missing: `import * as frozenPairRunner from "./frozenPairRunner";`.
- `@@ -92,6 +96,26 @@ describe("read-only diagnostic evidence loader", () => {`: missing source addition lines **99–118** (20/20 additions). First missing: `it.each([false, true])("keeps native verification failures unavailable before returning stored reports (systems=%s)", async includeSystems => {`.

**`web/lib/forecast-diagnostics/loader.ts` — missing/context ledger**

- `@@ -51,7 +51,14 @@ export async function loadLocalFrozenPairDiagnostics(directory: string, query: {`: missing source addition lines **54–61** (8/8 additions). First missing: `let derived: ForecastDiagnosticsReport;`.

### `894fe7ea` — Keep Starter Board scoring and source evidence truthful

Full SHA `894fe7eabe8925806d808a76a507a66c4daed05c`; `git merge-base --is-ancestor <sha> 8a6ac8adc` exit 1 (not ancestor). Evidence: `P4-894fe7ea.patch.txt` and `P4-EVIDENCE.json`.

| File | Exists in target | Exact added lines present | Content | Forward / reverse |
| --- | --- | --- | --- | --- |
| `web/__tests__/pages/start-chart.test.tsx` | yes | 26/92 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/e2e/start-chart.spec.ts` | yes | 0/28 | PARTIAL | PASS 0 / FAIL 1 |
| `web/pages/start-chart.tsx` | yes | 2/55 | PARTIAL | FAIL 1 / FAIL 1 |

Whole-patch diagnostics:
```text
forward: error: patch failed: web/__tests__/pages/start-chart.test.tsx:1
error: web/__tests__/pages/start-chart.test.tsx: patch does not apply
error: patch failed: web/pages/start-chart.tsx:354
error: web/pages/start-chart.tsx: patch does not apply
reverse: error: patch failed: web/pages/start-chart.tsx:354
error: web/pages/start-chart.tsx: patch does not apply
error: patch failed: web/e2e/start-chart.spec.ts:1
error: web/e2e/start-chart.spec.ts: patch does not apply
error: patch failed: web/__tests__/pages/start-chart.test.tsx:1
error: web/__tests__/pages/start-chart.test.tsx: patch does not apply
```

**`web/__tests__/pages/start-chart.test.tsx` — missing/context ledger**

- `@@ -1,8 +1,9 @@`: missing source addition lines **3, 6** (2/2 additions). First missing: `import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";`.
- `@@ -1020,6 +1021,8 @@ describe("StartChartPage", () => {`: missing source addition lines **1024–1025** (2/2 additions). First missing: `expect(screen.queryAllByText("No players match this position and filter set.")).toHaveLength(0);`.
- `@@ -1048,6 +1051,94 @@ describe("StartChartPage", () => {`: missing source addition lines **1054–1055, 1058–1060, 1062, 1070–1084, 1086–1092, 1094–1097, 1099, 1101, 1103–1104, 1106, 1109–1113, 1115–1117, 1120–1124, 1126–1130, 1133–1134, 1136–1137, 1139–1141** (62/88 additions). First missing: `expect(screen.getByText("No C projections available for this slate.")).toBeTruthy();`.

**`web/e2e/start-chart.spec.ts` — missing/context ledger**

- `@@ -1,7 +1,7 @@`: missing source addition lines **4** (1/1 additions). First missing: `import { boardGoalieForecast, parseBoardScoringRequest } from "../lib/projections/starterBoardScoring";`.
- `@@ -452,6 +452,8 @@ test.describe("/start-chart", () => {`: missing source addition lines **455–456** (2/2 additions). First missing: `await expect(page.getByText("No C projections available for this slate.")).toBeAttached();`.
- `@@ -466,6 +468,7 @@ test.describe("/start-chart", () => {`: missing source addition lines **471** (1/1 additions). First missing: `await expect(page.getByText("No players match this position and filter set.")).toHaveCount(0);`.
- `@@ -685,6 +688,10 @@ test.describe("/start-chart", () => {`: missing source addition lines **691–694** (4/4 additions). First missing: `const participatingSkater = skater(3, 1, 4);`.
- `@@ -692,8 +699,11 @@ test.describe("/start-chart", () => {`: missing source addition lines **702–706** (5/5 additions). First missing: `decisionAsOf: "2026-02-07T15:00:00Z", publishedAt: "2026-02-07T16:00:00Z", codeVersion: "fixture-code-v1" }],`.
- `@@ -710,25 +720,40 @@ test.describe("/start-chart", () => {`: missing source addition lines **723–730, 733, 737, 744–745, 752–753, 756** (15/15 additions). First missing: `await expect(cPanel.locator("ol > li").first()).toContainText("4.10");`.

**`web/pages/start-chart.tsx` — missing/context ledger**

- `@@ -354,7 +354,7 @@ export default function StartChartPage() {`: missing source addition lines **357** (1/1 additions). First missing: `const [selectedScoring, setScoring] = useState<BoardScoringRequest>(() => parseBoardScoringRequest({}));`.
- `@@ -414,12 +414,23 @@ export default function StartChartPage() {`: missing source addition lines **417–418, 422–431** (12/14 additions). First missing: `const scoring = !scoringTouched && publishedData?.scoringProfile`.
- `@@ -479,12 +490,6 @@ export default function StartChartPage() {`: deletion/context-only hunk; inspect retained patch and apply diagnostics.
- `@@ -495,15 +500,13 @@ export default function StartChartPage() {`: missing source addition lines **503, 509** (2/2 additions). First missing: `const passesGame = selectedGameId == null || player.game_id === selectedGameId;`.
- `@@ -533,7 +536,9 @@ export default function StartChartPage() {`: missing source addition lines **539–541** (3/3 additions). First missing: `const score = scoring.mode === "categories" ? player.boardScore?.categoryValue`.
- `@@ -553,7 +558,7 @@ export default function StartChartPage() {`: missing source addition lines **561** (1/1 additions). First missing: `}, [filteredPlayers, scoring.mode, scoring.goalieSort, scoringTouched, data?.contractVersion]);`.
- `@@ -651,9 +656,10 @@ export default function StartChartPage() {`: missing source addition lines **659–662** (4/4 additions). First missing: `const fantasyScoringDescription = scoringTouched || data?.contractVersion === 2`.
- `@@ -705,18 +711,18 @@ export default function StartChartPage() {`: missing source addition lines **714, 719, 725** (3/3 additions). First missing: `<div><dt>Scoring</dt><dd title={fantasyScoringDescription}>{scoringTouched || data?.contractVersion === 2 ? scoring.mode === "categories" ? "Category `.
- `@@ -762,7 +768,7 @@ export default function StartChartPage() {`: missing source addition lines **771** (1/1 additions). First missing: `<strong>{error ? "Last successful publication · refresh failed" : data.newsStatus?.available === false ? "News freshness unavailable" : data.newsStatu`.
- `@@ -895,7 +901,7 @@ export default function StartChartPage() {`: missing source addition lines **904** (1/1 additions). First missing: `<form key={JSON.stringify(scoring.profile)} onSubmit={(event) => {`.
- `@@ -906,9 +912,9 @@ export default function StartChartPage() {`: missing source addition lines **915, 917** (2/2 additions). First missing: `{Object.keys(DEFAULT_BOARD_SCORING[population]).map((key) => <label key={key}>`.
- `@@ -1030,12 +1036,17 @@ export default function StartChartPage() {`: missing source addition lines **1039–1042, 1048–1049** (6/6 additions). First missing: `{data?.serving.mode === "no_games" ? "No scheduled games."`.
- `@@ -1067,7 +1078,8 @@ export default function StartChartPage() {`: missing source addition lines **1081–1082** (2/2 additions). First missing: `<li className={styles.card} key={${position}-${player.row_key}}`.
- `@@ -1083,7 +1095,7 @@ export default function StartChartPage() {`: missing source addition lines **1098** (1/1 additions). First missing: `<span>{scoring.mode === "categories" ? ${scoring.category?.replaceAll("_", " ") ?? "Category"}${player.forecast?.conditioning === "conditional_playing`.
- `@@ -1110,7 +1122,7 @@ export default function StartChartPage() {`: missing source addition lines **1125** (1/1 additions). First missing: `{position !== "G" && player.forecast?.participationProbability === 0 && player.forecast.probabilityStatus === "confirmed_evidence" ? <span>Confirmed o`.
- `@@ -1118,6 +1130,13 @@ export default function StartChartPage() {`: missing source addition lines **1133–1139** (7/7 additions). First missing: `{data?.contractVersion === 2 ? <p>`.
- `@@ -1152,7 +1171,7 @@ export default function StartChartPage() {`: missing source addition lines **1174** (1/1 additions). First missing: `: player.forecast.participationProbability === 0 && player.forecast.probabilityStatus === "confirmed_evidence" ? "Confirmed out"`.
- `@@ -1404,6 +1423,11 @@ export default function StartChartPage() {`: missing source addition lines **1426–1430** (5/5 additions). First missing: `<p>{data.coverage.renderedRows}/{data.coverage.projectionRows} projection rows · {data.coverage.slateGames} slate games · {data.gameRevisions?.length `.

### `8b6332` — Add versioned local physical shift interval grouping candidate

Full SHA `8b6332d4e0dfeee75baad010b7383624a41b2e85`; `git merge-base --is-ancestor <sha> 8a6ac8adc` exit 1 (not ancestor). Evidence: `P4-8b6332.patch.txt` and `P4-EVIDENCE.json`.

| File | Exists in target | Exact added lines present | Content | Forward / reverse |
| --- | --- | --- | --- | --- |
| `web/lib/projections/ingest/physicalShiftIntervalAssessment.ts` | no | 0/38 | ABSENT | PASS 0 / FAIL 1 |
| `web/lib/projections/ingest/physicalShiftIntervals.ts` | no | 0/93 | ABSENT | PASS 0 / FAIL 1 |
| `web/lib/projections/ingest/shifts.test.ts` | yes | 15/82 | PARTIAL | FAIL 1 / FAIL 1 |

Whole-patch diagnostics:
```text
forward: error: patch failed: web/lib/projections/ingest/shifts.test.ts:33
error: web/lib/projections/ingest/shifts.test.ts: patch does not apply
reverse: error: patch failed: web/lib/projections/ingest/shifts.test.ts:33
error: web/lib/projections/ingest/shifts.test.ts: patch does not apply
error: web/lib/projections/ingest/physicalShiftIntervals.ts: No such file or directory
error: web/lib/projections/ingest/physicalShiftIntervalAssessment.ts: No such file or directory
```

**`web/lib/projections/ingest/physicalShiftIntervalAssessment.ts` — missing/context ledger**

- `@@ -0,0 +1,38 @@`: missing source addition lines **1–38** (38/38 additions). First missing: `import { sha256CanonicalJson } from "../materializationFingerprint";`.

**`web/lib/projections/ingest/physicalShiftIntervals.ts` — missing/context ledger**

- `@@ -0,0 +1,93 @@`: missing source addition lines **1–93** (93/93 additions). First missing: `import { sha256CanonicalJson } from "../materializationFingerprint";`.

**`web/lib/projections/ingest/shifts.test.ts` — missing/context ledger**

- `@@ -33,9 +33,91 @@ import {`: missing source addition lines **36–37, 41–44, 46–62, 65–73, 76–82, 85–88, 92–108, 111–117** (67/82 additions). First missing: `import { groupPhysicalShiftIntervals, PHYSICAL_SHIFT_GROUPING_VERSION } from "./physicalShiftIntervals";`.

### `2331cc1` — Add schedule-only social share studio with PNG exports

Full SHA `2331cc1ba64eaf202223941f29b33793f47571c9`; `git merge-base --is-ancestor <sha> 8a6ac8adc` exit 1 (not ancestor). Evidence: `P4-2331cc1.patch.txt` and `P4-EVIDENCE.json`.

| File | Exists in target | Exact added lines present | Content | Forward / reverse |
| --- | --- | --- | --- | --- |
| `tasks/TASKS/rules/fhfh-styles.md` | yes | 2/8 | PARTIAL | PASS 0 / FAIL 1 |
| `tasks/prd-social-share-tools.md` | no | 0/45 | ABSENT | PASS 0 / FAIL 1 |
| `tasks/tasks-prd-social-share-tools.md` | no | 0/74 | ABSENT | PASS 0 / FAIL 1 |
| `web/__tests__/seo.test.ts` | yes | 0/2 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/components/GameGrid/GameGrid.tsx` | yes | 1/7 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/components/GameGrid/utils/calcWinOdds.test.js` | yes | 9/58 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/components/GameGrid/utils/calcWinOdds.ts` | yes | 3/6 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/components/SocialShare/SocialShare.module.scss` | yes | 89/107 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/components/SocialShare/SocialShare.tsx` | yes | 176/180 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/e2e/social-share.spec.ts` | yes | 254/256 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/lib/NHL/server/index.test.ts` | yes | 1/7 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/lib/NHL/server/index.ts` | yes | 2/19 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/lib/NHL/types.ts` | yes | 1/7 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/lib/seo.js` | yes | 1/1 | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/lib/socialShare/export.ts` | yes | 68/68 | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/lib/socialShare/schedule.test.ts` | yes | 112/113 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/lib/socialShare/schedule.ts` | yes | 135/144 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/lib/socialShare/server.ts` | yes | 26/26 | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/lib/socialShare/types.ts` | yes | 68/68 | FULLY-PRESENT | FAIL 1 / FAIL 1 |
| `web/pages/api/v1/social-share/[format].ts` | yes | 18/18 | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/pages/cssTestingGrounds.tsx` | yes | 12/24 | PARTIAL | PASS 0 / FAIL 1 |
| `web/pages/social-share/[format].tsx` | yes | 19/19 | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/public/fonts/social-share/MartianMono-Variable.ttf` | yes | binary: identical blob | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/public/fonts/social-share/RobotoCondensed-Variable.ttf` | yes | binary: identical blob | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/public/fonts/social-share/TrainOne-Regular.ttf` | yes | binary: identical blob | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/public/fonts/social-share/martianmono-OFL.txt` | yes | 93/93 | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/public/fonts/social-share/robotocondensed-OFL.txt` | yes | 93/93 | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/public/fonts/social-share/trainone-OFL.txt` | yes | 93/93 | FULLY-PRESENT | FAIL 1 / PASS 0 |
| `web/styles/vars.scss` | yes | 1/11 | PARTIAL | PASS 0 / FAIL 1 |

Whole-patch diagnostics:
```text
forward: error: patch failed: web/__tests__/seo.test.ts:13
error: web/__tests__/seo.test.ts: patch does not apply
error: patch failed: web/components/GameGrid/GameGrid.tsx:264
error: web/components/GameGrid/GameGrid.tsx: patch does not apply
error: patch failed: web/components/GameGrid/utils/calcWinOdds.test.js:4
error: web/components/GameGrid/utils/calcWinOdds.test.js: patch does not apply
error: patch failed: web/components/GameGrid/utils/calcWinOdds.ts:33
error: web/components/GameGrid/utils/calcWinOdds.ts: patch does not apply
error: web/components/SocialShare/SocialShare.module.scss: already exists in working directory
error: web/components/SocialShare/SocialShare.tsx: already exists in working directory
error: web/e2e/social-share.spec.ts: already exists in working directory
error: patch failed: web/lib/NHL/server/index.test.ts:362
error: web/lib/NHL/server/index.test.ts: patch does not apply
error: patch failed: web/lib/NHL/server/index.ts:437
error: web/lib/NHL/server/index.ts: patch does not apply
error: patch failed: web/lib/NHL/types.ts:281
error: web/lib/NHL/types.ts: patch does not apply
error: patch failed: web/lib/seo.js:3
error: web/lib/seo.js: patch does not apply
error: web/lib/socialShare/export.ts: already exists in working directory
error: web/lib/socialShare/schedule.test.ts: already exists in working directory
error: web/lib/socialShare/schedule.ts: already exists in working directory
error: web/lib/socialShare/server.ts: already exists in working directory
error: web/lib/socialShare/types.ts: already exists in working directory
error: web/pages/api/v1/social-share/[format].ts: already exists in working directory
error: web/pages/social-share/[format].tsx: already exists in working directory
error: web/public/fonts/social-share/MartianMono-Variable.ttf: already exists in working directory
error: web/public/fonts/social-share/RobotoCondensed-Variable.ttf: already exists in working directory
error: web/public/fonts/social-share/TrainOne-Regular.ttf: already exists in working directory
error: web/public/fonts/social-share/martianmono-OFL.txt: already exists in working directory
error: web/public/fonts/social-share/robotocondensed-OFL.txt: already exists in working directory
error: web/public/fonts/social-share/trainone-OFL.txt: already exists in working directory
reverse: error: patch failed: web/styles/vars.scss:306
error: web/styles/vars.scss: patch does not apply
error: patch failed: web/pages/cssTestingGrounds.tsx:83
error: web/pages/cssTestingGrounds.tsx: patch does not apply
error: patch failed: web/lib/socialShare/types.ts:1
error: web/lib/socialShare/types.ts: patch does not apply
error: patch failed: web/lib/socialShare/schedule.ts:1
error: web/lib/socialShare/schedule.ts: patch does not apply
error: patch failed: web/lib/socialShare/schedule.test.ts:1
error: web/lib/socialShare/schedule.test.ts: patch does not apply
error: patch failed: web/lib/NHL/types.ts:272
error: web/lib/NHL/types.ts: patch does not apply
error: patch failed: web/lib/NHL/server/index.ts:437
error: web/lib/NHL/server/index.ts: patch does not apply
error: patch failed: web/lib/NHL/server/index.test.ts:362
error: web/lib/NHL/server/index.test.ts: patch does not apply
error: patch failed: web/e2e/social-share.spec.ts:1
error: web/e2e/social-share.spec.ts: patch does not apply
error: patch failed: web/components/SocialShare/SocialShare.tsx:1
error: web/components/SocialShare/SocialShare.tsx: patch does not apply
error: patch failed: web/components/SocialShare/SocialShare.module.scss:1
error: web/components/SocialShare/SocialShare.module.scss: patch does not apply
error: patch failed: web/components/GameGrid/utils/calcWinOdds.ts:33
error: web/components/GameGrid/utils/calcWinOdds.ts: patch does not apply
error: patch failed: web/components/GameGrid/utils/calcWinOdds.test.js:4
error: web/components/GameGrid/utils/calcWinOdds.test.js: patch does not apply
error: patch failed: web/components/GameGrid/GameGrid.tsx:264
error: web/components/GameGrid/GameGrid.tsx: patch does not apply
error: patch failed: web/__tests__/seo.test.ts:13
error: web/__tests__/seo.test.ts: patch does not apply
error: tasks/tasks-prd-social-share-tools.md: No such file or directory
error: tasks/prd-social-share-tools.md: No such file or directory
error: patch failed: tasks/TASKS/rules/fhfh-styles.md:845
error: tasks/TASKS/rules/fhfh-styles.md: patch does not apply
```

**`tasks/TASKS/rules/fhfh-styles.md` — missing/context ledger**

- `@@ -845,6 +845,14 @@ Primary card reference: `SuggestedPicks.module.scss``: missing source addition lines **848, 850–854** (6/8 additions). First missing: `##### Social-Share Render Variant`.

**`tasks/prd-social-share-tools.md` — missing/context ledger**

- `@@ -0,0 +1,45 @@`: missing source addition lines **1–45** (45/45 additions). First missing: `# FHFH social-share tools`.

**`tasks/tasks-prd-social-share-tools.md` — missing/context ledger**

- `@@ -0,0 +1,74 @@`: missing source addition lines **1–74** (74/74 additions). First missing: `## Relevant Files`.

**`web/__tests__/seo.test.ts` — missing/context ledger**

- `@@ -13,7 +13,7 @@ describe("public SEO boundaries", () => {`: missing source addition lines **16** (1/1 additions). First missing: `for (const path of ["/auth", "/auth/callback?code=x", "/account/", "/db/player-aliases", "/privacy", "/cssTestingGrounds", "/404", "/underlying-stats/`.
- `@@ -26,7 +26,7 @@ describe("public SEO boundaries", () => {`: missing source addition lines **29** (1/1 additions). First missing: `const paths = ["/", "/blog", "/auth", "/auth/callback", "/db", "/db/player-aliases", "/account", "/privacy", "/cssTestingGrounds", "/game-grid", "/gam`.

**`web/components/GameGrid/GameGrid.tsx` — missing/context ledger**

- `@@ -264,10 +264,13 @@ function GameGridInternal({`: missing source addition lines **267, 269–273** (6/7 additions). First missing: `const winOddsList = convertTeamRowToWinOddsList(`.

**`web/components/GameGrid/utils/calcWinOdds.test.js` — missing/context ledger**

- `@@ -4,9 +4,67 @@ import { describe, expect, test } from "vitest";`: missing source addition lines **7, 11, 13–32, 34–43, 46–48, 50–51, 54–65** (49/58 additions). First missing: `convertTeamRowToWinOddsList,`.

**`web/components/GameGrid/utils/calcWinOdds.ts` — missing/context ledger**

- `@@ -33,7 +33,8 @@ export function formatWinOdds(winOdds: number): string {`: missing source addition lines **37** (1/2 additions). First missing: `excludedDays: DAY_ABBREVIATION[] = []`.
- `@@ -62,6 +63,10 @@ export function convertTeamRowToWinOddsList(`: missing source addition lines **66–67** (2/4 additions). First missing: `excludedDays.forEach((day) => {`.

**`web/components/SocialShare/SocialShare.module.scss` — missing/context ledger**

- `@@ -0,0 +1,107 @@`: missing source addition lines **45, 57, 61, 64–65, 69–70, 75, 78, 80, 83–84, 86, 88–89, 93–94, 96** (18/107 additions). First missing: `.previewFrame { max-width: v.$share-preview-max; width: 100%; position: relative; overflow: hidden; margin: 0 auto; min-height: v.$control-height-md; `.

**`web/components/SocialShare/SocialShare.tsx` — missing/context ledger**

- `@@ -0,0 +1,180 @@`: missing source addition lines **28, 111, 157, 174** (4/180 additions). First missing: `return FHFH ${labels[snapshot.format]}, ${yearDateLabel(snapshot.weekStart)} through ${yearDateLabel(snapshot.weekEnd)}. ${trusted ? "Schedule only" :`.

**`web/e2e/social-share.spec.ts` — missing/context ledger**

- `@@ -0,0 +1,256 @@`: missing source addition lines **4, 7** (2/256 additions). First missing: `import type { GameData } from "../lib/NHL/types";`.

**`web/lib/NHL/server/index.test.ts` — missing/context ledger**

- `@@ -362,6 +362,9 @@ describe("getSchedule", () => {`: missing source addition lines **366–367** (2/3 additions). First missing: `gameState: "FUT",`.
- `@@ -381,6 +384,10 @@ describe("getSchedule", () => {`: missing source addition lines **387–390** (4/4 additions). First missing: `expect(result.games).toEqual([result.data[68].MON]);`.

**`web/lib/NHL/server/index.ts` — missing/context ledger**

- `@@ -437,16 +437,22 @@ type GameWeek = {`: missing source addition lines **440, 447–448, 454–455** (5/6 additions). First missing: `gameType?: number;`.
- `@@ -462,15 +468,20 @@ export async function getSchedule(`: missing source addition lines **471, 474–475, 482–484** (6/6 additions). First missing: `const { gameWeek, lastUpdatedUTC } = await get<{ gameWeek: GameWeek; lastUpdatedUTC?: string }>(`.
- `@@ -531,23 +542,29 @@ export async function getSchedule(`: missing source addition lines **548, 551–552, 559–560, 567** (6/7 additions). First missing: `gameType: game.gameType ?? derivedGameType,`.

**`web/lib/NHL/types.ts` — missing/context ledger**

- `@@ -272,6 +272,8 @@ export type EXTENDED_DAY_ABBREVIATION = (typeof EXTENDED_DAYS)[number];`: missing source addition lines **275–276** (2/2 additions). First missing: `abbrev?: string;`.
- `@@ -281,6 +283,7 @@ export type GameData = {`: all 1 addition lines appear literally; context/deletion integration is not established by that alone.
- `@@ -297,6 +300,10 @@ export type ScheduleData = {`: missing source addition lines **303–306** (4/4 additions). First missing: `fetchedAt?: string;`.

**`web/lib/socialShare/schedule.test.ts` — missing/context ledger**

- `@@ -0,0 +1,113 @@`: missing source addition lines **3** (1/113 additions). First missing: `import type { GameData, ScheduleData } from "lib/NHL/types";`.

**`web/lib/socialShare/schedule.ts` — missing/context ledger**

- `@@ -0,0 +1,144 @@`: missing source addition lines **1, 7, 36, 39, 86, 101, 108, 115, 118** (9/144 additions). First missing: `import { DAYS, type GameData, type ScheduleData, type WeekData } from "lib/NHL/types";`.

**`web/pages/cssTestingGrounds.tsx` — missing/context ledger**

- `@@ -83,6 +83,14 @@ const showcaseSections: ShowcaseSection[] = [`: missing source addition lines **87–90, 92** (5/8 additions). First missing: `id: "social-share-render",`.
- `@@ -432,6 +440,22 @@ function renderShowcaseExamples(sectionId: string) {`: missing source addition lines **445–446, 449, 451–453, 455** (7/16 additions). First missing: `<strong>Social-Share Render Variant</strong>`.

**`web/styles/vars.scss` — missing/context ledger**

- `@@ -306,6 +306,17 @@ $font-family-secondary: "Arial", sans-serif;`: missing source addition lines **309–318** (10/11 additions). First missing: `// Fixed-pixel social-share render variant of the standard panel/summary families.`.

### `76d507e` — Keep approved preseason shift defects from blocking scheduled work

Full SHA `76d507ea84634a91a69f61648d0a58e85e76571b`; `git merge-base --is-ancestor <sha> 8a6ac8adc` exit 1 (not ancestor). Evidence: `P4-76d507e.patch.txt` and `P4-EVIDENCE.json`.

| File | Exists in target | Exact added lines present | Content | Forward / reverse |
| --- | --- | --- | --- | --- |
| `web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts` | yes | 10/39 | PARTIAL | PASS 0 / FAIL 1 |
| `web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts` | yes | 19/76 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/lib/projections/preseasonShiftExceptions.test.ts` | no | 0/26 | ABSENT | PASS 0 / FAIL 1 |
| `web/lib/projections/preseasonShiftExceptions.ts` | no | 0/49 | ABSENT | PASS 0 / FAIL 1 |
| `web/pages/api/v1/db/ingest-projection-inputs.ts` | yes | 30/51 | PARTIAL | FAIL 1 / FAIL 1 |
| `web/pages/api/v1/db/shift-charts.ts` | yes | 9/57 | PARTIAL | FAIL 1 / FAIL 1 |

Whole-patch diagnostics:
```text
forward: error: patch failed: web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts:171
error: web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts: patch does not apply
error: patch failed: web/pages/api/v1/db/ingest-projection-inputs.ts:552
error: web/pages/api/v1/db/ingest-projection-inputs.ts: patch does not apply
error: patch failed: web/pages/api/v1/db/shift-charts.ts:1039
error: web/pages/api/v1/db/shift-charts.ts: patch does not apply
reverse: error: patch failed: web/pages/api/v1/db/shift-charts.ts:42
error: web/pages/api/v1/db/shift-charts.ts: patch does not apply
error: patch failed: web/pages/api/v1/db/ingest-projection-inputs.ts:38
error: web/pages/api/v1/db/ingest-projection-inputs.ts: patch does not apply
error: web/lib/projections/preseasonShiftExceptions.ts: No such file or directory
error: web/lib/projections/preseasonShiftExceptions.test.ts: No such file or directory
error: patch failed: web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts:145
error: web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts: patch does not apply
error: patch failed: web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts:334
error: web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts: patch does not apply
```

**`web/__tests__/pages/api/v1/db/ingest-projection-inputs.test.ts` — missing/context ledger**

- `@@ -334,6 +334,7 @@ function createMockRes() {`: missing source addition lines **337** (1/1 additions). First missing: `games.forEach((game, index) => { game.id = 101 + index; });`.
- `@@ -454,6 +455,44 @@ describe("/api/v1/db/ingest-projection-inputs", () => {`: missing source addition lines **458–461, 463–470, 473–477, 479–481, 483, 486–489, 491–493** (28/38 additions). First missing: `it("advances the durable cursor past the approved preseason defect without persisting completeness", async () => {`.

**`web/__tests__/pages/api/v1/db/shift-charts.queue.test.ts` — missing/context ledger**

- `@@ -145,6 +145,80 @@ describe("shift-chart scheduled relationship queue", () => {`: missing source addition lines **148–157, 159, 161–163, 165, 167–168, 170, 172–175, 178–183, 185, 187–190, 193–194, 196, 198–200, 203–207, 209–219** (55/74 additions). First missing: `function queueMissingRoster(gameIds: number[]) {`.
- `@@ -171,7 +245,7 @@ describe("shift-chart scheduled relationship queue", () => {`: missing source addition lines **248** (1/1 additions). First missing: `maxGames: 18,`.
- `@@ -210,7 +284,7 @@ describe("shift-chart scheduled relationship queue", () => {`: missing source addition lines **287** (1/1 additions). First missing: `maxGames: 3,`.

**`web/lib/projections/preseasonShiftExceptions.test.ts` — missing/context ledger**

- `@@ -0,0 +1,26 @@`: missing source addition lines **1–26** (26/26 additions). First missing: `import { describe, expect, it } from "vitest";`.

**`web/lib/projections/preseasonShiftExceptions.ts` — missing/context ledger**

- `@@ -0,0 +1,49 @@`: missing source addition lines **1–49** (49/49 additions). First missing: `const APPROVED_PRESEASON_GAME_IDS = new Set([2026010001, 2026010056]);`.

**`web/pages/api/v1/db/ingest-projection-inputs.ts` — missing/context ledger**

- `@@ -38,7 +38,12 @@ import {`: missing source addition lines **41, 44–46** (4/5 additions). First missing: `import { approvedPreseasonShiftSkip, type PreseasonShiftSkip } from "lib/projections/preseasonShiftExceptions";`.
- `@@ -552,6 +557,7 @@ export async function ingestProjectionInputsHandler(`: missing source addition lines **560** (1/1 additions). First missing: `let authoritativeGameType: unknown;`.
- `@@ -561,6 +567,7 @@ export async function ingestProjectionInputsHandler(`: missing source addition lines **570** (1/1 additions). First missing: `authoritativeGameType = sharedPbp.gameType;`.
- `@@ -669,6 +676,42 @@ export async function ingestProjectionInputsHandler(`: missing source addition lines **679, 681, 683–684, 686–688** (7/36 additions). First missing: `const approvedSkip = approvedPreseasonShiftSkip({`.
- `@@ -758,6 +801,14 @@ export async function ingestProjectionInputsHandler(`: missing source addition lines **804–811** (8/8 additions). First missing: `result.operationStatus = !result.success`.

**`web/pages/api/v1/db/shift-charts.ts` — missing/context ledger**

- `@@ -42,6 +42,7 @@`: missing source addition lines **45** (1/1 additions). First missing: `import { APPROVED_PRESEASON_SHIFT_LOOKAHEAD, approvedPreseasonShiftSkip, type PreseasonShiftSkip } from "lib/projections/preseasonShiftExceptions";`.
- `@@ -1039,7 +1040,9 @@ async function fetchAndStoreShiftCharts(`: missing source addition lines **1043, 1045** (2/2 additions). First missing: `preseasonShiftSkips: PreseasonShiftSkip[];`.
- `@@ -1049,6 +1052,7 @@ async function fetchAndStoreShiftCharts(`: missing source addition lines **1055** (1/1 additions). First missing: `let scheduledSeasonId: number | null = null;`.
- `@@ -1080,35 +1084,42 @@ async function fetchAndStoreShiftCharts(`: missing source addition lines **1087, 1090, 1098, 1100–1101, 1103–1106, 1108–1110, 1112–1119, 1122** (21/25 additions). First missing: `scheduledSeasonId = seasonId;`.
- `@@ -1124,8 +1135,10 @@ async function fetchAndStoreShiftCharts(`: missing source addition lines **1138, 1141** (2/2 additions). First missing: `stage = "relationship_roster";`.
- `@@ -1148,10 +1161,22 @@ async function fetchAndStoreShiftCharts(`: missing source addition lines **1164, 1169, 1171–1174, 1176–1177** (8/12 additions). First missing: `processedGames += 1;`.
- `@@ -1170,6 +1195,7 @@ async function fetchAndStoreShiftCharts(`: missing source addition lines **1198** (1/1 additions). First missing: `preseasonShiftSkips,`.
- `@@ -1183,6 +1209,7 @@ async function fetchAndStoreShiftCharts(`: missing source addition lines **1212** (1/1 additions). First missing: `preseasonShiftSkips,`.
- `@@ -1234,6 +1261,11 @@ async function handleShiftChartsRequest(`: missing source addition lines **1264–1267** (4/5 additions). First missing: `const dataQualityWarnings = result.preseasonShiftSkips.map((skip) => ({`.
- `@@ -1241,17 +1273,22 @@ async function handleShiftChartsRequest(`: missing source addition lines **1276–1277, 1283, 1290–1291** (5/5 additions). First missing: `preseasonShiftSkips: result.preseasonShiftSkips,`.
- `@@ -1267,6 +1304,8 @@ async function handleShiftChartsRequest(`: missing source addition lines **1307–1308** (2/2 additions). First missing: `preseasonShiftSkips: result.preseasonShiftSkips,`.

## Applicability proposals (no implementation)

1. **FORGE `9592e2e6`:** preserve the specialized 503 compatibility error and fail-closed native accounting test as a proposal only. The absent `forecast-diagnostics/loader*` parent implementation is a prerequisite. This tiny patch cannot create the missing adapter subsystem.
2. **Start Chart `894fe7ea`:** Claude/TJ may port specific still-wanted scoring/profile hydration, exact game-ID filtering, source/revision lineage and scoring-input messages, refresh-failure status, and confirmed-evidence labels. Current source already has newer expiry/admission controls and stronger confirmed-out evidence checks; raw old-line restoration could lose those. Its E2E file forward-checks, but that does not establish compatibility with the current page.
3. **FORGE `8b6332`:** new `physicalShiftIntervalAssessment.ts` and `physicalShiftIntervals.ts` each forward-check; `shifts.test.ts` conflicts. Any adoption needs owner decision, dependency review and targeted local tests; two module additions alone do not prove production ingestion uses them.
4. **Social `2331cc1`:** preserve current localized social schedule types, retrievedAt fallback, stricter timestamp/expiry handling, newer score invocation and local SCSS tokens. The current copy explicitly says observed schedule/no odds or projections. Missing old shared NHL fields, GameGrid edits, vars and CSS playground additions are proposals for intent review, not a recommendation to reintroduce them. Original task/PRD files are absent; no task closure is implied.
5. **Misattributed `76d507e`:** actual patch skips only two explicitly approved preseason games and leaves input completeness unverified; it changes cursor advancement, queue lookahead and warning behavior. Current target lacks the dedicated helper. Whole patch conflicts, and live operational approval cannot be inferred from historical comments. Claude/TJ must decide any port; obtain an authoritative draft/WiGO commit separately.

## Missing-source search

Bounded local search: `git log --all --format=%H`; `git rev-parse --verify <prefix>^{commit}`; the same resolution from **every existing registered worktree**; non-writing `git fsck --no-reflogs --unreachable`. No fetching, lost-found writes, archive/cloud search, branch mutation or arbitrary filesystem sweep.

| Prefix | Reachable log | Direct object resolution | Existing worktrees | Unreachable objects | Verdict |
| --- | --- | --- | --- | --- | --- |
| `3d15e65e` | no match | FAIL 128 | no match in 28 existing | no matching commit (exit 0) | **NOT FOUND in accessible local evidence** |
| `9984caf` | no match | FAIL 128 | no match in 28 existing | no matching commit (exit 0) | **NOT FOUND in accessible local evidence** |
| `c983535e` | no match | FAIL 128 | no match in 28 existing | no matching commit (exit 0) | **NOT FOUND in accessible local evidence** |
| `f3520f0` | no match | FAIL 128 | no match in 28 existing | no matching commit (exit 0) | **NOT FOUND in accessible local evidence** |
| `0a6fed7` | no match | FAIL 128 | no match in 28 existing | no matching commit (exit 0) | **NOT FOUND in accessible local evidence** |

All 104 registered worktree paths were accounted for: 28 exist and were queried; 76 absent paths cannot be inspected. Existing worktrees share the repository object store (per-worktree common-dir output retained). Missing directories, other clones/machines, external archives and inaccessible sources remain **UNVERIFIABLE**. The five not-found commits therefore have unknown touched files, unknown added content, and forward/reverse checks **NOT RUN (source unavailable)**; no FULLY-PRESENT/PARTIAL/ABSENT content verdict can honestly be assigned.

## Preservation and verification

**PASS:** literal `git --no-optional-locks status --porcelain` was identical before and after (44 entries; full snapshots in JSON). All 43 touched-path observations also retained their original SHA-256 bytes or matching absence. The entire sprint directory was already untracked, so P4 additions did not add porcelain lines; status equality alone does not prove all concurrent bytes stayed fixed.

All report-only changes remain uncommitted. No background app/test/server process was started. Non-writing fsck exited 0; no process remains running. Its summarized object counts, zero named-prefix matches and diagnostics are retained in `P4-FSCK.txt`.
