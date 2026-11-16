# DRM local implementation and acceptance

November 12, 2026. Canonical `octoberBranch`; observed HEAD `c0b5b7ff8fea04e1935bc61689f4cc0eea0d44aa`. The initial feature was delivered locally. Subsequently, only the 21 transferred data-pipeline paths were committed locally as `24b1cb4d3`; the source-only release candidate is `866b90bc4` and remains unpublished. Other feature/UI changes remain uncommitted, with CSS/style ownership now shared by user direction. `CANDIDATE.json` pins the 54 owned application/test files, including the 21 transferred source-repair paths. Concurrent work and diaries are excluded. This report supersedes the interim inferred-line and ownership limitations in `PHASE-1.md` and `UI-HISTORY-CHECKPOINT.md`.

## What works locally

- Calendar last 7/14/30 days, season to date and Custom retain their date scope across team, season, venue and opponent changes. Old asynchronous results cannot appear under a new selection.
- The default reader checks scheduled games, final retained PBP identity/clock, current input and relationship versions, source heads, row coverage and historical rosters. It rechecks source generations after reading and rejects an entire inconsistent game. Missing, pending, unverified and stale games are shown separately; they do not become zero time or count toward averages.
- Physical, strength-tagged intervals determine player and teammate time. The relationship producer now preserves ES/PP/PK segment labels under `shift_relationship_materializer_v6_strength_segments`. Legacy `es_shifts` still physically contains ES and PK, explicitly distinguished by the tag. Old versions cannot enter the qualified reader.
- Main units are observed simultaneous combinations, ranked by absolute shared seconds, with disjoint players per formation and numeric-ID tie breaks. Overlapping units and units beyond four forward lines/three pairs/two special-team units appear as alternatives. A historical position change cannot put one player in both a main forward line and defense pair. There are no synthetic fillers or inferred wing placements.
- All strengths, 5-on-5, other ES, PP and PK share one qualified response. All-strengths lists distinct 5-on-5 lines and PP units. Other ES includes time outside verified 5v5 with both goalies present, including unclassified formations. Matrix views support main lineup, cumulative TOI order and full roster. Each off-diagonal denominator is the column player's selected-strength time; a zero denominator is not a 0% share. Diagonal ATOI uses qualified player appearances. Hover/keyboard values also appear above the grid, where grid clipping cannot hide them.
- Cards retain all-strength counting statistics from the same admitted player/game scope. A visible disclosure distinguishes those counts from the selected-strength matrix.
- Historical reports load on demand from retained stores, with source links and retained versions. Verified game-linked reports default to game date; original publication is shown alongside. Practice and uncertain/unlinked reports are separately filtered by publication date, with a publication-mode switch. Complete verified reports are compared only against that game's observed units. Matches, differences and unavailable comparisons are explicit; reports never determine measured assignments.

## Verification and limits

- **Actual browser, isolated source-to-display:** six Chromium scenarios passed through the real server reader, HTTP client, page, reducers and matrix. Cases cover numerical shares/order, date/filter/layout behavior, incomplete/error/empty states, strength switching without refetch, alternatives, zero denominators, source-report comparisons and 390px mobile. Desktop/mobile cases passed again after readability fixes. History HTTP responses are intercepted; its actual backend has separate source-row tests.
- **Captured real data:** current writer/engine replay passed five games, 190 players, all 760 official total/ES/PP/PK clocks, 1,710 undirected teammate pairs and 860 unit groups against independent recounts. The new reader then admitted both teams in all five games and reproduced all 760 strength totals. The reader's source-head/complete-status records are explicitly synthetic offline fixtures; this does not prove current production transactions or receipts. Original snapshots are unchanged. Two games use retained reconciled official-report replacements because their JSON conflicted.
- **Focused checks:** deployment engine 22; reader 15 plus route 3; page 26 plus hook 15; matrix accessibility 8; history component 6; aggregate reader/view/cards 63; history backend/route 42; segment writer/materialization 38. These are scoped groups, with earlier superseded checks omitted. Source-owner mathematical/regression evidence is separately preserved in the triage audit.
- Whole-web TypeScript passed with an 8GB Node heap. Default-heap attempt exhausted memory; intermediate type errors were repaired. Scoped ESLint and tracked/untracked candidate whitespace checks pass. The isolated native-image fixture retains one expected lint warning. No application build or full test suite was run.
- Independent bounded review found one inaccurate card-TOI sentence, now corrected; no remaining concrete numerical or stale-scope defect was identified in that review. This is not universal certification.
- Real archive evidence is limited to the recorded VGK Nov 4–10 sample: 19 versions, three original-clock/link rows representing two stored URLs, no immutable game-linked claims for the two games. Two retained public versions pass the real history reader offline after SQL-to-PostgREST timestamp normalization. Capture completeness, link reachability and complete correction history remain unknown. Publication browsing can require many manual pages; an empty page does not establish no reports existed.
- Five games do not certify all historical data. Irregular 5v5 formations and unsupported special-team formations retain player time but do not produce invented complete units. Expected roster/source generation checks do not independently prove that every upstream NHL shift is correct. Current production contains older generations and must be rebuilt before the new reader admits them.

## Reproduce locally

From `web/`:

```sh
npx playwright test -c e2e/drm-previews.config.ts
npm test -- lib/drm/readMatrix.test.ts lib/drm/observedDeployment.test.ts __tests__/pages/api/v1/drm.test.ts
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
```

From the repository root, replay the retained real snapshots without network or database access:

```sh
node tasks/artifacts/drm-ddatv-2026-11-12/replay-observed-deployment.cjs
```

For manual isolated viewing, run `node e2e/fixtures/drm-previews/server.mjs` from `web/`, then open `http://127.0.0.1:3114/?season=20262027&timeframe=Custom&team=EDM&start=2026-11-03&end=2026-11-10&daterange-matrix-mode=total-toi`. This page uses clearly labeled synthetic data; history buttons require mocked responses supplied by Playwright. Do not treat the ordinary dev page backed by unrepaired production rows as successful data acceptance.

Screenshots: `DRM-DESKTOP.png`, `DRM-MOBILE.png`. Numerical receipt: `OBSERVED-DEPLOYMENT-REPLAY.json`. Current-version prepared rows: `PREPARED-REPAIR-ROWS-v6.json`. Release and data-repair work remains separate and unexecuted; see `RELEASE-REPAIR-PLAN.md`.

## Reported zero-qualified selection

Observed directly in the existing localhost VGK November5–11 page: game2026020252(Nov5) and2026020278(Nov8) require the current qualified source version; game2026020296(Nov11) has missing/pending shared-time calculations. Raw QA reads stored shift rows without the current-version admission gate and remains an all-strength diagnostic view. Its visible output does not qualify those games for the new strength-specific reader. No additional DB query or mutation was needed for this diagnosis.

The zero-qualified state now displays game exclusions automatically, suppresses the empty grid and its misleading Full Roster/Total TOI suggestion, and explains why cards are unavailable.29focused page/view tests plus the actual-reader Chromium partial/error/empty/all-excluded scenario passed. Scoped lint has no errors and the existing fixture-image warning. Production source repair remains unexecuted.
