# Player cards slice 01 — synthetic preview frozen for review

Local implementation only. Scout owns integration, decisions and independent acceptance. This packet is the worker's evidence, not acceptance.

## View and deliverables

- **http://127.0.0.1:3125/player-cards** — loopback-only static synthetic preview. Server PID54140, exec session58351; source `serve-preview.mjs`. GET `/` and `/player-cards` only; no directory serving, app shell, auth, Next cache, API or upstream access. Codex browser panel open returned queued, so no claim that TJ has seen it.
- `preview.html` — self-contained artifact with CSP blocking external connections; works as a local file. Includes scenario selection, fixture-only search, optional extra card, text-size metric reading, PNG and local manifest downloads.
- `preview.png` — actual exported 1080×1080 PNG, visually inspected. Contains synthetic/example label, values/ranks/percentiles, four categories, sample/strength/dates/cutoff/snapshot/pool context. Controls excluded.
- `manifest.json` — exact displayed fixture snapshot/settings/render+registry/source versions, game IDs, pool ID and per-metric population/results plus selected metrics/capability flags.
- `source.patch` / `EVIDENCE.json` — all nine new source files, exact source/artifact/dependency hashes, checks and limitations. `qa-*.png` are internal visual-QA captures, not Library deliverables.

## Source changes and requirement coverage

- `web/lib/player-cards/{contracts,registry,ranking,fixtures}.ts`: versioned synthetic snapshot/configuration; 12 proposed NST metric mappings with units/formulas/provider identity/category/validity/allocation status; pure numeric rank and coverage suppression. No remote imports.
- `web/components/player-cards/{PlayerCard,PlayerCardPreview}.tsx` and `PlayerCard.module.scss`: FHFH token-based fixture UI and fixed-square SVG card; same displayed SVG rasterized using native browser canvas. No shared export/auth/entitlement changes.
- Two colocated tests cover hand-checkable ranks, ties, zeros/undefined, precision, missing/unknown/incompatible pools and identity duplication; synthetic presentation/search/scenarios and export mismatch/failure/retry.
- Tasklist tracks 1.0,2.4,3.0 and6.1–6.3 as locally implemented. This does not complete2.0, real application5.0, full export acceptance6.4, premium7.0 or release8.0. Registry/snapshot shape is an initial synthetic contract, not final observed adapter acceptance.
- Proposed defaults/layout/rank convention remain labeled and configurable at the contract boundary. Preview period stays fixed at proposed L10/All Strengths; L5/L20/calendar controls are not fake-enabled.
- All premium/live capability flags are false. Existing in-season access only grants RSO capabilities; no card entitlement inferred.

## Checks actually run

Passed after final source changes:

1. From `web/`: `npm test -- --run lib/player-cards/ranking.test.ts components/player-cards/PlayerCardPreview.test.tsx` — 2 files,10/10 tests.
2. From `web/`: `npx tsc --noEmit --project ../tasks/artifacts/player-cards-2026-10-24/slice-01/tsconfig.json` — passed scoped source/tests with existing Next bootstrap.
3. From `web/`: `npx eslint lib/player-cards components/player-cards` — passed.
4. `node tasks/artifacts/player-cards-2026-10-24/slice-01/render-preview.mjs` — self-contained artifact built using installed esbuild/Sass, web's installed React pinned in artifact resolver.
5. `node tasks/artifacts/player-cards-2026-10-24/slice-01/qa-preview.mjs` — isolated offline Chromium,10/10 checks; zero HTTP(S) attempts and zero page errors. Actual PNG+manifest download, long/missing/short/extra desktop captures, mobile overflow and text view, search and real keyboard focus.
6. PNG signature/IHDR inspection —1080×1080. Visual inspection of exported PNG, mobile and long-name/missing-source captures.
7. One sequential credential-free local GET to3125 —200,290437 bytes, exact equality/hash with frozen HTML. No production request.

Original failures and corrections retained:

- Input transfer helper failed downloads in sandbox and escalated environment. Complete Library text reconstruction returned has_more=false; restored final newline to exact source byte sizes, then supported identity helper succeeded. `../INPUTS.json` pins original documents (PRDv1/tasklistv0); tasklist checkbox edits are a local derivative, not Library writeback.
- Initial scoped TS harness omitted existing next-bootstrap; fixed include, no shared file edited.
- Initial Chromium launch blocked by macOS sandbox; isolated file-only offline launch succeeded with reviewed escalation.
- Initial generated HTML bundled two React copies because artifact entry lives outside `web/`; browser exposed null useState. Artifact resolver now pins web React/react-dom. No source/dependency change needed.
- Initial focus assertion used pointer modality; changed QA to actual Tab input. Focus outline then observed. No assertion weakened.

Not run: whole repository suites, whole-app type/lint/build, shared app browser/auth, real search, production/NHL/NST/Supabase APIs, cron/backfill, deployments, Git/index mutations, dependency installation, premium protected endpoints. Node22.11.0/npm10.9.0 used; no GIT_DIR.

## Remaining blockers and next bounded slice

- **Library output pending due transfer environment:** supported current batch upload helper fails before preparation at hosted-app discovery (`DNS` sandbox, `TLS` escalated). No output Library ID and no uncertain Library mutation. Per Library flow, no direct-upload workaround attempted after helper start. Local HTML/PNG remain readable and viewable. Library input identities are preserved.
- **Pure domain work unfinished:** exact supplied appearance selection/completion/season/window contracts and pooled aggregation are next. Proposed files `web/lib/player-cards/windows.ts`, `aggregation.ts`, `domain.test.ts`, `adapter.ts` would need exact coordinator recording before creation. No upstream WiGO repair duplication.
- **Observed integration:** current WiGO snapshots/readers cannot establish requested periods or all-NHL coverage. Completion proof, all-position population, source definition/universe, supported strengths/freshness and rights still require evidence. No new production read authorized.
- **App page/search:** candidate `web/pages/player-cards.tsx` stays absent/ungranted. Existing search imports Supabase; shared app auth may write profiles. Requires safe permitted interface and exact route lease after preview review.
- **Product decisions:** initial N/strength/season-only/short-sample rule; free/optional/premium allocation and comparison export scope; proposed ties/percentile/export design. Dependent behavior remains disabled; independent local pure-contract work can proceed.
- **Premium:** no server/export enforcement implemented or accepted. Exact entitlement contract and allocation pending; no paid payload exists in this synthetic packet.

No action denied by auto-review, no production/service writes/reads, no new workers, no spend/deploy/Git operation. Server remains running for TJ's requested view; do not interfere with3000/3105/3110 or Claude caches. Diary remains because the broader task is unfinished.
