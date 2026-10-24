# Combined A1–A10 and NST R1 local verification

The **31 unique changed files** from independently accepted A1–A10 and NST R1 are pinned together. The combined offline run passed **742 affected-suite cases and 28 original/independent cases** across 31 test files. These are 770 passing executions, not 770 distinct scenarios. Application TypeScript passed; the all-file check separately found two typing errors in an unchanged external reviewer fixture. No application source was changed during this integration step.

This is a reproducible local verification candidate, **not release approval**. It starts from the preserved historical dirty audit snapshot, overlays only accepted changes, and retains all other baseline bytes. The full archive provides executable context; inclusion does not accept unrelated baseline work or make it a clean release tree.

## Accepted inventory and provenance

| Packet | Changed paths | Acceptance evidence |
|---|---:|---|
| A1–A4/A6 | 14, including 3 later overlaid by accepted NST R1 | [Independent review](../../claude-audit-independent-review-2026-10-22/forge-ledger-lease/REVIEW.md) |
| A5/A10 | 2 | [Independent review](../../claude-audit-independent-review-2026-10-22/a5-a10-yahoo/REVIEW.md) |
| A7–A9 R1 | 13 | [Independent review](../../claude-audit-independent-review-2026-10-22/a7-a9-stats/r1/REVIEW.md) |
| NST R1 | 5, of which 3 overlap A6 | [Independent review](../../claude-audit-independent-review-2026-10-22/nst-continuation/r1/REVIEW.md) |

The deduplicated inventory, exact SHA-256 hashes, 12 dependency fences, review hashes and check results are in [CANDIDATE.json](CANDIDATE.json). The packet preserves strict prior-date context, exact-game admission, unknown actuals/coverage when evidence is missing, valid zeros, idempotent lease accounting, matched stats samples, incomplete-pagination handling, stale-request ownership and provider authorization. NST R1 additionally preserves durable manual-review holds across stale acquisition and uncertain persistence, while allowing acknowledged cursor handoffs.

The original 3,357-file audit archive remains unchanged, SHA-256 `f51b4291439a973f3e3d4cf35ec789c5ccfe99899b54c5059180b420568f3077`. Its snapshot HEAD was `a811b0762ffe29006c3df7eaa4c19bf18deecda3`. The accepted overlays change 20 files relative to that already-fixed base; the other 11 accepted paths remain byte-identical to it. [accepted-overlay.patch](accepted-overlay.patch) passed a dry-run against those original bytes in a private scratch directory. It is not a patch against current canonical or a clean Git commit.

The new [fixed-source.tar.gz](fixed-source.tar.gz) contains **3,365 files**, all verified against [FIXED-SNAPSHOT.json](FIXED-SNAPSHOT.json). SHA-256:

```text
1744faa8139dde75c8affd8457771b4eef7706725cddfa23019ae54996e6bf04
```

The additions are three accepted stats tests, four unchanged external review fixtures and one verification-only TypeScript config. Only the scratch Vitest cache path differs among existing verification harness files. No dependencies, env files, credentials, generated caches or Git metadata are archived.

## Checks actually run

All commands ran in a fresh nested `/tmp` source snapshot with Node **v22.11.0**, npm **10.9.0**, existing dependencies, synthetic `.invalid` configuration, cleared environment and denied sockets/HTTP(S)/unmocked fetch. Exact commands, file lists and rerun instructions are in [VERIFY.md](VERIFY.md), [COMMANDS.json](COMMANDS.json) and [verify.sh](verify.sh).

| Check | Result |
|---|---|
| 24 affected suites | 742 passed, 0 failed |
| 7 original/independent fixture files | 28 passed, 0 failed |
| Full all-file TypeScript | Exit 2: two typing errors at lines 355 and 359 of unchanged external `auditNstR1Additional.test.ts`; no application-file diagnostic |
| Application TypeScript | Exit 0; full original include set, excluding only the four external independent-review fixtures |
| ESLint on all 31 accepted paths | Exit 0; two existing `no-img-element` warnings in GoalieShareChart, no errors |
| Scoped canonical diff whitespace | Passed |
| Overlay patch against preserved audit bytes | Passed after correcting generated new-file headers; no source changes |
| Archive integrity | All 3,365 file hashes verified |
| Canonical accepted pins and dependency fences | 31/31 and 12/12 match |

The all-file TypeScript failure is retained in [its log](evidence/typecheck.log). The review fixture remains byte-for-byte unchanged and its eight runtime cases pass. The archived `web/audit.application-tsconfig.json` exists only inside the verification tree; it excludes no application source or application test. The successful application check has an empty [log](evidence/application-typecheck.log). The first generated patch check failed because three additions lacked `new file mode` headers; the corrected patch passed and both logs are preserved. No failed application behavior was suppressed.

## Concurrent work remains separate

[CANONICAL-COMPARISON.json](CANONICAL-COMPARISON.json) records 58 source/config differences outside this packet, with both snapshot and current hashes where present. Their current versions were not copied. This is an exclusion inventory, not a claim that another owner's work is rejected. Parent retains P01–P05, CTPI and Luna coordination; ownership was not inferred from historical custodians. Other directories and task artifacts are outside the source comparison.

Canonical `octoberBranch` advanced from observed assembly HEAD `716896be8325a64f5cbd3ece9a1fdab48c50733f` to `fd58ba2452c0175b201e50285df156cb7f91b4f4` during verification. This task made no commit, branch change, reset, merge or worktree. All accepted pins and named dependency fences still match. The archive is fixed independently of further canonical changes; use hashes, not the moving branch name, for review.

The final [integrity check](END-INTEGRITY.json) observed HEAD `a6e9f8b61903ed4bb2bba6b21bf8597f51ac85d0` and reconfirmed all 31 accepted hashes, all 12 dependency hashes and both preserved archive hashes. The 58-path outside-packet comparison remains the timestamped observation at `fd58ba2`; it is not an ongoing monitor of other workers.

## Open gates

- **A1 qualification:** corrected cutoff does not prove historical input vintage. Old inclusive captures cannot be relabeled. The bounded [offline qualification plan](../QUALIFICATION-PLAN.md) and [evidence inventory](../QUALIFICATION-EVIDENCE.json) remain the handoff; no historical requalification was invented or remote capture run.
- **A3 evidence:** an authoritative exact-game/team/class finality and complete-ingestion receipt is still needed. No producer/storage integration or historical data repair was performed. Old unsupported settlements outside the normal replay window remain operational work.
- **A4 storage:** durable independent snapshot membership and complete-snapshot receipts need an approved storage/migration contract. Coverage remains unavailable without them. No schema, migration or data change was applied.
- **A6/NST rollout and recovery:** tests model revision/owner races, not real Postgres durability or killed processes. Existing RPC compatibility, quiescent/version-consistent rollout and bounded recovery remain open. Abandoned upstream NST stages conservatively require manual receipt review; old workers and direct runners do not use the new guard. NST R1 needs no schema change against the inspected repository contract, which does not establish current production installation.
- **Release:** reconcile into an approved clean release candidate before any separately authorized publication/build/deployment. Other workers' packets are outside this acceptance.

TJ's production `/db` backfill was not contacted, inspected or controlled. Its exact deployed version was not established. No production/NST/database/model API calls, credentials, dependency installs, lockfile edits, billing operations, builds, commits, pushes, merges or deployments occurred. No action in this integration step was denied or externally uncertain. Local pinning is complete; the evidence and operational gates above remain pending.
