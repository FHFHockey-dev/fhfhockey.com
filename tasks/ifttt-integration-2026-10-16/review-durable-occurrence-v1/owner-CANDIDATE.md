# Durable occurrence candidate — local held/shadow only

This increment resumes the historical parked draft preserved in `README.md` and `wip-source/`. The live hooks are now integrated and tested locally; that earlier checkpoint is not the current source state. The `.sql.draft` remains historical and must not be applied. The completed third staged SQL file is `20261016044953_tweet_claim_occurrence_identity.sql`; all three SQL files remain outside the active migration tree and unapplied remotely.

## Implemented boundary

`retainQualifiedTweetClaimScope` reads the actual replacement context RPC, plans the reviewed occurrence counter ledger, and commits it atomically with immutable observations, qualification and held outbox rows under the existing global context lock/CAS. Receipt/original indexes retrieve the complete bounded retained component. Unique same-anchor provisional upgrades preserve the allocated token and all native r3 identities. Material game rebinds, unproved text/anchor changes, multiple previously allocated components and unmapped legacy canonical state hold for review. No new mutation RPC or dispatch path is introduced. Default mode remains off; shadow effects remain held/reviewable.

The additive SQL checks prior ledger immutability, exact retained observation/input/anchor hashes, verified original bindings and bounded append-only allocation, including Unicode source evidence. The direct component update/delete trigger enforces prior-row preservation. Existing global CAS bounds contention at three attempts; a lost acknowledgement requires durable exact readback before success. All original registry/reducer code and the original two migrations are retained unchanged.

## Author checks

- Actual disposable PG17 replacement-RPC/storage tests: **21/21 passed**, private Unix socket, host connections rejected and test network-denial harness. Covers initial provisional-to-verified/cross-wrapper convergence, concurrent first allocation and loser reload, rollback before commit, commit acknowledgement loss/reload, immutable ledger tampering through RPC and direct update, unmapped legacy cutover, multi-component convergence hold and three-CAS retry bound, plus prior qualification/history/clock/source-hint checks. `evidence/durable-storage.log`.
- Focused pure checks: **38/38 passed**; `evidence/focused.log`.
- Approved versioned game-scope fixtures: **6/6 passed**, `evidence/game-scope.log`. Original CR011/CR051 remain unchanged ambiguous negative examples. Corrected positives explicitly supply full synthetic documents/disjoint anchors and separate dates or game-one/game-two clauses. These test declared binding semantics, not authentic source acquisition or NLP extraction. Authenticated edit is a held revision, not an independent action. Independent semantic review is requested.
- Bounded metadata-package checks: **4/4 passed**, including exact presence query limits and no helper/application reads; `../offline-completion/presence-v2-local.log`.
- Scoped ESLint passed. Aggregate TypeScript ran once and failed only at three unrelated player-forecast errors: missing PlanningData.evidence in gameExpectations.test.ts, and missing roster-observation variants in modeledGoalieParticipation.ts/modeledSkaterParticipation.ts. No IFTTT diagnostic was emitted. Exact log `evidence/aggregate-tsc.log`; no blanket type-check pass is claimed.

## Boundaries still open

This candidate is not independently accepted yet. Prior v4/pure acceptance does not transfer to these changed hooks/SQL. The exact nine original persistence DSL cases remain separate until faithfully executed, including all four CR037 variants; related fault tests are not silently scored as those cases. The unchanged original oracle retains historical CR011/CR051 failures; corrected fixtures are versioned separately. No full-52 acceptance is claimed.

The approved catalog presence query executed exactly once and identified five absent line-claim relations (`../offline-completion/PRESENCE-READ-v2-RESULT.md`). Metadata alone cannot prove deployed columns/functions, full consumer/writer inventory, history absence or fence compatibility. Authentic source/dated identity evidence, complete exact legacy reconciliation, genuine future collection/labeling/performance and all operational approval gates remain open.

No production migration, deployment, live ingestion, dispatch, replay, historical correction, scheduler/cohort activation, new credentials or forecast publication occurred. The production release excluded all claim/occurrence/receiver/SQL work. Do not apply any staged SQL until an exact reviewed operational package is separately approved.
