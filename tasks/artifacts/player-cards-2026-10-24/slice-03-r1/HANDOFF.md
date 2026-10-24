# Slice03 R1 — unavailable-state/export/accessibility correction

Frozen author correction for independent re-review. Scout retains acceptance. Scope is only PC-S03-02(P2) and PC-S03-01(P3); no design overhaul or acceptance of TJ's unresolved visual direction. Accepted calculation R1 remains unchanged.

## Exact change

- `InteractiveCard.tsx`: an unavailable metric now carries a concise declared reason/state **inside the SVG that becomes the PNG**. Missing components say “Missing source · incomplete inputs”; complete zero-denominator metrics say “Undefined · zero denominator”; the selected full-N/no-appearance cases remain distinguishable. Inconsistent/unverified inputs retain unavailable-source wording. Values/ranks/settings/data are unchanged.
- The footer combines short-sample and missing/undefined tags rather than letting the short-season warning hide the source gap. Jamie’s three-appearance/missing-ixG PNG contains both “Known short season” and “Missing source,” plus the metric-level explanation.
- The SVG accessible name uses “GP unverified” when GP is null. It never interpolates null as an actual appearance count. Known zero remains a numeric zero.
- `PlayerCardFlow.tsx`: page availability derives from missing versus known-undefined readings. Complete zero-exposure data is described as undefined, not “Partial source.” Real source gaps keep their existing partial-source wording. Selection reasons still explain wholly unavailable history/periods.
- `PlayerCardFlow.test.tsx`:3 focused regressions added to the existing7 controls. No other application file, calculation, fixture, SCSS, dimensions or layout change.

Custody: CODEX-PLAYER-CARDS-S03-R1-20261024,17:55:39.283105UTC. Exact3baseline bytes/hashes preserved under `baseline/` before editing. `source.patch` is against those bytes. Original S03 packet/review/probes/failure outputs stay unchanged.

## Verification actually run

Passed:

1. From `web/`: `npm test -- --run components/player-cards/PlayerCardFlow.test.tsx` —10/10 (original7 +3 regression cases).
2. `python3 tasks/artifacts/player-cards-2026-10-24/slice-03-r1/run-check.py probes` —5/5 **byte-identical reviewer probes**, including PC-S03-01,PC-S03-02,PC-S03-02-zero and the interrupted-load/failed-export controls. Probe/setup bytes unchanged. Artifact-local config changes only test path/output custody. The original review source is never edited.
3. Same runner, action `types` —scoped TypeScript passed.
4. Same runner, action `lint` —three affected-file ESLint passed.
5. Same runner, action `render` —self-contained R1 HTML built with the existing renderer/esbuild/Sass, without modifying the frozen S03 HTML/server.
6. Same runner, action `browser` —**unchanged reviewer browser script**, byte-identical copy, against the R1 candidate. A temporary path-layout bridge supplies the new HTML and unchanged original comparison manifest without changing script assertions. Raw7/7 groups pass;2 actual1080×1080 PNG/manifest pairs; zero page HTTP(S) attempts/page errors. The unchanged post-export banner group is excluded from semantic assurance exactly as in the original assessment:6 usable groups passed.
7. Same runner, action `banner` —one focused offline Chromium check measures the initial zero-exposure banner **before any export**. It says metrics undefined, has no “Partial source,” preserves1GP/0TOI, and shows the zero-denominator explanation inside SVG. Passed with zero requests/errors.
8. Visual inspection of the actual corrected partial.png and zero-pp.png confirms the reasons are present and fit the existing layout. This is semantic/export QA, not design acceptance or native screen-reader execution.
9. Original artifact/probe/accepted-math integrity checked; detailed counts/hashes in EVIDENCE.json. Corrected partial/zero manifests equal the originals, proving this correction did not change their snapshot values/ranks/settings/coverage.

The initial copied-probe attempt passed10 owner cases but could not resolve testing-library from the new artifact folder. The original review used an artifact-local node_modules symlink; the correction harness added the same read-only-purpose link to installed web packages. The unchanged5 probes then passed without rerunning already-passed owner cases under that harness. Original failure log/command retained. No package install or dependency change.

Each artifact runner check atomically acquired/released its own shared heavy lock; no lock theft/wait loop. Commands, exact cwd/environment overrides, outputs and timings are retained in `*-command.json`/logs. Node22.11.0/npm10.9.0; no GIT_DIR. No whole-app tests/build or calculation re-review repeated.

## Existing preview availability

Parent reported no3125 listener while TJ was viewing. At the safe point the worker confirmed no listener and verified the original frozen S03 HTML and static server hashes. Under the parent's explicit restoration instruction, **only the unchanged last-served S03 preview was restored**, PID76261/session88560, bound127.0.0.1:3125. One credential-free local staticGET returned200,317312bytes, original SHA`c50ecfbe2fc56955c085c5ff1adfadef9d5a393c39f2a2ad1fb4b6aebe854357`, exact equality. Receipt: restore-runtime.json. No other process was stopped or server touched.

**R1 is not served or activated.** Existing http://127.0.0.1:3125/player-cards intentionally remains the old frozen S03 artifact while R1 awaits independent acceptance and a separately coordinated content handoff. New candidate: `slice-03-r1/preview.html`. The cause of the earlier server absence was not established.

## Remaining gates / boundaries

- Independent R1 re-review and any subsequent explicit3125 content handoff remain pending. No action has an uncertain outcome; no automatic approval denial. The temporary environment-unavailable context cleared before file work.
- TJ's design references/direction remain unresolved; no visual redesign undertaken. Phone/share-size readability remains separate design feedback.
- All observed-source/history/completion/model/strength/full all-NHL population/rights, canonical route/auth/entitlement and exact free/premium decisions remain unchanged gates. Synthetic fixtures do not establish live readiness.
- No production/provider/service read/write, publication/deployment, Git/index, new worker, dependency/migration, shared source or Library retry/workaround. One authorized old-preview restoration and local staticGET are recorded separately from file-only R1 browser checks.
