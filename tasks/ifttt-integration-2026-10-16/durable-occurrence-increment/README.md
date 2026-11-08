# Durable occurrence start — unfinished, unapplied draft

Scout requested a safe checkpoint while continuing this authorized increment. This directory preserves the exact work started after the accepted pure occurrence review. **It is not a runnable migration or accepted integration.** No new compiler/test/Postgres process was started for this draft.

The live `tweetClaimLineage.ts` and `tweetClaimQualificationStorage.ts` hooks were removed with focused reverse patches after preserving their exact new versions in `wip-source/web/lib/sources/`. The new helper was likewise moved out of runtime. All 41 v4 and 49 occurrence-v2 accepted source pins were then rechecked. No unrelated dirty work was reset, staged or overwritten. The release coordinator's captured web files remain independent.

## Preserved work

- `wip-source/web/lib/sources/tweetClaimOccurrenceStorage.ts`: draft planner connecting exact immutable claim anchors/attribution to the reviewed occurrence ledger, including unique retained-receipt upgrades, component ambiguity and legacy-cutover holds.
- `wip-source/web/lib/sources/tweetClaimQualificationStorage.ts`: draft call inside the existing read/plan/global-CAS path, requiring the new context protocol. No fallback would invent a durable allocator.
- `wip-source/web/lib/sources/tweetClaimLineage.ts`: draft canonical occurrence bindings plus retained native r3 alias reporting, global meaning checks and all-held behavior.
- `20261016044953_tweet_claim_occurrence_identity.sql.draft`: CLI-generated migration basename, generated in an isolated temporary directory and moved here. Contains two proposed private tables (bounded component ledger and indexed receipt/original links), bounded context selection, canonical JSON/input/anchor helpers, prior immutable-state/retained-observation checks and draft write helper. **Incomplete: no replacement read/commit RPCs, final privilege closure or COMMIT. Do not execute it.** `.draft` makes that explicit.

The command intended to compose the RPC replacement sections failed before process creation with `exec-server transport disconnected`. A later read succeeded and confirmed the SQL tail still ended at the standalone draft helper. No SQL execution occurred. The connection is currently usable; there is no pending permission or continuing transport blocker.

## Next concrete steps

1. Review these prototypes against `../occurrence-increment/DURABLE-INTEGRATION-GATE.md`. Preserve native IDs and the original two staged migrations. Keep already allocated multi-component convergence held.
2. Complete the new SQL revision: bounded full-component observation/history reads; atomic allocator/identity/qualification commit inside the existing global clock lock/CAS; inline the mutating draft helper into the protected commit RPC rather than publishing a second mutation entrypoint; close function ACLs and validate all proposed prior/new rows against retained source evidence. Validate SQL JSON/UTF-16 input/hash behavior with Unicode fixtures. No production application.
3. Reapply the focused source hooks only after the new local protocol is coherent, extend the disposable qualification fixture with the third SQL revision, then run the nearest tests. Add actual restart/concurrent-first-allocation/loser-readback/rollback/commit-ack-loss tests and immutable/cross-scope/partial-component negatives. Keep the source mode default off and every effect held.
4. Map all nine exact persistence cases (CR036, CR037, CR039–CR044, CR052), including all four CR037 variants, to real disposable storage and bounded consumer fixtures. Existing related tests and this draft do not satisfy them.
5. Freeze new complete pins and obtain independent review. Do not transfer v4 or pure acceptance to these drafts.

CR011/CR051 remain unchanged and failed. A text-only clarification is pending: do their `tonight`/`tomorrow` versions represent separate clauses in a retained full original or an edited clause? Supply the lexical proof or an explicit transition policy. No game-based identity inference, fabricated full document or weakened assertion is authorized.

Hosted metadata is **executed/guarded-incomplete**, not awaiting the earlier approval: TJ's yes enabled one exact retry, which returned aggregate size/missing counts only. Query two stopped; see `../offline-completion/CATALOG-READ-RESULT.md`. This does not block local disposable implementation. All production DDL, data/history reads, activation, dispatch/replay/compensation and genuine future evaluation gates remain separate.
