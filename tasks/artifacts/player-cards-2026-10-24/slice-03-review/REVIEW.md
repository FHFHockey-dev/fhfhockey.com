# Player-card S03 independent functional/export review

**CHANGES REQUIRED** for two finite presentation findings: **P2 PC-S03-02** loses the unavailable-value explanation from an export and labels known undefined metrics as a source problem; **P3 PC-S03-01** announces unverified GP as “null actual appearances.” Calculation R1 remains accepted and unchanged. This review does not assess or accept design; TJ's new design references and direction remain separate.

All **59 explicit owner pin entries plus 6 reviewer input pins match before and after**. Six additions reconstruct exactly from `source.patch`. Focused UI verification: **9 unique cases passed / 3 failed**, across two bounded runs, with three counterexamples for these two findings. Scoped TypeScript/ESLint passed. Offline Chromium reproduced both findings, exported two PNG/manifest pairs, and made **zero page HTTP(S) attempts / zero page errors**. No application repair was applied; Scout retains acceptance.

## P2 PC-S03-02 — preserve unavailable-state explanations in the card/export

Affected: [InteractiveCard.tsx](/Users/tim/Code/fhfhockey.com/web/components/player-cards/InteractiveCard.tsx:23), its warning precedence at line 29, and the availability banner in [PlayerCardFlow.tsx](/Users/tim/Code/fhfhockey.com/web/components/player-cards/PlayerCardFlow.tsx:62).

**Counterexample A:** select Jamie Chen, ID 1004; own L10; All Strengths; allow known short history; source case `metric-gap`. The snapshot correctly records ixG/60 as null/missing, with reason **“Required component is missing, invalid or has incompatible TOI units.”** The PNG instead prints “Unavailable · see sample/source state.” The footer prints only “Known short season · proposed policy,” because the short-sample warning takes precedence over the missing-source warning. The exported image contains no missing/incomplete-source explanation. The external text details and manifest cannot supply context to a shared standalone PNG.

Reproduction in the existing fixture viewer or equivalent saved file: `?player=1004&mode=appearances&n=10&strength=all&case=metric-gap`. Test `[PC-S03-02]` fails on the SVG before rasterization. The actual independent [partial.png](partial.png) is **byte-identical to the frozen owner's partial.png**, SHA-256 `2803b585f3ae61e0b431cbd5d7e5d2fb1cfb2e14e6a753055c6bd0caa5919c84`; [partial-manifest.json](partial-manifest.json) exactly equals the owner's manifest and retains the reason absent from its pixels. This is a missing explanation, not a numeric mismatch or fabricated zero.

**Counterexample B:** choose ID 1001, shared UTC calendar 2026-10-01 through 2026-10-01, Power play, complete source. One actual appearance and observed TOI 0 are correctly retained; ATOI is valid 0 while per-60 ratios are known undefined. SOG/60 coverage is **0 valid / 18 knownUndefined / 0 missingIncomplete**, with full population verified. The banner nevertheless says **“Partial source: affected values and ranks are unavailable.”** The PNG uses the same generic unavailable wording instead of identifying the undefined denominator. This conflates known undefined values with missing/incomplete source data, contrary to the existing PRD 4.3/5.2 and export-context 6.3 requirements.

Repro query: `?player=1001&mode=calendar&start=2026-10-01&end=2026-10-01&strength=pp&case=complete`. The single supplemental `[PC-S03-02-zero]` control fails on the initial banner. [zero-pp-manifest.json](zero-pp-manifest.json), [zero-pp.png](zero-pp.png) and the retained first offline body establish the actual data/state distinction.

Bounded correction recommendation: render a concise declared unavailable reason/state inside the SVG; preserve both short-sample and source-gap context; derive the page availability wording from missing versus known-undefined states rather than the coarse `partial` card flag. This needs no change to accepted window/rank math or broad visual redesign.

## P3 PC-S03-01 — avoid a null-valued accessible GP label

[InteractiveCard.tsx:12](/Users/tim/Code/fhfhockey.com/web/components/player-cards/InteractiveCard.tsx:12) interpolates nullable `sample.gp` into its `role=img` accessible name. With `?case=history-gap`, the visual card correctly says **“GP unverified”**, GP/TOI remain null in the manifest and PNG download is disabled. The accessible name says **“null actual appearances.”** The unchanged semantic assertion fails in `[PC-S03-01]`, and actual Chromium DOM reports the same name. Use the existing unverified-GP wording for the accessible name. This is a DOM accessibility finding; no native screen-reader execution is claimed.

## Passing functional boundaries

- The owner's seven focused UI cases passed. Two independent controls passed for three interrupted loads with mixed old success/rejection and latest strength/window selection; and repeated export clicks, failed export, multiple queued history changes, latest-state application and retry from the new snapshot.
- Actual file-only Chromium kept duplicate Alex Morgan identities separate, restored the selected player/window/strength through real Back/Forward, and matched downloaded manifest state to the displayed card.
- Unknown comparison coverage retained individual values and withheld every rank. Unverified history, stale source and source errors disabled PNG; missing exposure stayed null. Complete zero-PP exposure preserved one GP/zero TOI, valid zero ATOI and undefined ratios rather than manufacturing per-60 zeros.
- Two actual 1080×1080 PNG downloads completed. Partial manifest and PNG equal the frozen owner exports; zero-PP image/manifest use the same snapshot identity and sample. Saved L5/calendar/partial and newly exported pixels were inspected for functional labels/context only. No design polish or design acceptance is included.

## Exact candidate and checks

- Source patch: `3f77f9e6ccb49230f968da700f34749ead296270c96c6197bb814e5eaebf348c`
- EVIDENCE.json: `4d13665443e114d138d9f55082542f5509674ab67317b76b320eadb8f2d9b80d`
- Frozen HTML: `c50ecfbe2fc56955c085c5ff1adfadef9d5a393c39f2a2ad1fb4b6aebe854357`
- InteractiveCard.tsx: `181a0cd3dd36b14433ce845c864209ce36103ecf14853037826faf6bec8e06fe`
- PlayerCardFlow.tsx: `83d75fc766229367aa7599b89413f9dc1b8754b00910bd75bf4b0e20f22d0926`

[PINS.start.json](PINS.start.json) and [PINS.end.json](PINS.end.json) record all exact source/artifact/dependency inputs; no drift. The accepted R1 dependency/review pins match. The supplied packet's summary claims about other historical artifacts are not substituted for these explicit pin checks.

Runtime Node 22.11.0 / npm 10.9.0 / Vitest 3.2.7. Commands below run from `web/`; no `GIT_DIR`. Each check acquired/released its own shared heavy lock. Exact argv/environment/timing appear in [ALL-COMMANDS.json](ALL-COMMANDS.json).

```text
npm test -- --run --config ../tasks/artifacts/player-cards-2026-10-24/slice-03-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
exit 1: owner 7 + independent 2 passed;2 independent finding controls failed (9 pass / 2 fail).

npm test -- --run --config ../tasks/artifacts/player-cards-2026-10-24/slice-03-review/review.vitest.config.mts -t PC-S03-02-zero --maxWorkers=1 --no-file-parallelism
exit 1: 1 failed / 11 intentionally skipped. This adds only the zero-denominator banner counterexample; no passing cases repeated.

npx --no-install tsc --noEmit --project ../tasks/artifacts/player-cards-2026-10-24/slice-03/tsconfig.json
exit 0.

npx --no-install eslint lib/player-cards/interactionFixtures.ts lib/player-cards/interactionSnapshot.ts components/player-cards/PlayerCardFlow.tsx components/player-cards/InteractiveCard.tsx components/player-cards/PlayerCardFlow.test.tsx
exit 0.

node ../tasks/artifacts/player-cards-2026-10-24/slice-03-review/browser-controls.mjs
final exit 1: raw 7 browser groups, 5 pass / 2 fail; 2 PNG exports; 0 page HTTP(S) attempts/errors.
```

The raw browser result includes one passing availability-banner group measured **after** export replaced the banner with its download-success message. That group is excluded from assurance: **6 usable groups = 4 passed / 2 failed**. The initial page body and separate targeted UI control prove the pre-export banner defect. [BROWSER-ASSESSMENT.json](BROWSER-ASSESSMENT.json) explains this exclusion; original raw results are unchanged.

Original sandbox Chromium launch failure is preserved. A reviewed escalation allowed file-only offline Chromium. Initial heavy-lock refusals are preserved; retry occurred after release, with a bounded wait and no lock theft. The first offline attempt timed out because the reviewer awaited the exact ready-message on a legitimately computed zero-exposure partial-availability card. Its script, log and body remain intact. Only the completion wait changed to enabled-manifest/SVG readiness; substantive failing findings remain. No broad browser script, whole suite or calculation re-review was repeated. No check remains blocked.

No production/live data/authenticated route, Library retry, Git, server start/stop, port 3125 request, shared browser slot, package change or new worker was used. All application sources stayed read-only. The separate observed-source, app/auth/entitlement, rights and activation gates remain unchanged. Await a new frozen correction for re-review; do not test moving owner files.
