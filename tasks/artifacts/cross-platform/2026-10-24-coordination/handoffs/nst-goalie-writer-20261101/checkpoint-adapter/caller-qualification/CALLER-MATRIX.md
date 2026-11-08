# Offline caller qualification

This is local lifecycle evidence, not a live deployment inventory, provider validation, data-completeness assertion, or permission to activate. All eleven previously listed TypeScript sources and five historical Python entrypoints now have an enclosing boundary or require an enclosing parent. The shared Averages helper required one additional route allocation. Existing primary routes/proxies were regression-tested again. No production or provider I/O occurred.

| Previously unqualified TypeScript source | Enclosing behavior | Offline proof and limitation |
| --- | --- | --- |
| `pages/api/v1/db/update-nst-gamelog.ts` | Authenticated whole invocation, including manual audit, then lifecycle finish | 104 existing/new route tests; new cases finish after output/audit and hold lost audit. Existing cursor/write ambiguity behavior preserved. |
| `pages/api/v1/db/check-missing-goalie-data.ts` | Whole POST; loop/write expiry checks; swallowed DB/provider failure marks uncertain | Real private output function with mocked dependencies: failed write holds; expiry after identity lookup prevents write. Historical completeness/identity algorithm unchanged. |
| `pages/api/v1/db/update-nst-player-reports.ts` | Whole GET/POST; enabled mode awaits main before response; failures mark uncertain | Real handler waits for output; real private output rejects expired write and holds swallowed failure. Disabled legacy mode retains its old 202/background behavior. No automatic scheduling added. |
| `pages/api/v1/db/update-nst-last-ten.ts` | Whole POST; loop/write expiry checks; swallowed errors mark uncertain | Real private output function exercises failure/expiry. Existing date and row selection remain legacy semantics. |
| `pages/api/Teams/[teamAbbreviation].ts` | Lazy whole JSON route; opens a lease only on an NST cache miss | Real handler with mocked stats boundary exercises parse success/failure settlement. Existing route still behaves as a player-report compatibility endpoint. |
| `pages/api/fetch_team_table.ts` | Authenticated whole GET; parsing precedes finish | Seven route tests, including enabled valid/invalid table cases. Auth remains outside lifecycle. |
| `pages/api/SustainabilityStats/[playerId].ts` | Lazy whole route spanning both parallel provider reads and parsing | Existing metrics fixture plus enabled failure while peer remains active; hold, never early finish. |
| `pages/api/CareerAverages/[playerId].ts` | Lazy whole JSON route | Real handler with mocked stats boundary exercises parse success/failure settlement; parser math not revalidated. |
| `pages/api/ThreeYearAverages/[playerId].ts` | One lazy scope across four reports | Real handler with mocked report boundaries checks four awaited operations and failure hold; parser math not revalidated. |
| `lib/api/averages/helpers.ts` | Requires existing scope; cannot settle independently | Unscoped enabled helper rejects before fetching. Additional `pages/api/Averages/[playerId].ts` allocation encloses all four reports; tests verify one shared token and no lifecycle I/O on cache-only reads. |
| `scripts/audit-ctpi-multiseason.ts` | One bounded one-hour CLI scope through season fan-out and report generation | Real main function with isolated dependencies verifies all three season reads and JSON output before finish. Script was never launched. |

TypeScript paths above are relative to `web/`. Tests isolate private functions with the TypeScript parser so importing legacy modules cannot create real clients or start work. These checks establish those functions' lifecycle behavior; they do not claim complete end-to-end execution of each legacy writer.

| Historical Python entrypoint | Enclosing behavior | Offline proof and limitation |
| --- | --- | --- |
| `web/scripts/fetch_team_table.py` | 220-second decorated function; CLI loads required environment before entering | Real function AST: output precedes finish; missing table/SystemExit holds. No script import, `.env` read or provider call in tests. |
| `web/pages/api/ThreeYearAverages/nstgamelog.py` | One-hour whole main; per-write active check; returned error marks uncertainty | Real main spans two mocked players; real output errors/expiry hold. Legacy numeric/identity logic not repaired. |
| `web/pages/api/ThreeYearAverages/nsttest.py` | Import-inert main with 220-second scope | AST confirms no top-level NST fetch; real main parse failure holds. This remains an unsupported historical experiment, not a newly supported runtime path. |
| `web/pages/api/v1/db/nst_gamelog_scraper.py` | One-hour async main, awaited URL work, output/loop guards | Real async main spans two units; swallowed failures hold; real upsert errors cannot clear. Historical fixed season/high-water behavior unchanged. |
| `web/pages/api/v1/db/nst_gamelog_goalie_scraper.py` | One-hour main, output/loop guards, post-identity write guard | Real main spans two units; real output errors hold; identity lookup exhausting deadline prevents write. Historical fixed dates, one-row skip and name matching remain unchanged. |

The historical scripts are still manual, may require their existing optional dependencies, and can exceed the new job deadline on large ranges. Expiry intentionally holds for operator reconciliation; these scripts have no durable resume promise. No historical script was scheduled, launched or retired.

Shared transport now tracks admission waits as active work, rechecks the job immediately before dispatch, rejects enabled unscoped dispatch, and shares one lazy begin across parallel misses. Closed/uncertain/expired contexts cannot issue later dispatches or guarded writes. JSON remains buffered until finish acknowledgement. Python admission follows the same pre-dispatch gate and retains the existing parent-token proxy contract.

Proof: `FINAL-CHECKS.json` records 440 JavaScript tests in 17 files, scoped TypeScript/lint, 104 Python tests, and the prior 17 PostgreSQL scenario groups against the exact unchanged SQL. Global audit files and 13 accepted artifacts remain unchanged (`PROTECTED-PINS.json`). This candidate does not alter the accepted shared rolling-budget algorithm.
