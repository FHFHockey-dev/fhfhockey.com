# PR403 merge reconciliation

**Both P2 findings persist in the merged source.** The original Monday default-week fix is included. No final acceptance of this candidate was issued by reviewer `01a198a0-979b-71c9-a442-3d0218479035`.

## Exact merged candidate

GitHub's read-only PR metadata confirms [PR403](https://github.com/FHFHockey-dev/fhfhockey.com/pull/403) merged into `master` at **2026-11-01T20:08:01Z**.

- Merge commit: `295b384da47f2a4665a76d841d3d1aa701912d8c`.
- Merge root tree: `f5d6366ecc9d441bd20e5f93b744187672cb6d2e`.
- Parent/base: `f17bea20d8caa2b6268c318bdb2152d7e2a3b57d`.
- PR head: `a138dc69105fffbfca288e6a7aae4864d7359a06` on `chef/release-period-control-2026-11-01`.
- PR reports 82 changed files and states the code comes from `cc263466a`.

Remote Git-tree data is not truncated. Compared **195 entries (187 blobs, 8 trees)** across `web/lib/socialShare`, `web/components/SocialShare`, `web/pages/api/v1/social-share` and the Social Share E2E spec against local committed `cc263466a69e9c7c0fe7d7ff3a04f411c30a9c2e`: **195 match, zero differences**. This is scoped source equality, not a claim that the entire repository root matches the development branch.

| Subtree | Both merged and reviewed Git tree |
| --- | --- |
| web/lib/socialShare | `09ce43b9cf07bb5908a903c825cc1b1a506a2f12` |
| web/components/SocialShare | `ce63cdc5f55fbc6c208e330593d290370b9ae6c5` |
| web/pages/api/v1/social-share | `7c1cf228bfd18c17c338c89396dcec70a53f5578` |

Exact remote file reads also confirmed the five key pager/Standouts blobs individually. Evidence is saved in `PR403-METADATA.json`, `PR403-MERGED-TREE.json` and `PR403-TREE-COMPARISON.json`.

## Findings carried into the merge

**F2, P2/medium — still present.** [Merged PeriodControl.tsx, line24](https://github.com/FHFHockey-dev/fhfhockey.com/blob/295b384da47f2a4665a76d841d3d1aa701912d8c/web/components/SocialShare/PeriodControl.tsx#L24) retains the old calendar when the fresh call fails. Its cutoff still comes from the separately fetched calendar, not the edition. `F2-REFRESH-RESULTS.json` reproduces a Week4 pager with a Week5 refreshed edition and no alert; a second case reproduces a Week5 pager with an edition generated in Week4 when the calendar request crosses midnight. The ordinary success-case fix and test are included but do not cover these two cases. Remote blob `748e212dcba70fc8ff4afca3432d2849ad5b12ac` exactly matches the reproduced code. The parent PostStudio blob matches too.

**F3, P2/medium — still present.** [Merged Standouts loader](https://github.com/FHFHockey-dev/fhfhockey.com/blob/295b384da47f2a4665a76d841d3d1aa701912d8c/web/lib/socialShare/modules/lastNightsStandouts.sources.ts#L19) uses only skater dates to identify selected/latest/neighbor slates and returns before checking completed team or goalie data. A slate with completed game/team/goalie rows but no skater rows is wrongly called “No completed games” and skipped in the pager, including goalie view. `PROBE-RESULTS.json` contains the original exact-function reproduction. Remote loader blob `309d4515d9d067b4beef9c93bcf0b15ec88aa229` and module blob `8b5e10ea402f5db65561109ee50e25bf31ad5dfd` match the reproduced source. Export remains blocked for that explicit missing selection; the explanation/navigation are wrong.

**F1 — fixed in merge.** The shared any-week default's end > yesterday correction is present in the matching `periodWindow.ts` blob.

These are source/reproduction findings, not claims that an affected production user has already encountered either condition. No production smoke request was made.

## Render evidence and release description

The retained `integration/real-periods/render-report.json` remains unchanged, SHA256 `fdcedc09bf60e59c41204c0c5c8cc3f1fe953a550cff110aaf75563e927abe43`: 17 cases,16 PNG exports,13 “Weeks unavailable” statuses. The intentionally disabled past Risky Starts export is distinct from those calendar failures. This evidence gap does **not** prove that the deployed calendar is unavailable; its cause may be the capture harness. No incoming explanation, successful replacement control evidence, or final source/capture binding has been supplied.

The PR body claims “Codex review: 0 blockers, 0 high, its 1 medium fixed”. This appears to summarize the older companion audit at `2aa77ee0a` and the happy-path remediation. It does not reflect this reviewer's two open P2s and repeated hold notices, including follow-up proof published at19:57 and the20:06 handoff. The coordination mailbox still has no acknowledgement/disposition from Claude. Do not interpret the PR wording as final acceptance by this reviewer.

Owner claims in the PR—15,715 unit passes,61 skipped, clean type/lint, production build and134 browser passes—were read as claims. They were not independently rerun or certified here. Existing independent targeted evidence remains valid for matching source:590 initial tests,20 shared-fix rechecks,167 delta tests, with overlapping totals kept separate. No repeated suite was needed to establish identical merged blobs.

## Requested disposition and bounds

Claude should correct/qualify the audit statement, explicitly acknowledge both open P2s, and provide fixes/dispositions plus the missing calendar-render explanation/evidence. This review does not authorize rollback, hotfix publication, deployment or any production action. No such action was taken. The same reviewer retains the follow-up assignment; do not launch a duplicate audit.

All remote work in this reconciliation was read-only GitHub metadata/source access. The connector lacked a Git-tree endpoint; a sandboxed `gh api` request initially failed network access, then the same bounded read succeeded with approved network access. Local merge objects were absent; no Git fetch/ref/index mutation was used. A process-status `ps` read was sandbox-blocked, unrelated to source verification.

Evidence checkpoint: 2026-11-01T20:13:31.949962+00:00
