# Shareable FHFH Player Cards Implementation Tasks

Status: PARENT REVIEWED for dispatch to one Sol worker. TJ authorized task generation and bounded local implementation on October 24, 2026; the product defaults and exact paywall allocation remain review decisions.
PRD: `tasks/TASKS/prd-shareable-player-cards.md`.
This is a cloud planning copy, not a file installed in the local FHFH repository.

## Relevant Files

- `tasks/TASKS/prd-shareable-player-cards.md` — requirements, evidence, authorization boundary, and unresolved product decisions.
- `tasks/tasks-prd-shareable-player-cards.md` — this task list; update checkboxes with verified work and concise evidence.
- `web/lib/player-cards/` — proposed isolated domain/adapter namespace; confirm it is absent and permitted before creating it.
- `web/components/player-cards/` — proposed isolated card/control namespace; confirm repository conventions and absence first.
- `web/pages/player-cards.tsx` — candidate local page for `/player-cards`, not an assigned route until collision/convention checks pass.
- Existing `fetchWigoPlayerStats.ts`, `calculate-wigo-stats.ts`, `fetchWigoPercentiles.ts`, `calculatePercentiles.ts`, `RateStatPercentiles.tsx`, and `update-nst-gamelog.ts` — read-only integration references. Resolve their actual repository paths during preflight; do not assume permission to edit them.

## Notes

- User authorization: “We should now turn that into a task list, and then send it out to a Sol worker, in a new thread. I'd like to be able to see it when possible.” The parent reviews this list and creates that visible thread; this planning task does not dispatch or implement.
- One Sol worker owns the bounded local implementation. The parent owns cross-workstream integration/review and decisions. Current repository instructions, work leases, and file owners are authoritative. Do not edit FORGE, RSO, or Claude-owned files without an explicit ownership transfer.
- Allowed scope is local, non-production work in an agreed isolated namespace, fixture-driven previews, and existing supported verification commands. No production reads/writes, source fetches/backfill, Git operations, dependency installation, spend, deployment, credential/permission changes, or operational repairs are included. A separate diagnostic grant is not inherited by this worker.
- Reuse existing installed dependencies and repository-supported tools. If an integration needs a shared-file edit, new package, environment change, or unsupported source access, report the exact dependency and continue independent work. Do not quietly broaden authority.
- The separate WiGO repair/diagnostic owns its operational fixes. Card implementation may consume parent-supplied evidence or approved local snapshots through a read-only adapter, but must not fix upstream ingestion or run its endpoints as a side effect.
- Parent-supplied live evidence is bounded to Kucherov (8476453): two approved SELECTs/68 rows/no writes, L5 5/5 source-game matches with stored null WiGO values, L10 9/10, and independent L20 frames 13/20. No `wigo_rates` row existed for him and STD totals matched; do not call the override code risk his established cause. Read the local diagnostic report named in the PRD before choosing an adapter. This is not league coverage or permission for another production query; upstream code-fix approval remains pending and refresh/backfill is unapproved.
- L10, All Strengths, regular-season/skaters-only scope, season-boundary/incomplete-N behavior, numeric tie/percentile conventions, and 1080-square styling remain proposals where the PRD says so. Keep them explicit/configurable in local work; a synthetic preview is not product approval. The exact free/premium allocation is undecided and must not block independent free-card/UI work.
- Dependency order: 1 establishes ownership; 2 defines shared contracts; 3 delivers the early fixture preview. After 2, visual/free/export work (3, 5, 6) can progress independently of the observed-data evidence gate in 4. Premium scaffolding in 7 can follow 2/5 with capability flags off. Task 8 joins the tracks. These are work tracks for the one Sol worker, not authority to start more workers.
- Use focused tests where they prove meaningful behavior and run existing relevant aggregate checks at integration. Do not create a redundant new test for every checkbox. Record passed, failed, blocked, and not-run checks separately. Unresolved coverage must produce honest unavailable states, not a fake league rank.

## Tasks

- [x] 1.0 Confirm bounded ownership and integration boundaries
  - Owner: Sol; parent approves cross-workstream handoffs. Prerequisite: parent review of this list. Trace: PRD authorization, Technical Considerations.
  - [x] 1.1 Read repository/AGENTS instructions, relevant local skills, current leases, and the supplied investigation report. Locate the app's routing, card primitives, existing installed export tools, identity mapping, and entitlement conventions without running production reads or endpoints.
  - [x] 1.2 Confirm the proposed `web/lib/player-cards/`, component namespace, and candidate `/player-cards` route are absent, collision-free, and unowned. Record the agreed exclusive scope; ask the parent before taking over an existing path or changing a shared entry point.
  - [x] 1.3 Create a short integration/decision record listing verified reusable interfaces, protected read-only files, proposed defaults, source/rights unknowns, and the separate WiGO repair dependency. Record exactly which behavior is blocked by each open decision while keeping independent fixture/free-card work moving.
  - [x] 1.4 Verify the authorized local run/check commands and available dependencies. Report any required shared-file edit, installation, permission change, or external access to the parent before attempting it.

- [ ] 2.0 Define card data and calculation contracts
  - Owner: Sol domain track. Prerequisite: 1; no live source access required. Trace: PRD §§2–5 and Technical Considerations.
  - [ ] 2.1 Define typed settings/snapshot/coverage contracts and a metric registry with provider mapping, category, units, numerator/denominator, TOI units, strength, season type, precision, eligibility, availability, and entitlement capability. Keep metric values, known undefined values, and missing/incomplete data distinct.
  - [ ] 2.2 Implement pure own-L5/L10/L20 and inclusive-calendar window selection from supplied records: common cutoff before taking N, unique appearance IDs, actual GP and span, strength-specific exposure, and zero-PP-time appearances retained. Represent known short season history separately from missing rows among actual appearances. Do not invent a final-game signal or silently cross seasons.
  - [ ] 2.3 Implement pooled count/rate/share calculations with verified seconds/minutes conversions and denominator rules. Separate individual generation, opportunity, on-ice context, and finishing/involvement. Preserve provider/model event-universe identity; do not substitute unblocked xG for on-net expected save percentage.
  - [x] 2.4 Implement the proposed configurable competition-rank/midrank convention over a metric-specific all-valid-player pool, with no position, active-roster, recency, minimum-TOI, or minimum-GP filter. Compare canonical unrounded values. Suppress league ranks when source completeness is unknown, while retaining valid individual values.
  - [ ] 2.5 Verify the pure contracts with concise hand-checkable fixtures: [10, 8, 8, 2], all tied, one/zero values, valid zeros, nulls, zero denominators, near-equal rounded displays, incomplete-N versus missing rows, cutoff/season boundaries, and differing metric pool sizes. Keep proposed policy choices identifiable for parent review.

- [x] 3.0 Deliver an early synthetic visual preview
  - Owner: Sol visual track; parent reviews the first usable preview. Prerequisite: 1 and minimal 2.1 contracts; do not wait for live data or the paywall split. Trace: PRD §§3, 6 and Design Considerations.
  - [x] 3.1 Build a clearly labeled synthetic-data fixture card in the isolated component namespace using current FHFH charcoal/cyan primitives. Show a curated readable arrangement and four distinct categories; mark example values/ranks as synthetic, never live NHL evidence.
  - [x] 3.2 Include player context, actual GP/TOI/units, window mode and actual dates, strength, game cutoff and snapshot time, source/example label, raw rank/pool count, and percentile explanation. Keep PP context separate and preserve a text equivalent for graphical indicators.
  - [x] 3.3 Demonstrate mobile and desktop layouts plus a proposed 1080-square export frame with controls excluded. Exercise long names, large rank counts, missing rows, partial windows, and optional extra-card composition without shrinking text into illegibility.
  - [x] 3.4 Provide the parent a visible local preview or verified captures through the supported environment flow as soon as it is usable. Identify the proposed design/defaults needing review; continue independent contracts/free-flow work while awaiting feedback, without treating silence as approval.

- [ ] 4.0 Build a read-only observed-data adapter with coverage gates
  - Owner: Sol adapter track; parent supplies investigation/diagnostic evidence. Prerequisites: 1–2 and applicable source evidence. Does not depend on design approval. Trace: PRD §§2–5, 8 and Technical Considerations.
  - [ ] 4.1 Map inspected NST/WiGO contracts to the registry and verify actual local inputs/approved supplied snapshots, identity joins, units, strengths, season/date semantics, and game-completion evidence. Read the bounded Kucherov diagnostic and verify source-window alignment rather than reusing current WiGO blindly. Record what is confirmed versus unknown; do not infer completeness from one player, schema fields, or HTTP 200.
  - [ ] 4.2 Implement an adapter boundary that accepts explicit cutoff/season/strength/window and a snapshot identity. Reject or mark affected metrics unavailable for stale/null overwrites, prior-season totals, independent source windows, failed reads, missing TOI joins, duplicate games, or unverified completion. Do not call the existing repair/ingestion handler to generate data.
  - [ ] 4.3 Implement metric-specific coverage summaries: valid, known undefined, missing/incomplete, and honestly short-N populations. Require verified full eligible-population coverage before emitting an NHL rank. Keep synthetic/provider-incomplete outputs visibly distinct.
  - [ ] 4.4 Reconcile a bounded set of already authorized local records/snapshots against pooled inputs and the source definitions. If reliable inputs are unavailable, finish the adapter contract/unavailable states and report that exact integration blocker; do not fetch production, backfill, or patch WiGO as a workaround.

- [ ] 5.0 Implement the free search and curated card flow
  - Owner: Sol application track; parent owns shared navigation integration. Prerequisites: 2–3; use fixtures until 4 passes its data gates. Trace: PRD §§1–4, 6 and Design Considerations.
  - [ ] 5.1 Add the collision-checked isolated local page and player search through a verified permitted read interface. Resolve stable NHL IDs, duplicate names, team changes, absent portraits, and no results; do not expose credentials or silently select a different player.
  - [ ] 5.2 Connect period and verified-strength selectors, optional metrics/extra cards, and explicit loading, stale, partial, unavailable, and error states. Use the approved or visibly proposed configuration; prevent stale navigation/search results from overwriting a newer selection.
  - [ ] 5.3 Keep anonymous/basic card access and PNG entry free. Keep meaningful optional advanced discovery configurable pending the exact allocation, rather than blanket-gating every advanced metric. Provide plain-language interpretation without a quality composite, forecast, automatic winner, or recommendation.
  - [ ] 5.4 Verify keyboard/touch access, contrast, repeated selections, interrupted loading, retry, Back/Forward, and desktop/mobile readability using supported local tools. Escalate any shared route/navigation edit instead of changing another workstream's file.

- [ ] 6.0 Implement snapshot-consistent PNG export
  - Owner: Sol export track. Prerequisites: 2–3 and the free preview contract in 5; observed data is optional until verified. Trace: PRD §6 and acceptance §§8.1, 8.4.
  - [x] 6.1 Use an existing approved installed export mechanism to render only the card from one immutable displayed snapshot/settings/render version. Keep controls, navigation, paywall prompts, and loading skeletons out of the PNG. Report a dependency blocker rather than installing an export package.
  - [x] 6.2 Include readable identity, all metric units/values/ranks/pool counts, period and actual sample/span, strength, game cutoff/snapshot time, FHFH branding, and source/coverage attribution. Synthetic exports must retain a prominent synthetic/example label.
  - [x] 6.3 Preserve a bounded local reproducibility manifest with included game IDs, source/data/registry versions, pool identity/counts, settings, and render version. Do not create new persistent cloud storage or promise indefinite retention; make retention an explicit integration decision.
  - [ ] 6.4 Verify PNG dimensions/legibility, long/missing-content cases, preview/export equality, repeated clicks, source refresh during export, safe retry, and failed-render behavior. Record the provider/asset-rights release gate separately from technical export success.

- [ ] 7.0 Add disabled premium capability scaffolding
  - Owner: Sol capability track. Prerequisites: 2 and 5; independent of final metric paywall decisions. Trace: PRD §§1, 7 and Open Questions.
  - [ ] 7.1 Reuse verified existing in-season monthly/season entitlement semantics through an isolated capability interface. Add no billing, price, checkout, or subscription change. Default unapproved premium features/metric allocations off in non-fixture behavior.
  - [ ] 7.2 Build synthetic/local two-player comparison capability using one cutoff, metric/strength definition, mode, and league pool for both. Show separate own-last-N date spans, GP/TOI, unavailable metrics, and numeric differences without a winner. Treat comparison export as optional pending scope approval.
  - [ ] 7.3 Design and verify protected data/export boundaries so direct calls cannot retrieve gated payloads and public caches/artifacts do not leak premium material. Do not treat hidden buttons as access control; keep public free endpoints usable.
  - [ ] 7.4 Give the parent a concise capability/allocation proposal for TJ's decision. Activate only the approved split and comparison/export scope; unresolved choices remain disabled without blocking acceptance of independent free-card/synthetic work.

- [ ] 8.0 Integrate, verify, and deliver the bounded local result
  - Owner: Sol assembles evidence; parent integrates/reviews across workstreams. Prerequisites: applicable completed tracks 1–7 and their explicit gates. Trace: PRD §8 and Success Metrics.
  - [ ] 8.1 Run the complete local search-to-card-to-PNG flow with labeled fixtures, then with already authorized observed snapshots only where 4 establishes validity. Verify matching values/context, source/strength/season/cutoff semantics, all-valid metric pools, unknown-coverage suppression, and unavailable states.
  - [ ] 8.2 Run relevant existing lint/type/test/build checks against the final code and focused calculation/UI/export/security checks. Record exact commands and passed/failed/blocked/not-run outcomes; rerun affected checks after later edits. Do not imply a focused pass is a full repository pass.
  - [ ] 8.3 Deliver the early-preview/final-local evidence, actual owned files, requirement coverage, unresolved product decisions, source/rights gaps, and separate WiGO dependencies to the parent. Distinguish synthetic-only, adapter-complete, observed-verified, and release-blocked states; list the exact smallest authority/input needed for each remaining blocker.
  - [ ] 8.4 Stop at a reviewable bounded local result. Do not deploy, commit/push, run production reads/writes/backfill, change permissions, install dependencies, or declare a public launch. Unresolved external gates may leave a feature disabled; report them clearly rather than declaring the entire production feature complete.

## Local slice 01 evidence — 2026-10-24

- Fixture-only preview and PNG implemented in nine new granted namespace files. Tasks checked above cover only this bounded result; no observed/premium feature is accepted. Candidate app page remains absent/ungranted.
- Evidence: `tasks/artifacts/player-cards-2026-10-24/slice-01/HANDOFF.md` and `EVIDENCE.json`. Local view: `http://127.0.0.1:3125/player-cards` (static synthetic artifact, no shared auth).
- Passed: 10 focused Vitest tests, scoped TypeScript/lint, 10 offline headless Chromium checks, actual 1080×1080 PNG, one local HTTP byte-equality check. No app build, production/service request or deployment. Parent independent acceptance pending.
- Proposed L10/All Strengths/season/rank/layout choices remain explicitly labeled. Pure window/aggregation contracts, real source adapter/coverage, verified search, configurable periods and reviewed entitlement boundaries remain unfinished.
- Library output blocked before upload preparation: current supported batch helper app discovery fails DNS in sandbox and TLS outside it. No Library output IDs or uncertain writes. Input Library identities remain associated with their exact original document hashes in `INPUTS.json`; local task checkbox edits are a working derivative, not a Library replacement.
