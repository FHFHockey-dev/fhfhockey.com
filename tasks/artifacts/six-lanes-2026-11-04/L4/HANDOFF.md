# L4 checkpoint — offline trade-value contract proposal

Current status: the Chef-granted observation-only application slice is installed and narrowly verified. See [APP-INTEGRATION.md](APP-INTEGRATION.md), [APP-MANIFEST.json](APP-MANIFEST.json) and [APP-CHECKS.json](APP-CHECKS.json). The offline checkpoints below retain their historical scope; their pending app-grant/no-app-edit statements are superseded by that receipt.

Latest evidence update: [DECISIONS-AND-NEXT-ADAPTER.md](DECISIONS-AND-NEXT-ADAPTER.md) and [DECISION-RECEIPTS.json](DECISION-RECEIPTS.json) now recover all five original user response pairs, closing the earlier primary-decision provenance gap. The next adapter is executable only as an isolated artifact; installed observation files remain unchanged.

Current implementation update: Chef subsequently granted the two projected-points component files. [VALUATION-APP-INTEGRATION.md](VALUATION-APP-INTEGRATION.md) is the latest application receipt; the component is now installed without a production caller. It adds unconditional-target/future-game gates, passes 9 Vitest cases, targeted lint and focused TypeScript with actual app ES2015 options. The observation trio remains unchanged; combined valuation/roster/source work remains unavailable and incomplete. Earlier artifact-only adapter status is historical.

2026-11-04. Owner: `01a1a8bc-9929-7f40-9168-b346dcc9bccb`; Chef: `01a1a86a-6dc1-72ae-a9c9-f29e9367c020`.

**Result:** one isolated, compiled contract proposal and 12 passing synthetic checks. No application integration, market capture, valuation formula, roster engine, schema, provider/production request or Git mutation. This is ready for Chef review, not a claim that the trade pipeline or all six lanes are complete.

## Settings and custody

- Requested dispatch: GPT-6.1 Sol/medium. Chef: user-confirmed GPT-6 Astra/high. `read_thread` did not expose worker model/reasoning metadata, so no independent runtime confirmation is claimed. This is a telemetry limitation, not a renewed historical dispatch hold.
- Canonical checkout: `octoberBranch`, base `b4cf80631b16bab148a0cd1f0e05886090f2673c`. Existing user/Claude dirty files preserved.
- Assigned L4 directory and diary were absent before creation. Targeted searches of both lease registers and mailboxes found no explicit conflicting claim for this namespace or proposed `web/lib/tradeValue` paths. This is an observation, not a new canonical lease. Initial artifact grant comes from Chef's dispatch; shared code custody is unchanged.
- Only writes: this directory's `contracts.ts`, `checks.ts`, `SOURCE-PINS.json`, `HANDOFF.md`, and `tasks/diaries/2026-11-04-codex-six-lanes-l4.md`.
- Exact proposed future paths: `web/lib/tradeValue/contracts.ts`, `web/lib/tradeValue/observationEvidence.ts`, `web/lib/tradeValue/observationEvidence.test.ts`. Directory was absent at observation. These paths remain ungranted pending Chef/L1 clearance; recheck immediately before an eventual write. No need to edit existing Yahoo, cards, BLSH, navigation or provider files for this slice.

## Decision reconciliation

| Evidence | What it establishes | Limit |
| --- | --- | --- |
| `tasks/artifacts/blsh-brief-decisions-2026-11-03/DECISIONS.md`, decision 6 | Shared league-aware pipeline; source/context/date visibility; full bundles; no independent player prices from bundle observations; explicit unavailable inputs; ADP/ownership context | Repository record says pop-up answers are verbatim; original user-message receipt is not embedded |
| `tasks/artifacts/trade-value-pipeline-2026-11-04/PLAN.md`, §7 D1–D4 | Later quoted choices: collection/storage/public display; scrape/upsert; wider universe; VOR + actuals + projections; weighted ADP and suggestion guard with buy-low override | These are the planner's quotations. Independent primary user-message evidence was not recovered in this bounded pass. They are recorded as reported amendments, not newly applied operational authority |
| `CLAUDE-TO-CODEX.md`, `CLAUDE-BLSH-DECISION-LANES-20261104` | Distinct BLSH implementation lanes; decision 6 explicitly planning-only | Does not independently prove the later §7 amendments |

No weights, normalizations, guard thresholds, universe size or collection cadence are chosen here. In particular, the plan's approximately 700-player universe and 96/day cadence are planner interpretations, not values in the quoted “Wider daily universe” answer. Later collection preferences do not authorize this worker to collect, store, migrate or schedule anything.

**Remaining provenance dependency:** Chef needs the original Claude pop-up/user-message receipts for §7 D1–D4, especially the weighted ADP amendment, before marking those amendments authenticated. The current ticket forbids new collection regardless; independent interface work is still useful. No fresh Yahoo policy/legal conclusions are asserted or re-researched in this offline pass.

## Code-to-contract delta

| Existing surface inspected | Preserve/reuse | Delta in this proposal |
| --- | --- | --- |
| `web/lib/player-cards/analysisEvidence.ts` | Public card source/date/sample checks and conflict refusal | Rich observation is separate from legacy `give`/`receive`; every side and raw asset survives. Nullable pick season/round/owner/condition, unknown assets, unresolved Yahoo identities; never fabricate IDs to satisfy card shape |
| `web/lib/buyLowSellHigh/market.ts` | Scalar comparison requires matching unit, scoring, horizon and freshness | Observation has no scalar market price. Do not adapt a bundle into `MarketReference` or call the scalar gap a market conclusion |
| `web/lib/buyLowSellHigh/trade.ts` | Existing scored forecast package comparison and incomplete-input handling | It remains raw production, with no roster benefit or acceptance implication. New valuation/roster envelopes do not relabel its results |
| `web/lib/integrations/yahoo/yahooIdentity.ts` | Unique bidirectional Yahoo→FHFH map under game/season scope | NHL ID remains separate from FHFH ID. Identity result needs both plus scope and receipt. No name matching or new database read implemented |
| `verifiedForgeReleases.ts`, `externalInputProof.ts`, `consumerRevisionAdmission.ts` | Existing producer provenance and consumer admission remain authoritative | A listed closure alone is insufficient. Future adapter must use actual admitted consumer outputs, issuance, expiry and league/horizon compatibility; string receipt in this proposal is only an envelope field, not proof validation |

## Proposed v1 interface for L5 review

`contracts.ts` names independently versioned observation, coverage, valuation and roster-impact envelopes. Each unavailable value has reasons and no numeric zero substitute. Legitimate numeric zero remains representable as available. Available envelopes are typed outputs of future trusted adapters; they are **not** runtime parsers or proof validators for untrusted provider JSON.

- **Observation:** capture/sighting/parser lineage; scoped source event or null; full ordered sides; raw dates/assets; nullable league context; synthetic/observed label; explicit display audience/attribution. Picks are retained without valuation. A missing mapping does not erase the observed asset or turn its value into zero. Missing sides are withheld as incomplete evidence.
- **Identity:** game and season, Yahoo key, FHFH player ID and NHL player ID remain distinct. Verified mapping/bridge is a future adapter dependency, not certified by this helper.
- **Coverage:** not captured, blocked, parse failed, verified empty and sightings are distinct. Includes universe, capture, time, request/receive/identity counts. No absence of records implies zero market activity; an empty state needs a verified source marker. No live coverage estimate exists.
- **Valuation:** league profile origin/version, horizon/cutoff, forecast issuance/admission/expiry and separate VOR/actual points/rank/projected points/ADP results. Combined value requires versioned method, normalization and validation receipt; leave unavailable until those exist. Category vectors and goalie support require a later accepted utility contract; do not force them into a scalar.
- **Roster impact:** entered assets, roster snapshot and league rules version; explicit legality; before/after players, required drops/open slots; independently available production delta. Deeper lineup, pick ownership and roster rules must be checked by the future engine. No roster calculation exists in this artifact. Counterparty acceptance is always unavailable.

This proposal is not frozen for production. L5 can plan against these boundaries and explicit unavailable states while Chef reviews the exact types. A future full roster engine must extend the consequence envelope for slot assignments, dates, eligibility and replacement decisions before claiming complete legal roster simulation.

## Executable slice and verification

`selectObservationEvidence` is deliberately public Trade Market evidence only. The unused audience option has been removed; no connected-league audience capability is exposed. League-transaction evidence remains withheld until a separate same-league authorization adapter exists. The helper retains sightings; only a supplied event identity with explicit source/game/season and nullable league key establishes event counts. A league-scoped ID requires its league key; if the source cannot prove the ID scope, event must remain null. Event source/game/season must match the observation, and the dedup key includes all four scope fields plus event ID. It never clusters identical bundles into an asserted transaction, infers player prices, creates offers or hides an entered offer using a guard. It refuses conflicting sightings/events, wrong samples, invalid/future times, missing lineage or use receipts. Its returned references are read-only at the TypeScript boundary; it does not deep-freeze objects.

Source-use/event/identity proof fields require trusted upstream verification. Nonempty strings and supplied event IDs alone do not make real data qualified. No legacy-card projection is attempted: the current card cannot losslessly represent third sides, unknown assets or unmapped players. A future projection must refuse unsupported records or obtain a separate card-owner contract update.

Checks actually run:

```sh
web/node_modules/.bin/tsc --strict --skipLibCheck --target ES2022 --module commonjs --types node --typeRoots web/node_modules/@types --outDir /private/tmp/fhfh-l4-contract-01a1a8bc tasks/artifacts/six-lanes-2026-11-04/L4/contracts.ts tasks/artifacts/six-lanes-2026-11-04/L4/checks.ts
node /private/tmp/fhfh-l4-contract-01a1a8bc/checks.js
```

Both passed: isolated strict TypeScript compile and 12 focused synthetic checks. Checks cover full three-side retention including unresolved picks/unknowns, distinct sightings without source IDs, one proven event across captures, event conflict refusal, event source/game/season/league collision isolation and mismatched-scope refusal, sighting replay, private/public exclusion, absent source-use receipt, future/sample mismatch, unavailable empty evidence and no input mutation. No full-app typecheck, lint, build, browser, live identity read, source-use validation, forecast admission or numerical valuation test was run or implied. Temporary compiled files are outside the repo.

`git diff --check` passed for the owned paths but untracked artifacts are not included in that check; isolated compilation and content inspection cover the actual added files. Source hashes are pinned in `SOURCE-PINS.json`; they describe this review's inputs, not a release candidate.

## Next bounded action

Chef reviews the contracts and synthetic results, recovers primary decision receipts, then grants the three exact new app paths through L1 custody if accepted. Move only the reviewed observation/types slice into the application, add the nearest focused tests under that new namespace and keep valuation/roster results unavailable. Collector/schema/schedules and shared-card projection remain separate future tickets with their own ownership and current-action bounds. No additional attempt or shared-code write was taken in this pass.

## Chef correction receipt

The one requested correction is complete and remains isolated. Removed `options.audience`; replaced arbitrary event namespace strings with typed source/game/season/league scope, added observation game/season, and included all scope fields in the event key. Same-ID fixtures now differ across game, season and league, with differing content so an accidental collision would fail. Another fixture refuses event source/game/season mismatches. Private league sources remain unsupported.

Strict isolated TypeScript compilation and all 12 synthetic checks passed after the correction. The first correction compile caught an unreachable league-source branch after public-source narrowing; that redundant branch was removed before the successful compile. Supplied receipts, source flags and event scopes remain asserted inputs, not authenticated permission, identity or source-event proof. No application integration, source collection or broader verification followed. Stop at the agreed correction cap; primary provenance and any future app custody remain with Chef.
