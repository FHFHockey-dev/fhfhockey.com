# W09 A-versus-B scenarios handoff

## Delivered contract

- `ScenarioComparisonWorkspace` is the W07 mount surface. It owns authenticated premium generation, naming, save, names-only list, payload open, loading/error/exact-operation retry, account/eligibility/context clearing, request cancellation, stale-response rejection, and stale saved-input messaging. The existing ProjectionsTable comparison remains the free comparison; this workspace never calculates or displays premium roster impact while inactive.
- `scenarioAnalysisSchema` is the bounded client-to-server contract. The client submits analysis inputs only; the server computes the DUST result, fingerprint, and serialized output.
- `evaluateScenarioDust` resolves the persisted W06 season mapping and schedule rows, evaluates the exact scenario roster and two candidate IDs with `evaluateDraftProDust`, and preserves freshness/window/diagnostics and unavailable states.
- Saved-private projection inputs require both an owned saved draft and every selected owned, non-deleted private import attached to that draft. The server re-reads each validated saved blob and matches its normalized-row content fingerprint. No import data is uploaded by scenarios.
- `compareDraftProScenarios` is read-only and reusable by W10. It provides baseline, after-A/after-B, and incremental point/VORP/category effects; role-correct category totals; workload-weighted SV%/GAA; position needs; and DUST effects.

## W07 integration

Build one `ScenarioInput` from existing dashboard state and mount:

```tsx
<ScenarioComparisonWorkspace
  eligible={draftProAccess.capabilities.includes("scenarios")}
  input={scenarioInput}
  draftId={openedSavedDraftId}
/>
```

`scenarioInput` must contain the unchanged current roster, two distinct available undrafted candidates, league type, enabled category weights, position needs, the projection identity/version/origin, and the existing schedule season/game-key/week range/lineup mode/roster slots. Players provide the existing raw VORP/rank value, point projection when available, category values, team, eligibility, and projection season. For `saved_private_import`, W07 must block analysis while any selected import's local rows, column mapping, or source identity differs from the opened account-saved import. It then supplies the owning `draftId` and every distinct selected `{ id, contentFingerprint: scenarioFingerprint(normalizedRows) }`; the projection `id`/`version` must identify the saved mapping/source composition. W07 must not pass client-authored DUST results or result fingerprints and need not implement scenario lifecycle behavior.

## Verification

- `npm test -- lib/draft-pro/scenarios.test.ts lib/draft-pro/scenariosServer.test.ts lib/draft-pro/api-tests/scenarios.test.ts` — exit 0; 3 files, 19 tests passed.
- `npm test -- hooks/useDraftProScenarios.test.tsx components/DraftDashboard/ScenarioComparisonWorkspace.test.tsx` — latest exit 0; 7 request/context/account/list/retry lifecycle tests and 4 workspace tests passed. Earlier workspace and schedule-fixture attempts exposed test-isolation, matcher-setup, and empty-roster precedence issues and were corrected.
- `npm test -- lib/draft-pro/scenariosContract.test.ts` — exit 0; 2 duplicate-input rejection tests passed.
- `NODE_OPTIONS=--max-old-space-size=8192 ./node_modules/.bin/tsc --noEmit` — final exit 0. The first captured run exited 2 and identified four local type errors; all were corrected.
- Scoped ESLint over all W09 implementation/API/hook/test files — exit 0.
- Sass compilation of `ScenarioComparisonPanel.module.scss` with the project styles load path — exit 0.
- A later combined lint command also named `tasks/draft-pro/W09-HANDOFF.md` while running from `web/`; ESLint exited 2 because that relative path did not exist from the command directory. No code lint finding was reported.
- `git diff --check` — run before final commit.

Dependencies came from the ignored symlink to the approved W02 `node_modules`; no install, manifest, or lockfile change was made. No full suite, build, provider call, deployment, or production mutation was run.

## Limitations

- This work order intentionally does not mount the workspace in central `DraftDashboard.tsx`; W07 owns that file.
- The existing free ProjectionsTable two-player comparison remains untouched. W09 roster-impact analysis is premium and hidden while inactive; only saved scenario names remain visible and locked.
