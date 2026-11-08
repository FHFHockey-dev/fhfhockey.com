# BLSH device-local persistence: local review candidate

## Outcome

Implemented the approved device-local persistence slice without changing runtime snapshot pins, forecast producers/admission, source evidence, scoring, or the production-preview 404. This is local first-pass progress, not a production release or a claim that the full BLSH product is complete.

- V3 candidates have watch/unwatch controls, a visible local watchlist, individual removal and clear. Any saved identity absent from the displayed snapshot stays visible as unavailable and removable.
- New watch entries store only player ID and save time. They do not store research gaps, scores, target/horizon fields or forecasts. Older watch entries retain their original semantics/fields but their old comparison values are not displayed as current research.
- Trade selections restore after hydration and offer explicit Save, Load and Reset. Horizon/scoring settings are deliberately not persisted, and this is disclosed. Unsaved selections remain usable when local storage is blocked. Synthetic drafts have separate storage and cannot replace real saved drafts.
- Both surfaces disclose browser/device-local scope and no account sync. Existing draft, watchlist and market-reference sections survive changes to a different section. RSO keys are untouched.
- Trade evidence now leads with the saved FHFH Standard recorded-window gap, with index secondary and an explicit recorded-through date. History-withheld profiles show neutral text without a signed headline/index. Custom forecast scoring never rescales this retrospective evidence.
- The companion retrospective patch rejects empty, duplicated and cross-side offers before displaying totals. Inherited object names such as `constructor`, `toString` and `__proto__` are treated as unavailable IDs instead of evidence objects. See the separately owned retrospective guard receipt.

## Storage/version behavior

- Current real key: `fhfh.buyLowSellHigh.local.v2`; current synthetic key: `fhfh.buyLowSellHigh.fixture.local.v2`; JSON envelope version: 2.
- The previous `fhfh.buyLowSellHigh.local.v1` is only read when the real v2 key is absent. A valid v1 state is preserved verbatim apart from envelope version in memory, and copied to v2 only after an explicit successful user mutation. The old key is never deleted or modified. Fixture storage never imports v1.
- Clear/reset writes an empty section or a v2 empty state, rather than removing v2 and accidentally reviving retained v1 data on reload.
- Mount/SSR/hydration never writes. Invalid, future-version or unreadable data is left untouched and saving is blocked; no automatic destructive recovery. Storage-access and quota failures never claim successful saving.
- Mutations reread current saved state and preserve unrelated sections. Storage events refresh other tabs. Web Locks serialize cooperating tabs where available; browsers without Web Locks get latest-state merging and draft-conflict checks, not a guarantee of atomic simultaneous writes.
- A changed/deleted draft in another tab does not discard the current editor. Save/Reset rejects a conflicting baseline, and explicit Load accepts even a now-empty state. Fixture/real editor remounting prevents late fixture-save completion from changing a real editor.

## Verification

- Final focused suite: **73/73 passed**, four files: storage, candidate lists, trade comparison, retrospective guards. Includes original 13 v3 regressions, reload/removal/reset, initial SSR/hydration, retained missing IDs, invalid/blocked/quota storage, legacy migration/tombstone, section preservation, fixture separation, cross-tab conflicts/deletion recovery, deferred namespace switch, inherited property names and prototype preservation.
- Canonical full TypeScript and scoped lint: **passed on the final candidate**. Final receipts are `CHECKS.json`, `types-final.log`, and `lint-candidate.log`. The initial default-heap typecheck aborted at 4 GiB; a corrected 8 GiB Node 22.11.0 run passed. Final candidate confirmation is recorded in CHECKS.json.
- Actual Chromium component checks: **passed** at 1440×1000 and 390×844, using the previously authenticated immutable candidate and clearly synthetic trade records. Tested list navigation/top25/full, stale disclosure, all 115 no-history and 48 thin-history profiles, detail focus/Escape, sticky identity after mobile close, watch save/reload/remove/clear, v1 migration/reset, real two-tab updates/conflicts/deletion recovery, draft persistence/fixture separation/unavailable IDs, and invalid data preservation. No page errors or attempted non-loopback requests. See `browser.json`, `browser-final.log` and screenshots.
- The first browser launch hit the macOS sandbox MachPort restriction; reviewed escalation allowed the same loopback-only harness. The first authorized attempt exposed a harness-only shared-context setup error; it was corrected and the final run passed. These failed attempts are preserved separately, not counted as success.
- Source review: three findings were fixed and re-reviewed: cross-tab deletion recovery, pending fixture-to-real editor transition, and inherited evidence keys. See `../blsh-local-persistence-review-2026-11-07/REVIEW.md` and its final manifest.
- No full unit suite, full Next-route browser run, production request, remote build, deployment, DB/source request, holdout read, commit or push was performed by this worker. The trade route's production 404 remains unchanged; browser evidence does not validate a release.

## Candidate identity and remaining scope

`MANIFEST.json` pins each owned source/test/style and the relevant dependencies, including the companion retrospective patch. The shared checkout's HEAD changed during other lanes; this receipt does not claim the entire branch was isolated or verified.

The authenticated old research candidate remains SHA-256 `daf447b70fd8e08dc88a2e17162e0c1dd04863275cd7e23dbd923acca34e4485`. It was not repinned or refreshed. Available opportunity data, current qualified capture, source/baseline qualification and a safe real forecast consumer remain separate gates. Persisting an identity is not evidence that the player is currently a buy/sell recommendation. The existing v1 display remains unchanged and does not gain the v3 watchlist surface.

Owned application files: `web/lib/buyLowSellHigh/storage.ts`, `storage.test.ts`, new `useBlshLocalState.ts`; `web/components/buyLowSellHigh/BlshCandidateLists.tsx`, its test/style; `web/components/blshTrade/BlshTradeComparison.tsx`, its test, and `BlshTrade.module.scss`. Companion `retrospective.ts`/test changes were owned by the separate retrospective guard worker.
