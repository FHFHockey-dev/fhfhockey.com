# S-14 checkpoint diary

**Diary:** S-14 Game Grid acceptance and forecast integration. Owner thread: S-14 worker session (Opus 5.5), reporting to Chef `local_08a0bf1c`. Written 2026-10-18T19:09Z. Full detail is in `DIARY.md`.

**Outcome and settled decisions**
- **Item 1 (done).** The crowding code is identical to the accepted `cca89e264` and is in production `457435eb`.
  - The offline experiment on a real 32-team week met its pre-registered criterion: 192 scenarios, 0 GP/ON violations, top pick better in 35 and worse in 0. See `crowding-experiment/`.
  - The effect is tie-breaking only, and the roster model is synthetic and positionless.
- **Item 3 (done).** `opponentCategoryEffects.ts` splits opponent effects by role and category, with no universal sign.
  - Existing team-strength inputs are rejected as category factors, and a guard flags any effect applied twice.
  - The Skaters/Goalies toggle is in both opponent tables. The Skaters default reproduces the released colors.
- **Item 5 (done).** A 32-team real-week regression test covers all 127 day masks plus partial, postponed and empty weeks. The repo e2e has 32-team, day-mask and stale-schedule cases.
- **Item 2 (blocked).** The adapter `teamGameExpectations.ts` over the shared `forge-game-expectations-v1` reader is built but not wired into the UI. It waits on the native FORGE serving release and approval for a Game Grid read route.
- **Audit decisions.**
  - "Keep exploring" links: restored.
  - `fefefe006` 4WK shading: deliberate; the C0025 wording is stale.
  - PlayerPickupTable raw colors: proposed patch only.

**Branch / commit / dirty files / file hashes** (`octoberBranch` @ `0de97e77d`, uncommitted; SHA-256, first 12 characters; paths relative to `web/`)

| File | Status | SHA-256 |
|---|---|---|
| `components/GameGrid/DesktopMasterTable.tsx` | M | 59ecaec9adbb |
| `components/GameGrid/OpponentMetricsTable.tsx` | M | 1a2d4ea408f0 |
| `components/GameGrid/OpponentMetricsTable.module.scss` | M | 147e6464bf77 |
| `pages/game-grid/[mode].tsx` | M | 2d2e6af4a753 |
| `e2e/game-grid-previews.spec.ts` | M | 3bcb663d89c3 |
| `e2e/fixtures/game-grid-previews/App.tsx` | M | 49b575719909 |
| `e2e/fixtures/game-grid-previews/data.ts` | M | 149c8a308f03 |
| `components/GameGrid/OpponentRoleToggle.tsx` | new | 61eb676d49b5 |
| `components/GameGrid/OpponentRoleToggle.module.scss` | new | 6fec44ce51a7 |
| `components/GameGrid/OpponentMetricsTable.test.tsx` | new | eec0af05e187 |
| `components/GameGrid/LeagueWeek.test.tsx` | new | 93349fdf5c25 |
| `components/GameGrid/GameGridPage.test.tsx` | new | fd553b05d0ce |
| `components/GameGrid/utils/opponentCategoryEffects.ts` | new | dd597a52903e |
| `components/GameGrid/utils/opponentCategoryEffects.test.ts` | new | ea3b7747fe14 |
| `components/GameGrid/utils/teamGameExpectations.ts` | new | 8c93843b95de |
| `components/GameGrid/utils/teamGameExpectations.test.ts` | new | b5df240e430d |
| `e2e/fixtures/game-grid-previews/real-week-32.ts` | new | 1b5f574a5000 |
| `e2e/fixtures/game-grid-previews/README.md` | new | 43cf40696731 |

The task doc `tasks/tasks-game-grid-execution-2026-10-07.md` has an S-14 note appended.

**Changes and evidence paths**
- This folder:
  - `DIARY.md`
  - `crowding-experiment/`: `PROTOCOL.md`, `RESULTS.md`, `results.json`, scripts and the schedule JSON.
  - `browser-evidence/shots/`: screenshots.
  - `proposed-player-pickup-yahoo-context-tokens.patch`
- The `browser-evidence/fixture-32-team/` scratch copy is superseded by the repo e2e.

**Tests: exact commands, results, limits, not-run checks** (run from `web/`)
- `npx vitest run components/GameGrid` → 22 files, 232 tests pass.
- `cd e2e && npx playwright test -c game-grid-previews.config.ts` → 15/15 pass (10 existing plus 5 new) at 1920, 1440, 1180, 1040, 479, 430, 390 and 320px.
- `cd e2e && npx playwright test -c opponent-four-week-metrics.config.ts` → 4/4 pass (1920 and 390px).
- ESLint on all changed files: clean.
- Full `tsc` behind the lock: 4 errors. Mine (a `LeagueWeek.test.tsx` fixture type) is fixed. The other 3 are other lanes': `sweep-gamecenter-normalization.ts:5`, `ingest-projection-inputs.ts:27` and `rollingPlayerValidationPayload.test.ts:1154`.
- A scoped `tsc` over the changed Game Grid files and their imports (1,208 files) then passed. Full `tsc` was not rerun.
- **Limits.**
  - Browser runs are headless Chromium on isolated fixtures only; these fixtures don't load `globals.css`.
  - No Next dev server, live, VoiceOver or 200%-zoom checks.
  - The experiment is synthetic.

**Status / acceptance remaining / blockers**
- Items 1, 3 and 5 are complete locally.
- **Item 2 UI wiring** is blocked on the native FORGE serving release, a Game Grid route over `loadGameExpectations`, and Chef/TJ approval.
- **Item 4** (markets) is out of scope.
- **Live acceptance** needs a release authorization.

**Operations**
- The fixture servers (3112, 3114, 3116) were stopped. At 2026-10-18T19:09Z, `lsof` shows 0 listeners on 3112.
- The heavy lock `/private/tmp/fhfh-heavy.lock` was released after `tsc`.
- No background jobs are running. `next-env.d.ts` is untouched; no Next server was started.

**Ownership held / safe transfer or release conditions**
- **Held:**
  - `web/components/GameGrid/**`
  - `web/pages/game-grid/**`
  - `web/e2e/game-grid-previews.{spec,config}.ts`
  - `web/e2e/fixtures/game-grid-previews/**`
  - the Game Grid task docs
  - this folder
- **Release conditions:** Chef can release these once the files are committed or handed to a new owner who checks the hashes above. No partial edits are pending.

**Next command** (copy-paste-ready, within authorization):

```bash
cd /Users/tim/Code/fhfhockey.com/web && npx vitest run components/GameGrid && (cd e2e && npx playwright test -c game-grid-previews.config.ts) && lsof -nP -iTCP:3112 -sTCP:LISTEN
```

**Receiving owner / handoff verification / outstanding diary work**
- The receiving owner is Chef, or a future Game Grid owner.
- To verify the handoff, compare the hashes above and rerun the next command.
- No diary work is outstanding.
