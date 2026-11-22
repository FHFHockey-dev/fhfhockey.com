# TJ approvals · daily off-day release + Nov 21 recovery (verbatim, ~18:06Z Nov 21 / 12:06 CT)

## Batch A
Approve Batch A only on production f47905d28: the Nov 21 recovery for the explicit 13 game IDs 2026020360 through 2026020372. Start only after the appearance repair has a terminal result, no conflicting writer is active, and the preflight confirms every listed game is still unstarted and the completed 0359 live record will not be touched. Start by 2:10 p.m. CT (20:10 UTC). If any game has started or the deployed SHA changed, stop and bring me the revised scope.

Repeat only on HTTP 207 with a verified continuation and the same run lineage. Cap this at three GET attempts total; stop on 422, invalid_row, an ambiguous receipt, or if there isn't enough time to finish before the earliest puck drop. Afterward, read back Start Chart and daily RSO once each and report exactly which games received the new forecast. No broader reset, push, or release B under this approval.

## Batch B
Approve one fast-forward push of origin/master from f47905d28 to exactly 096b78b622a72a8378b8f60c0c7704fc4e2fee41 after Batch A has a verified terminal result or is explicitly called off. Confirm no recovery calls or conflicting production work are in flight and post the push-hold note first. If master moved or the approved candidate changed, stop and bring me the new SHA and gates.

Expect one production web build and three canceled companion entries. Verify READY, the production alias on the exact SHA, and the bounded read-only runs/latest smoke. Report the actual build count and keep dpl_9YQAY1gpwwe8XBa1qWDExzaGzevP as the rollback target. The smoke proves deployment, not daily pipeline recovery. Once verified, hand BLSH the new master SHA and deployment ID. This does not approve BLSH or another recovery run.

## Batch C
Later follow-up (Recommended).
