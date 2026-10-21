# W-C: Q12 pipeline hygiene (Q14 reassigned to another worker)

- Scope: audit REPORT §4.1 Q12 (a–d). Q14 rolling-coverage-check is NOT mine (another worker owns it).
- Where: octoberBranch. Q12 a–c + terminalStop were committed by TJ in ebdcfe6be (goalie marker approach, tests included). This worker's follow-up is uncommitted: firstFailure.code for terminal stops (run-rolling-forge-pipeline.ts ~145, ~1672-1698; test ~1021-1035, ~1296-1311).
- Checks: `npm test -- run-rolling-forge-pipeline.test.ts run-projection-v2.test.ts` 60/60 green (red first: 2 failing); eslint clean on both routes. tsc not run (Chef).
- Decision: kept the durable goalie marker (GOALIE_STEP_DONE_KEY) over datesDone===0: it also covers a run date stuck partial and retries a failed goalie step after date progress; tests exist.
- Next: Chef reviews and commits; cron-report wording goes to the Codex lane as a note.
