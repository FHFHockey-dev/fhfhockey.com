# R-FLAGS read-only proposal

No implementation edits made. Canonical checkout is `octoberBranch`; the four initially named read/entity files have no current diff. Own runtime was already confirmed from matching `CODEX_THREAD_ID` session context as `gpt-6.1-sol/high`.

## Confirmed meaning defect and consumer dependency

- `web/lib/sustainability/score.ts:156-163,207-224`: canonical score combines negatively weighted conversion/finishing signals with positively weighted skill/chance-generation signals. It is a process-support index, not a direct observed-output-minus-expected-output measurement. Inverting over/under labels cannot fix that distinction.
- `web/lib/sustainability/read.ts:23-31,87`: score >=60 currently becomes overperforming, <=40 underperforming, and intermediate/nonfinite inputs can become stable. The existing unavailable shape already preserves both boolean keys as false and exposes `state: unavailable`.
- `web/lib/sustainability/entitySurface.ts:20-23,262-268` and `entitySurfaceServer.ts:640-670`: the legacy canonical adapter independently derives those same performance labels from raw score thresholds. Unified adapters read explicitly supplied expectation states separately at `entitySurfaceServer.ts:629-637,709`.
- `web/pages/trendsSandbox.tsx:373-431,2698-2745,2904`: current label/copy fallbacks call every other state Stable/On Pace/inside the player's usual lane, while the colored rail interprets raw process score as Cold/Usual/Hot. A reader-only unavailable enum addition would leave known false consumer claims. The three-state leaderboard also silently omits unavailable rows.

## Smallest complete compatibility-preserving correction proposed to Chef

1. Preserve read API numeric fields and boolean flag keys. Canonical flags always use `{ overperforming: false, underperforming: false, state: 'unavailable' }`. Add metadata explaining `score_semantics: process_support_index` and why observed-vs-expected performance is unavailable. Positive/negative/neutral process support must not assert any performance state.
2. Extend the sandbox expectation-state union with unavailable. Keep the legacy derivation function/call shape but return unavailable for all canonical inputs, including missing/nonfinite values. Add descriptive process-index provenance to legacy row normalization. Do not alter unified externally supplied expectation-state mapping.
3. Update only the nearest sandbox consumer's unavailable branch: Process support index / Performance unavailable with explanatory copy; hide the Cold/Usual/Hot rail and pointer; label raw score as raw process index. Preserve number rendering, neutral tone, existing unified state labels, and team/goalie behavior. Include a separate unavailable leaderboard group so rows remain visible without falsely entering stable/over/under groups.
4. Extend meaningful tests at existing reader/entity boundaries and add one focused mocked server test for legacy/unified contract separation. No source queries, score weights, priors, calibration, model, data, or forecast output changes; no Phase1 or gap-module promotion.

Exact requested implementation ownership (pending Chef reservation/authorization):

- `web/lib/sustainability/read.ts`
- `web/lib/sustainability/read.test.ts`
- `web/lib/sustainability/entitySurface.ts`
- `web/lib/sustainability/entitySurface.test.ts`
- `web/lib/sustainability/entitySurfaceServer.ts`
- `web/pages/trendsSandbox.tsx`
- New `web/lib/sustainability/entitySurfaceServer.test.ts`

Focused checks proposed: existing read/entity tests, new mocked server test, existing unchanged `web/__tests__/pages/api/v1/sustainability/player-read.test.ts`; Chef owns global type/lint. Extend positive/negative/zero/missing/NaN/Infinity coverage and verify unified overperforming/underperforming/stable inputs remain untouched. Browser runtime is separate from pure/mocked evidence.

No network, database, hosted/provider call, secret/env read, Git mutation, or tests were run in this read-only proposal pass. No implementation ownership was assumed beyond the initial analysis scope. Next action: Chef confirms/reserves the seven-file set before edits.
