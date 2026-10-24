# S08 stats game route — bounded correction

Local implementation and focused offline verification complete; independent review pending. The precise lease is `web/pages/stats/game/[gameId].tsx` plus a dedicated nearest fixture. No S11 links or broad route redesign are included.

## Exact changed application files

- `web/pages/stats/game/[gameId].tsx` (modify):
  - Before SHA-256: `8260a28ebd3bf1b1789d2e544ea1961a24458f59ab109c0358c3b6cfade26b62`.
  - Candidate SHA-256: `dc4f19d8ee1b688a34a816a562fc5e4c01d4bac0e862cd91f272b06b2fa6156f`.
- `web/__tests__/pages/statsGame.test.tsx` (add):
  - Before SHA-256: `absent`.
  - Candidate SHA-256: `09807279a24a8fe98bd57e802103e894e21411fa1896b2d437fad7ba4d36b88a`.

The original route was clean at start. `web/__tests__/pages/game.test.tsx` targets the separate `/game` route and was read only; the new fixture targets `/stats/game`. CSS, shared APIs, NHL adapters, player search, all four accepted P03 files and all 13 accepted A7–A9 files remain byte-identical. `BEFORE.json` and `CANDIDATE.json` contain all 11 inspected source pins (route plus 10 unchanged dependencies/context files), plus the 17 preservation pins.

## Actual source contracts and corrections

- `web/pages/api/v1/game/[id]/boxscore/index.ts` returns `{success:true,data:boxscore}` or HTTP-200 `{success:false,message,data:null}`. `web/lib/api/types.ts` declares this envelope. The route fetcher previously recognized HTTP/error-field failures only. It now rejects `success:false` locally, preserving the shared API unchanged. Right-rail and daily-schedule APIs return raw success payloads and HTTP/error-field failures; these remain compatible.
- A single ten-digit nonzero-leading string ID is required before SWR keys are constructed. Ambiguous arrays, malformed strings and missing IDs do not fetch. The server route returns `notFound` for invalid params without any request. A boxscore must carry the matching numeric game ID and the successful envelope; another game's data cannot supply identity or trigger its schedule read. ID shape is not proof of provider existence.
- The current matching boxscore supplies game status before a season-series snapshot; a partial boxscore can still use matching rail identity. Status maps FUT/Scheduled, PRE/Pregame, LIVE or CRIT/Live, and OFF/OVER/FINAL/Final; unknown status stays unavailable. The completed-state vocabulary already appears in the existing public game/GamePreview callers inspected read-only.
- SWR loading state is used instead of falsiness of returned data. Successful null payloads settle. A valid identity/boxscore is visible while the independent rail is pending or failed; valid rail/team statistics remain visible when boxscore fails. Source warnings distinguish failed requests from successful empty results. No backend status rewrite or new retry policy was introduced.
- Missing market odds no longer produce 50/50 or score-share “implied probabilities.” Both odds must parse as supported American or decimal values before normalization. Known zero scores remain zero and are labeled Score even when market odds exist. Missing strength pairs no longer draw a false equal-strength bar. Valid market probability controls retain the prior calculation.
- Last-ten context no longer defaults to a fabricated 0-0-0 record, and absent head-to-head data is not declared the season's first meeting. Completed OVER rows are included. A winner requires both finite nonnegative unequal scores; tied/missing scores retain the score display and show Result unavailable.
- Existing `player.playerId` React keys are retained. Two distinct IDs with the same name remain separate; genuine zero points/shots stay zero and null counts display unknown. No player links, identity repairs, goalie formulas, ranking rewrite or new IDs were added.

## Before / after evidence

`final-red.log` runs the identical final fixture against immutable baseline route bytes: **33 failed / 4 passed**. Passing controls cover a valid server route, valid FUT status, and successful empty-object/null-data envelopes. Failures reproduce actual route rendering/fetch behavior, including invalid-ID requests, HTTP-200 failure detection, null-response loading, boxscore/rail independence, game-state distinctions, wrong-response identity, unsupported probability defaults, missing-strength bars and missing/tied head-to-head results.

`after-tests.log`: **37 passed** against the pinned candidate. Tests use the actual component, actual SWR, a fresh cache per mount, and synthetic global fetch responses; the search child and Next head/router are mocked. No test contacts the provider or Supabase. The earlier `before-tests.log` is retained as a checkpoint only: its array-parameter fixture was corrected before `final-red.log`, which supersedes it for identical-test comparison.

## Verification commands

Runtime: Node 22.11.0 / npm 10.9.0 (`runtime.txt`). All application commands ran in an environment-free copied snapshot with synthetic configuration, HTTP/socket/fetch guards and reused local node_modules. No package install, lock change, build or canonical app process was started.

```sh
sh tasks/artifacts/fhfh-sprint-fixes-2026-10-22/s08-game-route/run-check.sh /tmp/fhfh-queue-check-me82zd3l/isolation/snapshot/web env DEBUG_PRINT_LIMIT=1200 npm test -- --run --config audit.vitest.config.mts __tests__/pages/statsGame.test.tsx
```
Result: exit 1; Expected baseline red: 33 failed / 4 passed, identical final fixture. Log: `final-red.log`.

```sh
sh tasks/artifacts/fhfh-sprint-fixes-2026-10-22/p03-timeline-xg/run-tests.sh /tmp/fhfh-queue-check-7tmjn93m/isolation/snapshot/web __tests__/pages/statsGame.test.tsx
```
Result: exit 0; 37 passed. Log: `after-tests.log`.

```sh
sh tasks/artifacts/fhfh-sprint-fixes-2026-10-22/s08-game-route/run-check.sh /tmp/fhfh-queue-check-7tmjn93m/isolation/snapshot/web npm exec --offline -- tsc --noEmit --project tsconfig.s08.json
```
Result: exit 0; Passed without diagnostics. Log: `typecheck.log`.

```sh
sh tasks/artifacts/fhfh-sprint-fixes-2026-10-22/s08-game-route/run-check.sh /tmp/fhfh-queue-check-7tmjn93m/isolation/snapshot/web npm exec --offline -- eslint --report-unused-disable-directives-severity warn 'pages/stats/game/[gameId].tsx' __tests__/pages/statsGame.test.tsx
```
Result: exit 0; Passed without diagnostics. Log: `lint.log`.

```sh
git diff --check -- 'web/pages/stats/game/[gameId].tsx' web/__tests__/pages/statsGame.test.tsx
```
Result: exit 0; Passed.

The copied `run-tests.sh` matches the P03 wrapper actually used for the passing test command. To recreate the isolated snapshot, run `python3 tasks/artifacts/fhfh-sprint-fixes-2026-10-22/s08-game-route/stage-offline.py tasks/artifacts/claude-audit-fix-queue-2026-10-22`, copy `tsconfig.s08.json` into the returned web directory, and substitute that directory in the commands. The stage script checks for source drift and excludes environment/credential files.

## Fixed handoff and limits

- Candidate manifest SHA-256: `1ea145d67726c45bd953cbee58a22be730372ee01e33aa0742960274b39da4b3`. `SHA256SUMS` pins the two application files. `packet.patch` is against the immutable before file, not unrelated dirty changes.
- Start HEAD `67b9efda5901a5f8c25a25889572e85527056f7a`; observed handoff HEAD `d77602cf7fbdd4549588127603ebf0b535138b99`. Another agent committed an unrelated route-runner-store correction during this work. The commit did not change either leased path. No commit/branch/runner action was performed here; tested file hashes identify this dirty-tree candidate.
- Baseline snapshot `/tmp/fhfh-queue-check-me82zd3l/isolation/snapshot/web`; tested snapshot `/tmp/fhfh-queue-check-7tmjn93m/isolation/snapshot/web`.
- Passed: focused 37-case route fixture, scoped TypeScript including its import closure, two-file ESLint, whitespace checks, 17 preserved accepted pins and 10 unchanged inspected dependency pins.
- Not run: browser/visual/AT checks, live providers/production, full suite/build, backend security/status validation, freshness or market-provider comparability. This packet does not claim complete S08 acceptance, S11 readiness, model qualification, or arbitrary malformed deep-provider payload validation.
- Stable provider IDs are retained for valid entries; missing/duplicate provider identities and goalie participation selection were not repaired. SWR default revalidation/retry behavior is unchanged; recognized HTTP-200 failures now follow its existing error path.
- No production/network/NST/cron/SQL/deployment/commit/push, credential access, dependency/lock, ingestion/runner, TJ process, or canonical register actions. No shared-file conflict or approval is pending. Next step is independent review of this fixed candidate.

## Task-only inventory

- Diary: `tasks/diaries/2026-10-22-codex-s08-game-route.md` (working context, excluded from acceptance evidence).
- Artifacts in this directory:

- `ARTIFACT-SHA256SUMS`
- `BEFORE.json`
- `CANDIDATE.json`
- `REPORT.md`
- `SHA256SUMS`
- `after-tests.log`
- `before-tests.log`
- `before/web/pages/stats/game/[gameId].tsx`
- `final-red.log`
- `lint.log`
- `packet.patch`
- `run-check.sh`
- `run-tests.sh`
- `runtime.txt`
- `stage-offline.py`
- `tested-source-fingerprints.json`
- `tsconfig.s08.json`
- `typecheck.log`
