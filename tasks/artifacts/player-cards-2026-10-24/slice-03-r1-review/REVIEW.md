# Player-card S03-R1 independent re-review

**ACCEPT WITH LIMITS — P2 PC-S03-02 and P3 PC-S03-01 resolved** for this exact three-file correction. All three original failing controls pass **unchanged**. Focused verification: **8 passed / 9 intentionally skipped**, scoped TypeScript/ESLint passed, and **4 focused offline browser groups passed** with two actual 1080×1080 PNG exports, zero page HTTP(S) attempts and zero page errors. **161/161 recorded paths remain unchanged**, including 92 preserved original artifacts. No new defect was reproduced within this correction. Scout retains acceptance.

## Finding resolution

- **PC-S03-02, missing-source export explanation:** Jamie's short partial sample now contains both “Known short season” and “Missing source” in the PNG footer; ixG/60 itself says **“Missing source · incomplete inputs.”** Its null value and unavailable rank remain unchanged. The actual new [partial.png](partial.png) was inspected; no explanation depends on external details.
- **PC-S03-02, known undefined versus missing source:** the one-appearance/zero-PP-TOI case says **“Some metrics undefined: zero denominator or selected period policy.”** This was measured **before any export**. The SVG/PNG says **“Undefined · zero denominator”**, retains GP 1 / TOI 0 and valid ATOI 0, and contains no missing-source label. [zero-pp.png](zero-pp.png) and its manifest preserve the original values/ranks/settings/coverage.
- **PC-S03-01, accessible GP:** unverified history now uses **“GP unverified”** in the SVG accessible name, with no literal null appearance count. A genuinely verified zero-appearance calendar remains **“0 actual appearances.”** Both unverified/zero-appearance cases keep PNG disabled. Native screen-reader execution is not claimed.

Adjacent controls verify that full-N policy exclusion is labeled undefined/full-N, rather than missing source, and retains the known actual GP. No changes to accepted calculations, fixture data, settings, SCSS, dimensions or layout were found in the incremental patch. Actual pixel inspection checked semantic/export correction only; this is not design acceptance or design polish.

## Exact pins and preserved evidence

Correction patch SHA-256: `fe8f1016d2c87f5eca1e50357b27396758daf51e42453065d8a1d67511a1a7ee`. EVIDENCE.json: `ced5c93b3ae6f43625a385420cb284eff0746b27d7184e35cadcc633ee77ef56`. Corrected file-only HTML: `6c29f6eb3dc6ffc9a6a8a546423f78ac3e6e5e1e7265129475724422d3aad9b5`.

| Canonical file | Corrected SHA-256 |
| --- | --- |
| `web/components/player-cards/InteractiveCard.tsx` | `70b6edce10ffe219817c64f2c4763a8e58091b9c59f9b77fb2a68aa2b7d33271` |
| `web/components/player-cards/PlayerCardFlow.tsx` | `036c44fb865ac729e2ddfba06bf0d6205d983bf9f89133c88f20918869302e30` |
| `web/components/player-cards/PlayerCardFlow.test.tsx` | `0ce3fb52c6f19fcea4d5f0755924faab1472cda1b4e1fa704396e1b4176c8579` |

The three owner baseline copies equal their pre-correction hashes. A fresh three-file unified diff against those copies equals the supplied `source.patch` exactly. [PINS.start.json](PINS.start.json) and [PINS.end.json](PINS.end.json) record the 50 new packet source/artifact entries, 62 preserved prior review pins, additional failure receipts and protected original artifacts, deduplicated to 161 paths. All 92 owner-enumerated original artifacts were independently checked against `protected-before.json`.

The original [interaction-controls.test.tsx](../slice-03-review/interaction-controls.test.tsx) is still SHA-256 **`091811cf04c4c99784e184c01594c10a4bdd59f2b7bbd142c9e87821cacc06a1`**. It was executed directly, using a name filter; no assertion/source copy was edited. Original `focused-ui.log`, `zero-state-banner.log`, browser failures/results and SHA256SUMS remain intact. The accepted math dependency pins match; its calculation acceptance was not repeated or broadened.

Both independently downloaded manifests are **byte-identical to the original failing-review manifests**. Both corrected PNGs are **byte-identical to the owner's corrected browser exports**, and differ from the original images as expected. [EXPORT-INTEGRITY.json](EXPORT-INTEGRITY.json) records these checks. This substantiates unchanged data with corrected presentation.

## Exact focused checks

Node 22.11.0 / npm 10.9.0 / Vitest 3.2.7; cwd `web/`; no `GIT_DIR`. Existing installed dependencies only. Each check acquired/released only its own shared heavy lock. Original seven UI behavior cases and two previously passing reviewer interaction controls were intentionally skipped. The owner's broader 15-case claim was not substituted for the independently executed focused set.

```text
npm test -- --run --config ../tasks/artifacts/player-cards-2026-10-24/slice-03-r1-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
exit 0: 8 passed / 9 skipped; original 3 failures + owner 3 exact semantic regressions + independent 2 policy/zero-GP controls. 1.779 s command wall time.

npx --no-install tsc --noEmit --project ../tasks/artifacts/player-cards-2026-10-24/slice-03-r1/tsconfig.json
exit 0; 1.046 s.

npx --no-install eslint components/player-cards/InteractiveCard.tsx components/player-cards/PlayerCardFlow.tsx components/player-cards/PlayerCardFlow.test.tsx
exit 0; 0.736 s.

node ../tasks/artifacts/player-cards-2026-10-24/slice-03-r1-review/browser-controls.mjs
exit 0: 4/4 focused groups; 2 PNG exports; 0 page HTTP(S) attempts/errors; 1.250 s.
```

[ALL-COMMANDS.json](ALL-COMMANDS.json), individual logs and [browser-results.json](browser-results.json) retain argv, environment/timing and observations. No check failed or remains blocked in this re-review. Offline Chromium used the reviewed sandbox exception already known to be necessary from the preserved original review; no redundant failed sandbox launch or broad browser suite was repeated. It loaded only `slice-03-r1/preview.html` in an isolated context, with HTTP(S) aborted and offline mode enabled.

## Limits and next custody

Acceptance is for the frozen functional/export/accessibility correction. TJ's unresolved design direction and existing observed-source/population/rights/app-auth/entitlement gates remain separate. The accessible DOM name was checked, not native assistive-technology behavior. No production or live-data readiness is inferred.

This reviewer changed no application source, calculation, server, live route, Git/index, dependency, Library item or shared configuration; no workers were spawned. No request to 3125 was made, and the existing old S03 preview was untouched. The corrected file-only artifact was not served/activated by this review. Any content handoff remains a separate coordinated action. Original failures remain preserved; no moving-source re-test is authorized by this acceptance recommendation.
