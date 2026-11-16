# Bounded audit: web API tests, batch 4

Target: `89da739cb45d7d572ed59bfa0b209c79c5d99299`. Worker: `readfirst_lanes`, verified Astra/high; Chef owns canonical status and findings.

## Result and evidence boundary

All six assigned files were read top to bottom in path order: **5,181 lines**, no assigned sections unread. The companion TSV inventories **628 function-like definitions (including 181 test declarations), plus 10 top-level fixtures/constants: 638 rows**. Parameterized declarations are counted once, not as expanded test cases. Every helper, closure, mock filter, numeric gate and assertion was reviewed; AST enumeration is the completeness check, not the audit itself.

**No newly confirmed defect is claimed in this batch.** One bounded settlement-finality risk requires upstream admission evidence; it is detailed below. Duplicate tests and missing assertions are coverage limitations, not automatically defects. `audited` in the TSV means source-reviewed at the target; it never means the test passed or its whole implementation/reader chain was audited.

No Vitest, application imports, React/browser, database, provider, HTTP, server, model training or production execution occurred. No application/test edits. TypeScript's parser and Node/Python standard libraries were used only for local source inventory, exact Git-blob comparisons and report checks. Existing successful suites were not rerun.

## Pin and read manifest

All test paths below are under `web/__tests__/pages/api/v1/db/`. Each range is 1 through the listed line count. All reads used private copies from `git show 89da739cb:<path>` in `/tmp/astra-web-tests-4/`; current checkout was not substituted for the target.

| File | Lines | Bytes | SHA-256 at target | Checkout | Functions / test declarations |
|---|---:|---:|---|---|---:|
| `cron-report.test.ts` | 2429 | 137314 | `3c1fbf76f9ab349278db429c9b846baeb41d308e335386c782593431e9c4d4a2` | **differs** | 232 / 97 |
| `forge-served-forecast-settle.test.ts` | 165 | 11592 | `1445e27b266c7eed8cd3847bd9c087ce5784db8bd268d8d9808e34b0f0a48794` | matches | 53 / 7 |
| `forge-served-forecast-snapshot.test.ts` | 324 | 20683 | `5e5b361603a5a3a7a7c9c5a7af126853e84a0f13ed7cbf6358f4edc20e08a2d2` | matches | 87 / 16 |
| `operational-route-auth.test.ts` | 303 | 10261 | `143632391fee4488873a227f53175acbf3550d6d981cff87295ebfe0c7697dde` | matches | 32 / 8 |
| `rebuild-team-underlying-summaries.test.ts` | 128 | 5419 | `93d716f00ef9769402feb1a8be28a7b26556e9e5b265d359451d999354c31676` | matches | 19 / 7 |
| `run-rolling-forge-pipeline.test.ts` | 1832 | 87492 | `5d60bb128f318d32d069afe171b2fef4b5a7bfe6d2e9dc9425e426284bdb4f18` | matches | 205 / 46 |

`cron-report.test.ts` checkout SHA-256 is `a5659bd07fbc8201dbd942b2812b8ebbaa1911a5e449f158e603fa4648198042`. Its differing checkout content was not audited or overwritten. The target blob is `3c1fbf76…`; all line pointers in this report refer to that blob.

## Contract and oracle review

Previously read owner decisions/rules, L12/L15 and follow-up records were reused. Relevant invariants are: unknown coverage is not success/zero; request submission is not completed execution; counts retain their units; immutable issuance is separate from settlement; forecast basis determines DNP treatment (decision 41), and nonappearance requires identity-complete stored final official receipts (decision 78); bounded orchestration must preserve durable cursors and avoid reissuing writes when audit/checkpoint outcome is unknown. Tests establish only the portion of those contracts they actually assert.

### cron-report.test.ts

- **1–145, 613–680:** mock query filters enforce date/status/job identity and inclusive ranges; exact counts, deterministic clock and synthetic transport failures support the downstream oracles. Query `order` is a no-op. Email transport, Supabase, inventory reads, authentication and source-health readers are mocked. Selected email tests use the real email component/static renderer, not actual delivery. These fixtures cannot establish database ordering, RLS, actual cron activation or current health.
- **146–300:** structured outcomes survive truncated response previews; known failures outrank skip summaries; expected offseason pauses remain healthy; true skips do not replace last durable success. Receipt absence/missing migration remains unknown, not proof of no backlog. Preview flags do not become writes.
- **301–600:** weekly-not-due and disabled/suspended states are separated; 3,001-row timeout retains 3,000 observations with totals unknown; malformed/truncated details cannot invent success or writes. Edge HTTP submission is queued rather than completed; canonical jobid can match query drift, while date-window/dry-run probes cannot stand in for the scheduled receipt. Thirty-day history pagination, 8-page cap and deadline preserve complete current observations while leaving historical evidence incomplete. Authentication precedes audit/email work.
- **681–936:** execution elapsed time/affected rows are not inferred from HTTP submission; a 741-row partial stage with one verified game failure reports one failed operation and unknown failed rows. Near-limit warning is tied to 90% of the 240-second budget (216 seconds). GET probe success cannot replace POST execution.
- **937–1200:** Yahoo's 1,597 successes, 1,041 ownership records and 556 omitted histories keep coverage unknown despite known player writes. Current canonical inventory outranks historical SQL text; inactive entries stay excluded. The repeated blocks listed below add no independent oracle.
- **1201–1800:** in-flight self-audit grace is bounded; missing/empty inventory fails before email. Wrapper GET/POST compatibility is explicit. Full-window 6,184 rows/83 failures require seven pages; four forecast horizons preserve full query identity. Recurring expectations count slots, not all daily runs. Partial timeout retains observed counts but sets totals unknown. Same-day continuations are unfinished, previous-day leftovers are not silently healthy, and future rows are outside the report window.
- **1801–2110:** duplicate identities retain unknown counts, tie timestamps do not cross horizons, zero processed plus zero skipped does not establish productive work, extra SQL failures prevent all-green output. Offseason expected pause is distinct from in-season no-output. Eight displayed failures out of ten include an omitted count of two. Idempotent/pruned productive shift work is recognized; blanket zero-row failure is avoided. Truncated rolling failure retains only supported cause/budget facts.
- **2111–2429:** intact nested responses outrank summarized declarations; nested failed-stage causes survive truncation without inventing writes. Empty attempts stay unknown. Parallel 180-second source deadlines plus reserved phases stay within the 240-second route budget. Disabled pg_cron job 234 is excluded while an active counterpart would be missing. UTC slot logic is asserted under a New York timezone. Email rejection/thrown transport produces a different failure from report generation; diagnostics cap text at 300 characters. Last durable success remains distinct from a skip score.

Concrete positive value: these oracles would catch collapsing queued/partial/unknown work into success, incorrectly assigning another horizon's receipt, dropping observed failures on timeout, unbounded preview diagnostics, and treating skipped work as current writes. Limits: source mocking hides query-engine semantics and actual production receipt shape; no count here is a live operational measurement.

The exact normalized callback bodies duplicate at **411–442 / 940–971**, **444–478 / 973–1007**, **483–495 / 1012–1024**, and **497–518 / 2256–2277**. These are four duplicate-body pairs among 97 declarations. Their parameterized bodies are counted as declarations, never as independent correctness evidence.

### forge-served-forecast-settle.test.ts

- **1–65:** real route with identity auth/audit/offseason wrappers; fake database filters support exact identity/date selection, but `select/order/range` are no-ops and upsert does not persist. Fixtures contain WGO actuals for game 100, no actuals for game 200, an out-of-window row, and initially no official boxscore.
- **66–101:** final stored boxscore proves DNP: unconditional bridge outcomes are zero, conditional naive outcomes are null; universe rows preserve identity, dressed status and receipt hash. These assertions would reject row-count-based DNP inference or assigning unconditional zeros to conditional rows.
- **102–111:** newest LIVE supersedes older OFF; conflicting ingested identities reject a missing player's settlement. This is a **nonappearance** oracle, not proof every actual requires game finality.
- **113–135:** three observed rows settle while the unobserved game stays unresolved; exact skater/goalie outputs and settlement-only upsert keys exclude forecast/issuance fields. This is the positive-actual finality boundary described below.
- **137–164:** previously fabricated DNP is cleared to unknown, then recovers when the actual arrives; empty counts, invalid date, method rejection and failed write are asserted. No persistent-DB idempotence or full pagination proof is provided.

### forge-served-forecast-snapshot.test.ts

- **1–~140:** real snapshot builder/route, fake planning/bridge/storage inputs; future game admitted, already-started game excluded, rest player excluded. Three expected sources and stored run/proof provenance are asserted. Missing proof excludes bridge while retaining two naive controls; proof-read failure stops writes. A dedicated unauthorized test restores the real auth boundary and asserts 401 before planning/proof reads.
- **Market/basis assertions through ~220:** default market flag excludes market writes; enabled path adds market comparisons after ledger/universe writes. Main success plus market failure is 207 partial, preserving completed counts. Schema-off omits basis/universe claims; schema-on preserves unconditional versus conditional-dressed basis and null participation. One market probability is asserted numeric, not an exact numerical probability oracle; synthetic inputs do not qualify calibration.
- **Deadline/write assertions through 324:** shared 45-second deadline stops stalled proof reads by abort, rejects a bridge or row build completed too late before main writes, and reports partial success when market work expires after main writes. Branch elapsed/remaining-budget values and zero-write assertions are concrete; route error handling is tested with write failure.

This catches overwriting the semantic distinction between expected sources, using post-start games, promoting unproved bridge inputs, or allowing known late work to begin main writes. It does not prove repeat snapshot immutability, actual DB constraints, market fairness/calibration or production flag values. Those are reader/producer verification boundaries, not defects inferred from absent tests.

### operational-route-auth.test.ts

**1–303, full:** real operational wrapper plus fake authenticated user/role/database; `it.each(Object.entries(contract))` asserts unauthenticated 401/no audit, wrong-method 405/Allow/no handler, then permitted authenticated method with attached client and contract-selected audit behavior. Rebuild defaults to dry-run, write is audited, failed dry-run is audited, and conflicting write/diff mode is rejected. Verified-admin fixture demonstrates the permitted admin path.

Separate 16-route active and five-route inert lists inspect source strings for wrapper/contract binding or retirement status/absence of selected write imports. These are lexical guards, not execution of every route. Comment text or an unlisted alias is not ruled out; deriving parameterized tests from the implementation contract also means a removed contract entry removes that case. The independent active-route list provides partial protection against that omission. Do not claim comprehensive role-denial, DB permissions or all retired side effects from this suite alone.

### rebuild-team-underlying-summaries.test.ts

**1–128, full:** real route plumbing with identity auth and fully mocked fetch/rebuild/diff services. Default dry-run returns 280 generated/zero written plus stale count; explicit false reaches the service. Missing season, reversed dates, 31-day range, duplicate/over-10 IDs, mixed date/ID selection, unknown requested ID, incompatible diff+write and 121 returned games are rejected. Two-game diff forwards exact IDs and returns the mocked difference.

These assertions catch bypassing route bounds or wrong mode forwarding. They do not check underlying GF/GA/penalty-shot arithmetic, actual final-game selection, exact 14/15-day or 120/121 success boundaries, or real write behavior. The fixture calling IDs “final games” does not itself prove finality filtering.

### run-rolling-forge-pipeline.test.ts

- **1–~280:** real orchestrator and cron audit/run-state code; all child routes mocked. In-memory RPC simulates lease owner/revision checks, acquisition, cursor monotonicity, completion and expiration. It does not verify actual RPC name/schema/RLS or concurrent SQL atomicity. Stubbed arithmetic is a fixture assumption, not independent proof of the database contract.
- **Daily/explicit paths through ~680:** exact upstream, derived and projection windows, stage order, skip semantics, defaults and 210-second budget are asserted. HTTP 207 is not relabeled a hard failure; compact failure evidence retains root cause and bounded samples. Request counts/timing are not proof real child datasets are complete. Overnight budget/window metadata and retired WGO route exclusion are explicit.
- **Scheduled/resume paths ~681–1200:** fake clocks prove a 60+40-second slice stops and resumes at the next checkpoint, rolling continuation resumes from player ID, completed operations do not reissue children, projection date advances independently, and NST receives a fresh deadline. Malformed NST continuations (including inconsistent success/status, fractional/nonpositive/stalled cursor, changed date/deadline or extra query fields) stop with the specified hold. Known source-down degradation differs from ordinary 500/503 failure. Unknown audit/write outcome prohibits blind replay.
- **Remaining scheduled cases through 1708:** two stage failures exhaust retry budget; resumable projection progress does not burn failure attempts. Foreign leases prevent child work. Chunk adaptation from 16 players/20 seconds is capped at 60, with persisted cursor and runtime margin before the next call. Expired running checkpoints require review. Concurrent kill receipts count once in the fake implementation. Goalie completion has its own persisted substate and retries a failed goalie pass without replaying completed dates. Next-day 422 is recorded as a nonblocking handled warning. Days-ahead accepts 0–6, defaults invalid input to 1, and resumes the next unhandled day. Missing line context retries once, then degrades explicitly.
- **1710–1832:** real audit wrappers with six lost/rejected/missing receipt shapes assert one child write and then manual-review hold; delayed stale reads cannot overwrite the hold. Failed hold persistence cannot advertise a safe retry. Related two-stage failure scenarios preserve running/manual-review state instead of silently replaying writes. `expect.soft` assertions remain substantive assertions; their presence is not a pass receipt because this batch did not run them.

These are meaningful control-flow and unknown-outcome oracles. They are not end-to-end production resumability tests: children, database lease transitions, elapsed work and audit transport are synthetic. Broad success objects with zero affected rows also do not verify actual output completeness. The required next implementation review remains the route/run-state/RPC and real child contracts at their own scope turns.

## Settlement finality: bounded source risk, not a new confirmed finding

**Observed source behavior:** `web/pages/api/v1/db/forge-served-forecast-settle.ts:47–51` queries WGO actuals by date only. Its games query at 57 does not select a finality field. Stored official final boxscores are validated, but their receipts feed `settlementEvidence` in `web/lib/player-forecasts/servedForecastLedger.ts:372–389`, where an actual without a receipt becomes `appeared` (379). `settleLedgerRows:405–441` then assigns `settled_at`, actual counts and source; `settleLedgerUniverse:392–399` likewise records dressed/settled status from the actual.

**Concrete input that reaches the boundary:** a ledger player-game, matching WGO actual row, and no stored official boxscore (the test113–135 fixture) yields a settled actual; changing the missing receipt to a rejected LIVE boxscore still leaves no receipt and does not alter actual admission. The fixture's player 11/game 100 with goals1/shots4 is an exact source scenario. The existing LIVE test102–111 uses absent player13, so it cannot catch this positive-actual case.

**Why not confirmed here:** decision78 specifically protects nonappearance; the positive-actual path may rely on upstream WGO writes being final-only. This batch has not traced those writers or produced a retained unfinished-game actual. A missing finality assertion alone is not a bug. Chef was notified; candidate stays pending writer/admission verification, with no new finding ID or release/production assertion. If an unfinished positive actual is admitted upstream, the path can promote provisional counts to settled outcomes; that is the concrete future regression to pin.

Nearest sources inspected only for this question:

| Path | Read range | Whole-file bytes / SHA-256 at target |
|---|---|---|
| `web/pages/api/v1/db/forge-served-forecast-settle.ts` | 1–108 (full source text; broader reader verification pending) | 9893 / `1ab5e021d21fcbc4de469b21f9a968bfcc510dcd904a94ef705dbc4168d5a134` |
| `web/lib/player-forecasts/servedForecastLedger.ts` | 285–475 plus bounded symbol search | 59906 / `c98ad97650207595dfe998fd369d0863a8ea7114d102cf85115fd2a8dd8f669b` |

Both source files byte-match the target. No whole `servedForecastLedger.ts` audit is claimed; its remaining lines, downstream score readers, WGO producer/finality boundary and live data remain pending. The route text was read fully for this trace, but it is not being promoted to canonical whole-path completion by this test-only worker.

## Verification receipts and handoff

- All six target blobs and both bounded source pins compared byte-for-byte using `git show`; source manifest generation exited 0.
- `node /tmp/astra-web-tests-4/inventory.cjs` exited 0: TypeScript source parse/inventory, hashes and duplicate-body comparison only. It imported no application module and ran no application behavior.
- The companion TSV contains every reviewed function-like declaration/closure and top-level fixture, concrete local assertions or helper semantics, and explicit “not executed” evidence. Detailed per-test assertions are in the TSV rather than duplicated here.
- No runtime test result is claimed. No repeated successful tests, database connections, external requests, application edits or canonical ledger edits.
- Final schema/count/unique-symbol/whitespace checks are recorded in the diary after execution. Chef owns acceptance, finding classification, whole-path status and next scope.
