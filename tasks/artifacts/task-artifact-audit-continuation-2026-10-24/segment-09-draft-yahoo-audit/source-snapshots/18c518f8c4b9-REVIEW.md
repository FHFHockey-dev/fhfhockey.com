# Player-card slice01 independent review — 2026-10-24

**ACCEPT WITH LIMITS** for the frozen synthetic preview. No implementation defect was reproduced within its fixed L10/All-Strengths fixture scope. All **43 owner pins match**; the additions-only patch reconstructs exactly the **nine canonical files**. **15 unique offline cases are verified passing** across bounded runs (10 owner + 5 independent); exact-file scoped TypeScript and ESLint pass. Actual saved PNG pixels were inspected, including long/missing/short/extra/mobile examples. This is not final product/design, observed-data, public launch or general export acceptance.

**Design finding D1, for TJ:** at phone fit-to-width size, rank/unit/footer text is small. The page has a text-size alternative; the PNG does not. This is nonblocking feedback on the proposed synthetic layout, and final mobile sharing legibility remains unaccepted under task 6.4. It is separate from a calculation or data-state bug.

## Exact frozen candidate and pixel evidence

- `source.patch` SHA-256 **`5f88e8e7220b7bf14ce7ea2b16f821c0b2387277f0e9b1f2accb7da3d316987e`**. Reconstructed all nine added files byte for byte; every file matches EVIDENCE.json. Full hashes are in [PINS.start.json](PINS.start.json), [PINS.end.json](PINS.end.json) and [SCOPE.json](SCOPE.json).
- `preview.png` SHA-256 **`582677f8ae867b46a6cbb83f242e6e92388d2ab3b782421cde7180e3dfd710e8`**, valid PNG signature/IHDR **1080×1080**.
- `preview.html` SHA-256 **`12ea13e78fb64cfc136292f1d9c1babb8189ad034da2151b4473a6b030d7c2bf`**, 290437 bytes; no external `src`/`href` attributes and CSP `connect-src 'none'` in the saved document.
- `manifest.json` SHA-256 **`bfa316174940dcfe6970aac7f1937f989ce60946ec406d6f517bc1ad85630807`**, exactly matches the current deterministic curated fixture, selected metrics and inactive capability flags.

[VISUAL-REVIEW.md](VISUAL-REVIEW.md) records actual pixel inspection and the eight visible value/rank/population/percentile combinations. The curated export matches the manifest: ATOI 21:21 / T-161 of 812 / 79.7; SOG/60 11.80/T-161 of 809/79.7; iSCF/60 9.40/T-160 of 803/79.6; ixG/60 1.24/T-160 of 800/79.6; on-ice xGF/60 3.62/T-157 of 791/79.7; on-ice xG% 58.7/T-157 of 788/79.6; IPP 76.9/T-157 of 785/79.6; SH% 14.6/T-155 of 782/79.8. Percent values retain their `%` unit; ATOI uses min:sec per appearance.

At saved desktop/export size, labels, values, categories and footer are visible without observed clipping or overlap. The long-name example wraps above team context. The missing ixG source produces an em dash/reason with no rank/bar; incomplete on-ice xG% comparison coverage retains the valid 58.7% value and explains rank unavailability. The partial example explicitly states 3 of 10 and its shorter sample; extra composition replaces rows within the frame. Prominent synthetic and fabricated-cohort labels remain inside the exported image; controls do not.

## Independent consistency controls

1. Recreated each of the twelve explicitly fabricated metric cohorts, sorted the values independently, and checked ordinal rank and midpoint percentile against the same population. Valid zero remains eligible; a known undefined ratio is excluded. Frozen supplied pool rows remain unchanged.
2. Compared saved manifest snapshot/settings/versions/game IDs/selected metrics/capabilities exactly to current fixture output; sample GP and ATOI agree with TOI.
3. Rendered missing, valid-but-unranked and observed-zero readings together. Missing/unranked rows have no rank bars; zero displays 0.00 with rank 2 of 2 and 25.0 percentile, including the correct 116px/464px bar width.
4. Compared current SVG text with the retained browser receipt for all four frozen scenarios, without running a browser.
5. Intercepted the SVG Blob handed to the mocked rasterizer. It is exactly the displayed clone with only width/height 1080 and class removal, retains the synthetic label, omits controls, and leaves displayed DOM/snapshot unchanged. This verifies the handoff, not a new canvas pixel render.

The rank helper's full-population boolean and definition key are caller-supplied contracts; they do not prove NHL coverage. All-value pools, metric-specific denominators, same-pool numeric midrank labels and cautions are correctly represented for these fabricated examples. There is no hidden GP/TOI/position qualifier in the inspected helper. The registry declares proposed/unverified provider definitions and allocation; no observed source rights, xG model compatibility or premium entitlement is accepted here.

## Checks, original failures and boundaries

Runtime: Node 22.11.0 / npm 10.9.0 / Vitest 3.2.7. All commands run from `web/`, with no `GIT_DIR`, one worker, isolated reviewer cache and an atomically acquired/released shared heavy lock. No browser, HTTP request, server command, real client or provider was used. No application file changed.

```text
npm test -- --run --config ../tasks/artifacts/player-cards-2026-10-24/slice-01-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
exit 1: owner 10 passed; reviewer suite did not collect (reviewer file-URL harness error).

npx --no-install tsc --noEmit --project ../tasks/artifacts/player-cards-2026-10-24/slice-01-review/tsconfig.json
exit 0: explicit frozen source/test includes, avoiding the owner's namespace glob that now includes slice 02.

npx --no-install eslint lib/player-cards/contracts.ts lib/player-cards/registry.ts lib/player-cards/ranking.ts lib/player-cards/ranking.test.ts lib/player-cards/fixtures.ts components/player-cards/PlayerCard.tsx components/player-cards/PlayerCardPreview.tsx components/player-cards/PlayerCardPreview.test.tsx
exit 0.

npm test -- --run --config ../tasks/artifacts/player-cards-2026-10-24/slice-01-review/review.vitest.config.mts tasks/artifacts/player-cards-2026-10-24/slice-01-review/independent-controls.test.tsx --maxWorkers=1 --no-file-parallelism
exit 1: independent 4 passed; one assertion expected one space before a tspan separator where textContent contains two.

npm test -- --run --config ../tasks/artifacts/player-cards-2026-10-24/slice-01-review/review.vitest.config.mts tasks/artifacts/player-cards-2026-10-24/slice-01-review/independent-controls.test.tsx -t "keeps missing, valid unranked and observed-zero presentations distinct" --maxWorkers=1 --no-file-parallelism
exit 0: corrected reviewer whitespace normalization only; 1 passed / 4 intentionally skipped. Exact rank/population/percentile/bar assertions retained.
```

[ALL-COMMANDS.json](ALL-COMMANDS.json) records argv, elapsed time and individual logs. Original initial tests, file-URL failure, whitespace assertion and read-only patch-header parser error are preserved. These were reviewer harness issues, not owner failures. Successful owner/static checks were not repeated after reviewer-only corrections. No remaining review check is blocked.

Owner evidence remains intact: original scoped-TS bootstrap failure, browser sandbox/duplicate-React/focus failures, Library transfer failures, final 10 browser checks and local HTTP equality receipt. The retained browser record has 10 passes, no HTTP(S) attempts and no page errors; this reviewer inspected that record and saved pixels rather than repeating it. Static HTML inspection does not establish runtime network behavior by itself.

One extra context pin changed concurrently: `tasks/tasks-prd-shareable-player-cards.md`, from `6f2bc7e8f1b0ec976fbfcf6ee04194f1b3c3fd859af7672998021056b9047e38` to `2b51400721602dac3bb6dbf568d9e515c095fb9493d09366744b4798980f3477`. Its current tail adds slice 02 evidence. This mutable tasklist is outside the frozen 43 pins; the PRD and all nine frozen source files remain unchanged. No slice 02 source was reviewed or edited, and no acceptance is inferred for it.

Scope limits: fixed synthetic L10/All-Strengths labels and timestamps are acceptable for these fixtures; the component is not accepted for arbitrary settings or observed payloads. The export's dataset-ID guard is not a content hash or a trusted snapshot store. Real windows/pooled aggregation, missing-source population coverage, safe app search/auth, entitlement enforcement, source/asset rights, generic settings rendering and final race/export/browser coverage remain separate gates. Full feature task 6.4 and TJ design approval remain open. The Library output blockage is owner-reported and was not retried. Port 3125 and all existing browser/server slots were untouched. Scout retains acceptance.
