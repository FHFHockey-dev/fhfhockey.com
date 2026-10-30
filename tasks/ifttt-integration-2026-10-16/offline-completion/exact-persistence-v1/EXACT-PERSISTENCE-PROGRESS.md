# Exact persistence acceptance — three local cases, six unresolved

The original oracle remains byte-identical (`d9fe45ca44042673ff0381cd0f1981074b196da99fb6fdf9da573ac5df84fd8b`). The separate `exact-persistence.test.ts` consumes its original records, steps, preconditions and assertions. It translates the already-bound Jordan Staal/CAR/game-900012 record into the application storage envelope, preserving text, subject/predicate spans, original/receipt identities, scope, fact and source clocks. Synthetic dated roster and complete absence/fence evidence realize the DSL's stated fixture preconditions in a fresh private schema. This does not authenticate historic posts, demonstrate NLP extraction accuracy or prove deployed history absence.

**Three tests passed against actual replacement RPCs and all three staged migrations:** CR039 (3 original assertions), CR040 (3) and CR052 (4). Each test recreates an empty schema. CR039 injects an SQL trigger failure before registry commit, verifies no retained source/identity/outbox, then retries from a fresh read. CR040 loses the returned commit acknowledgment after actual commit, requires the application to read the exact retained observation back, then checks stable identity on a new call. CR052 barriers two workers at the same real context clock, observes exactly one SQL CAS loser and its durable reload, then reads one allocated occurrence, one reserved transition/effect identity and a held outbox row. “Committed” in the DSL means a committed reservation here, never external delivery.

Evidence: `exact-persistence-results.json`, `exact-persistence-initial.log` (fixture column-order failure before contract execution, preserved), `exact-persistence-run.log` (3/3 passed after explicit audit columns and fixture-known-at correction). All original assertions are evaluated verbatim. New harness was written outside the 56 frozen implementation paths; it has not yet received independent review. Results pin the exact implementation manifest/hash used.

The pure runner still reports 41/43 pure cases (194/196 assertions), unchanged CR011/CR051 failures and nine `deferred_persistence` rows because it does not call a database. This separate actual-storage result does not rewrite that report, original fixtures or prior evidence. The approved corrected game-scope fixtures remain a distinct versioned pure test.

## Six exact gates still deferred

| Case | Missing implemented boundary |
| --- | --- |
| CR036 | Forced same **r3 evidence-version key** with different immutable evidence payload. Raw observation-ID retry rejection is related but cannot substitute for registry evidence-version enforcement. |
| CR037 | Actual legacy capture-parent same-key writer/fan-out. Must separately reject raw_payload, provenanceHash, team_or_game_scope and interpretation changes while comparing the entire retained parent and all children. |
| CR041 | Actual parent-commit acknowledgment loss and exact parent readback before child fan-out; the current held scope transaction is atomic and has no separate parent stage. |
| CR042 | Preserve the declared opaque prior effect/transition IDs with an authoritative durable no-attempt transport proof. A local reserved status is insufficient. |
| CR043 | Actual opaque prior external action and uncertain transport outcome/reconciliation contract. No send/retry is activated. |
| CR044 | Actual durable consumer delivery receipt and separate queue acknowledgment failure, retaining the declared opaque effect ID. |

Generic fixture delivery tests remain useful bounded evidence but are not scored as those opaque legacy/consumer contracts. Exact legacy reconciliation, authentic intake, genuine future performance and all operational approvals remain open.
