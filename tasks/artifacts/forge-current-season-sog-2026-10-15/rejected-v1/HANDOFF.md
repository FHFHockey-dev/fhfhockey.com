# Current-season SOG local increment

Four new source/test files only; no shared producer, admission, loader or consumer edits.

- Model: current-season-sog-appearance-mean-v1. Mean = summed valid SOG / valid positive-minute appearances.
- Fixed scope: canonical 10047 / NHL 8478444 / VAN 23, future VAN at FLA game 2026020112 on 2026-10-15.
- Window: latest up-to-five final regular-season VAN games dated 2026-10-01 through 2026-10-14, enumerated by the supplied original current-season club schedule response.
- Bounds: one schedule + at most five exact boxscores, raw source total <=2MiB, input JSON <=6MiB; no retries/fetch/DB in assembler. Original raw strings, SHA256 values, capture clocks and derived lineage are retained.
- Output: unreleased local packet, count per positive-minute appearance; sample size/dates, exclusions, null participation/uncertainty, calibration unavailable and explicit small-sample/source-authenticity limitations.
- Existing baseline version, formulas, public policies and private pilot unchanged. No actual source collection, genuine numerical source access, producer invocation, database writes, release activation or deployment.

Verification: 31 focused synthetic tests passed; four-file ESLint exit0/no warnings; whitespace checks passed; exact pins verified. No full-tree compiler run. Independent review pending.

Next genuine-input step is source collection only, separately from running the local assembler: obtain and retain one original official VAN 20262027 club-schedule response, then exactly the selected up-to-five final Oct1-14 boxscores, with genuine raw-byte hashes/capture clocks. Max six sequential official GETs, no retries, <=2MiB raw total; reject incomplete/conflicting/oversized input and stop. This increment did not execute that step. Preserve the pilot boundary; collection/execution must not overlap its reserved window. Packet replay alone does not authenticate supplied receipts or approve public use.

Offline CLI (only after genuine input is authorized/admitted): from web/, NODE_PATH=. ./node_modules/.bin/ts-node --transpile-only --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/capture-current-season-sog-baseline.ts --responses APPROVED_RESPONSE_RECEIPTS_JSON --out NEW_PRIVATE_JSON. It writes one exclusive mode0600 local file, makes zero requests and does not persist or activate a bundle.
