# Audit packet: VuDu

Master entries M-VUDU-001 to M-VUDU-003 (3 of 3 in this family). Built from the merged Opus and Codex inventories; see [../MASTER.md](../MASTER.md) and [../MERGE-NOTES.md](../MERGE-NOTES.md).

How to read: each entry gives both inventories' descriptions side by side. **Conflicts** are places where the two descriptions disagree; they are unresolved. **Leads** are Opus red flags and Codex unknowns: observations to check, not audited findings. Tags are keyword heuristics. Line numbers were valid when each inventory was written on 2026-11-10 (Opus at d31dcb33f, Codex at 11e4192d3); re-check against the current checkout.

| ID | Name | Match | Conflicts | Leads |
|---|---|---|---:|---:|
| M-VUDU-001 | VuDu save gap (expected SV prob minus recent SV%) | Both | 0 | 2 |
| M-VUDU-002 | VuDu observed goalie results (SV%, GAA, starts, start share) | Both | 0 | 1 |
| M-VUDU-003 | VuDu expected goalie ratios and gap status | Opus only | 0 | 1 |

## M-VUDU-001 VuDu save gap (expected SV prob minus recent SV%)

- **Match:** Both; Opus VUDU-001; Codex core-007
- **Purpose:** Goalie sustainability gap in saves per 100 on-net shots.
- **Where:** `web/lib/sko/gap.ts:72 (vuduSaveGap)`; `web/lib/sko/gap.ts:73 vuduSaveGap`
- **Tags (heuristic):** generation: legacy, development
- **Opus view (VUDU-001):**
  - Method: if population != 'on_net_shots' -> null; recentSV = saves/shotsOnNet (ratio of totals); gap = 100*(expectedSaveProb - recentSV). Positive = goalie has underperformed expectation (rebound).
  - Inputs/units: probability 0-1; counts; sources: —
  - Output scale: saves per 100 on-net shots; writes: —
  - Status: draft — only tests call it (tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md:46)
  - Consumers: tests only
- **Codex view (core-007, calculation, location; Codex family 'SKO/VuDu'):** VuDu save gap
  - Formula: 100*(expectedSaveProb-recentSaves/recentShotsOnNet); other populations null.
  - Purpose: Describe expected versus observed performance without predicting quality or market value.
  - Inputs/units: Expected save probability fraction; recent saves; on-net shots; matching event population.
  - Output scale: Additional saves per 100 on-net shots.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Pure Phase0 contract; distinct from legacy sKO. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no tracked/untracked status entry at the final stat…
- **Audit context:**
  - Intent (Opus): VuDu = goalie side of the sKO contract; gap awaits accepted goalie adapter (interpret.ts:188; blsh-sko-vudu-audit-2026-11-04.md:32)
  - Intended contract (Codex core-007): Same target, horizon and strength state required; gap.ts comments. Pure Phase0 math, no legacy product wiring: web/lib/predictions/legacyQuarantine.ts:120.
  - External references: GSAx per shot / dFSV% (MoneyPuck, Evolving-Hockey); Fenwick-based xSV% must not be compared with ordinary SV%
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `Located only; not run for this inventory.`; `web/lib/sko/gap.test.ts`
- **Leads (not audited):**
  - (opus) no live adapter; any xG model in the repo built on unblocked attempts returns null by design
  - (codex:core-007) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-VUDU-002 VuDu observed goalie results (SV%, GAA, starts, start share)

- **Match:** Both; Opus VUDU-002; Codex core-014
- **Purpose:** Recent and prior-block goalie ratios for the VuDu view.
- **Where:** `web/lib/skoElement/interpret.ts:149 (goalieResults)`; `web/lib/skoElement/interpret.ts:149 goalieResults`
- **Tags (heuristic):** percent scale: fraction 0-1; denominators: per 60, per team game; generation: development, current
- **Opus view (VUDU-002):**
  - Method: Validate saves+GA = SA, saves <= SA; SV% = sum saves / sum SA; GAA = 60*sum GA / sum minutes; starts = count appearanceType 'start' (only if all known); relief = appearances - starts; startShare = starts / team games in window.
  - Inputs/units: counts; minutes; sources: —
  - Output scale: SV% fraction; GAA goals/60; writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: SkoElementPreview VuDu table
- **Codex view (core-014, calculation, location; Codex family 'Sko Element'):** Goalie observed and forecast ratio context
  - Formula: Pooled observed saves/shots and 60*GA/minutes; expected ratios from expected totals.
  - Purpose: Read-only interpretation of observed evidence and FORGE forecast; no learned SKO weights.
  - Inputs/units: Observed saves, shots against, goals against, minutes; expected FORGE totals.
  - Output scale: SV fraction; GA/60; descriptive context only.
  - Version/status: Local octoberBranch at d31dcb33f72d4c9d69b507874c388f0cd549fe2f (2026-11-10). Sko Element new-contract fixture/interpretation core; config acceptance is caller-supplied. Deployment and persisted-data state not verified. The scan was non-atomic: HEAD later changed to 11e4192d36ecc4ac4b338f9ab48e529c7049c618; no full historical revalidation was performed. Referenced implementation files had no trac…
- **Audit context:**
  - Intent (Opus): interpret.ts:188 VuDu gaps await goalie adapter; ratios shown as context only
  - Intended contract (Codex core-014): Source limitations at interpret.ts:314: descriptive, not probability/trade instruction; expected values unchanged; no predictive-spread model. VuDu gap awaits accepted goalie adapter.
  - External references: NHL SV% and GAA definitions
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `Located only; not run for this inventory.`; `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/skoElement/interpret.test.ts`
- **Leads (not audited):**
  - (codex:core-014) ["Calculation inventory only; formulas and inputs have not been vetted."]

## M-VUDU-003 VuDu expected goalie ratios and gap status

- **Match:** Opus only; Opus VUDU-003; Codex —
- **Purpose:** Passes FORGE expected SV% / GAA / expected starts through; gap pending.
- **Where:** `web/lib/skoElement/interpret.ts:174 (interpretGoalie)`
- **Tags (heuristic):** percent scale: fraction 0-1; generation: development, current
- **Opus view (VUDU-003):**
  - Method: Pass-through with validation (SV% <= 1, non-negative, horizon match, not expired); gap.status always 'pending_goalie_adapter'.
  - Inputs/units: ratios; sources: —
  - Output scale: SV% fraction; GAA; writes: —
  - Status: draft — fixture stage (contract 'sko-interpretation-v0.2'); used by lib/skoElement/fixtures.ts -> /sko-element/preview and lib/buyLowSellHigh/market.ts; preview 404s in production per tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md
  - Consumers: SkoElementPreview
- **Audit context:**
  - Intent (Opus): interpret.ts:188
  - External references: none suggested
  - Fixtures/test data: `web/lib/skoElement/fixtures.ts`; `tasks/artifacts/blsh-sko-vudu-audit-2026-11-04.md`
  - Tests: `web/components/skoElement/SkoElementPreview.test.tsx`; `web/lib/skoElement/interpret.test.ts`
- **Leads (not audited):**
  - (opus) no VuDu gap is computed anywhere in live code

