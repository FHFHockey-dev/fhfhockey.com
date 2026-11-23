# FORGE preflight timeout (2026-11-23 10:20Z) receipts

- `repro-989ee767c-route-tests.txt`: the new stall tests from the fix commit, run unchanged against a clean
  `git archive` of 989ee767c (production master). Six fail on assertions (121 tests, 6 failed, 115 passed; the seventh new test, a normal-run guard that the rolling step still starts up to 150 s, passes there as it does on the fix):
  the 159 s season-read stall with a hung child answers 387 s after arrival (kill: 240 s); children's deadlines
  shift by the 30 s gate time; a 160 s stall runs the stage instead of recording a retryable stop; a stall past
  the kill answers at 300 s.
- Pre-fix loader reason for a PostgrestError (`{message, code: "57014"}`) on 989ee767c:
  `{"state":"unknown","today":"2026-11-23","reason":"[object Object]"}`.
