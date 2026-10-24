# Billing migration relocation review

- Scope: independently verify the migration draft relocation packet, exact SQL hash, authority-registry parity, executable path resolution, and absence of unintended active copies. No SQL execution, source edits, network, commits or broad test suites.
- Input: `tasks/artifacts/billing-migration-authority-2026-10-22/{CHANGED-FILES.json,PROPOSED-RELOCATION.patch,FINAL-TEST-RESULTS.json}`.
- Expected destination: `tasks/artifacts/in-season-billing-2026-10-21/drafts/20261021210000_in_season_sandbox_billing.sql`, SHA-256 `d78b385ec6b8acfbfcc6ba2909d5f558765cd90e8e4a18a2febab68bf146db12`.
- Start: reading packet and current checkout identity; prior independent review scopes remain separate.
- Checkpoint: SQL hash preserved; exact registry/file parity is 98/98 with matching hashes. Four direct SQL references resolve; three CJS syntax checks and reverse patch check pass. No duplicate SQL draft by filename/hash in the four checked source roots.
- Finding: queue verification still consumes the historical manifest directly. Its actual extracted preflight fails on the changed integration-test hash; the manifest also points to the removed SQL path. Both initial and final hash loops need relocation-aware handling while retaining historical evidence.
- Current checkout HEAD advanced concurrently beyond the packet base; reviewed content is pinned by file hashes. Final integrity receipt will record both identities.
- Handoff: distinct review saved at `tasks/artifacts/billing-migration-relocation-independent-review-2026-10-22/REVIEW.md`; exact hashes and final integrity in `REVIEWED-HASHES.json`. Outcome changes requested for one P2; no application/source edits or SQL execution performed.
- Final integrity: packet base `a565238f670edc4cf65da79ad52ba82ec41f3b71`, first-check HEAD `1cf7bf424fdf927570a13c361ce657d7a384962a`, final HEAD `1db72ffc62bd73106a98e0146f3342346bbce69c`. All 11 candidate/reference hashes still match. Owner must correct only the executable manifest consumption and verify it offline.
- Blockers: none.

## R1 re-review

- Scope: review queue runner correction only; retest both original preflight failure oracles, strict seven-input verification and preservation of historical evidence. No application edits, SQL/target configuration/database-client loads or network.
- Candidate: runner `fe5e21a26ce2ac31a3bee44eb5ca45a408cca1e4b1ed3b1d72620ad58ae4bbe1`; versioned manifest `54b33decfb7dbf1173bb67c154665ff9c154982961be754c0eb7000b0e96efb2`.
- Start: packet and actual runner diff read; both checks share `verifySourceHashes()` and offline exit precedes target/client loading. Next inspect mapping/tests, run bounded offline cases, save separate R1 receipt without changing original evidence.
- Checkpoint: Node 22.11.0/npm 10.9.0 confirmed. Actual runner `--preflight`, all 14 supplied regressions, five independent original-oracle/final-guard/occupied-receipt checks, and syntax pass. Fourteen candidate/preserved pins and five historical receipts match. Original failure evidence remains untouched. R1 addresses the P2; preparing qualified local acceptance and final integrity receipt.
- R1 handoff: qualified acceptance saved at `tasks/artifacts/billing-migration-relocation-independent-review-2026-10-22/r1/REVIEW.md` and exact reviewed hashes in `r1/RECEIPT.json`. All 19 cases and actual preflight pass; original P2 closed. No remaining blocker. Parent may integrate this local correction; full SQL execution was neither performed nor approved by this review.
