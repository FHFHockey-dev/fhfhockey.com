# Transaction Trends unmapped-row investigation

Follow-up: [REPAIR.md](REPAIR.md) records new bounded current evidence and an executable, locally verified three-player metadata repair. Production remains unchanged. The findings below describe the initial retained-evidence-only pass.

## Ownership and scope

2026-11-12: local fixture-only investigation on octoberBranch, starting at `24b1cb4d3048a3dba8234cf92c62e8f2b72f877f`.

Exact owned paths:
- `web/__tests__/pages/api/v1/transactions/ownership-trends.test.ts` (baseline SHA-256 `ba1df0a5c3d68a720a7c9a0bd89147ab5c560036bc0801319a0862bf6c156825`)
- This handoff.
- `tasks/diaries/2026-11-12-codex-transaction-trends-unmapped.md` (working notes, keep local).

Read current AGENTS, coordination protocol, both lease registers, recent mailbox handoffs, and dirty state. The earlier Transaction Trends source claim was released after the November 10 deployment; neither lease register contains an active transaction API/test hold. The claimed test has no prior diff. Other dirty files and coordination notes remain untouched. No source, schema, provider-writer, release or production custody claimed.

## Findings and evidence limits

The November 10 result establishes **2,065 source rows without an accepted exact seasonal-key NHL mapping**, out of 4,438 fetched Yahoo rows. It does **not** establish 2,065 distinct missing NHL players, current-season players, visible movers, or missing ownership histories. A complete per-cause partition of those 2,065 rows is unavailable from the retained evidence inspected here.

Evidence reused, without new remote reads:

| Evidence | What it establishes | Limit |
| --- | --- | --- |
| `tasks/artifacts/trends-production-release-2026-11-10/PRODUCTION-SMOKE.json` | Post-fix 2,373 mapped / 2,065 unmapped, 89 risers / 200 fallers; request has no season filter; source date November 10 | Aggregate receipt, no retained residual keys or individual mapping reasons |
| `tasks/artifacts/homepage-cold-2026-11-10/read-only-evidence.json` and its handoff | Mapping view inventory: 2,373 rows, all full seasonal keys, zero numeric IDs; previous reader used numeric lookup | Inventory and smoke are separate observations, not a simultaneous source/mapping export |
| `/tmp/home-trends-after.json`, `/tmp/home-trends-cached.json` | Byte-identical **pre-fix** captures: 0 mapped / 4,438 unmapped, 20 paged movers, all with `477.p.*` keys and null playerId | Despite the filename, these predate the seasonal-key fix. None of the 20 can be labelled a member of the post-fix 2,065 from these files |
| `web/pages/api/v1/transactions/ownership-trends.ts` | `mappedPlayerCount` is membership of each source row's exact key in the accepted map; totals precede result pagination and are independent of timeline/position/movement eligibility | Current local code behavior, not a fresh production census |
| `supabase/migrations/20260824152127_yahoo_live_draft_production_hardening.sql:583` | Canonical reader admission rules; legacy mapping data only decorates an already admitted identity | Schema evidence identifies possible exclusion causes, not the number of production rows in each cause |

The prior reader/schema mismatch is already fixed and released as recorded in the November 10 handoff. Matching the 2,373 mapped count to the retained 2,373-row canonical inventory is consistent with full recovery of that admitted set; it does not prove the cause of every residual row.

## Cause classification and targeted disposition

These categories explain the exclusion mechanisms. Their counts within the residual 2,065 are **unknown**, and categories can overlap until exact row evidence is available.

| Class | Evidence-supported mechanism | Safe targeted response |
| --- | --- | --- |
| Missing or unverified canonical link | Yahoo external identity or canonical player must exist and both must be verified | Review the exact seasonal external key against existing canonical identity evidence. Add/correct a link only after that evidence establishes the association; do not assume a new NHL player is needed |
| No admitted NHL identity | Canonical `nhl_player_id` is null, even if the Yahoo player is legitimate | Keep unmapped unless an NHL identity is established. A prospect or other Yahoo-only entry is not automatically erroneous |
| Seasonal/context admission gap | External season must be non-null, context must match the required shape, and key must be a full seasonal Yahoo key | Correct only the evidenced external identity/context. Never copy a numeric-ID or another-season mapping into this row |
| Verified identity conflict | SQL excludes conflicting verified canonical links in the same context; the API also rejects one exact key mapping to differing NHL IDs | Resolve the specific conflicting evidence through the identity owner. Preserve fail-closed behavior until then |
| Malformed source key / invalid returned NHL ID | API rejects non-seasonal keys, non-positive or non-safe-integer numeric NHL IDs | Fix the proven writer/data contract if a retained row demonstrates it; no such residual row was retained here |
| Population/eligibility interpretation | No-season reads include every stored Yahoo seasonal row. Same athlete may count multiple times. Empty history and flat movement still count | Describe the count as source rows. Do not treat it as current-player coverage, remove historical rows, alter season defaults, or synthesize identities to improve the number |

Missing history does not itself cause an identity mapping failure. Conversely, an unmapped row with valid movement still appears as a mover with `playerId: null`; it is excluded from NHL-ID-selected results. The independent snapshot result `ambiguous_identity` for NHL 8478402 is evidence of that snapshot reader's ambiguity, not an identified row in the residual Trends set.

**No new runtime or data repair is justified by this evidence.** The safe local change is regression coverage of the distinctions above. The previously deployed exact-season lookup and ambiguity handling remain unchanged.

## Local changes and verification

Added three cases to the existing API test using synthetic in-memory rows and a mocked Supabase client:

1. Two seasonal keys for the same NHL player count as two mapped source rows; empty/flat histories still contribute to counts; unmapped movement remains visible with null identity; position/pagination filters do not redefine source coverage.
2. Another seasonal key or legacy numeric key cannot map the current trend or enter NHL-selected results. The fixture asserts the exact three source/mapping reads, with no name/legacy fallback query.
3. A real season filter narrows counts; an empty requested season explicitly flags fallback and reports the broader source population.

Existing tests retain malformed/invalid/ambiguous mapping and snapshot provenance coverage. The new fixtures are **not** a reconstructed production census.

- Passed: Node `v22.23.4`; `npm test -- --run __tests__/pages/api/v1/transactions/ownership-trends.test.ts` from `web/`: **44 tests**, 0 failures (41 existing + 3 new).
- Passed: `npx --no-install eslint __tests__/pages/api/v1/transactions/ownership-trends.test.ts` from `web/`.
- Passed: scoped `git diff --check` and final diff inspection.
- Not run: full TypeScript, whole test suite, browser or build. Only a test file changed; focused execution/lint is proportionate and avoids concurrent broad checks.
- Remote requests, DB reads/writes, provider calls, forecasts, migrations, builds/deployments: **zero**.

Evidence pins (SHA-256):
- Pre-fix captures, both: `54f9822c95c1519af38a5097d4436f6527186bb2672b5d776bbb8db0ef3f63f7`.
- Post-fix smoke receipt: `67d98af09b6d9467fe9fe892454a1d627347e9934654590e442974b24e0221ba`.
- Retained mapping evidence: `91c3e2303d2f8f12b8b8919ec32d22e48ab69108208d5e2bdf8d4a3e77538dc0`.
- Final API test: `148e8a607e98bee2b21af1b7012f0443fffac0374c681944b75edd124fac015a`.

## Handoff and remaining gates

Local test patch is uncommitted and ready for parent review; no runtime change is claimed locally or deployed. Exact test-file custody is released to the parent after this handoff. Other owners' files, release receipts and production re-normalization were not touched.

To classify all 2,065 by cause, first locate an already retained **post-fix row-level source and mapping capture** with matching timestamps. Minimal useful fields are exact Yahoo key/season, whether its canonical external/canonical player identities exist and are verified, canonical NHL ID availability, season/context qualification, and conflicting verified targets. A top-20 page or aggregate count cannot supply this evidence. This task found no such capture among its directly relevant artifacts.

If no saved capture exists, any future production evidence collection needs separate explicit authorization and coordination with the active production work, using an agreed bounded exact-key sample first. Do not launch a broad scan, provider call or identity repair to fill this gap. A sample can classify only its sampled rows; complete residual counts remain unknown without complete consistent evidence. Any subsequent data change requires an exact reviewed repair candidate and separate authorization.
