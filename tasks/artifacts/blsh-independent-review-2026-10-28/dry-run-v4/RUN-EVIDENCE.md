# Dry run v4: runner evidence

`RUN.log` (SHA-256 `aa5f9fe6f72b10deb5c09e15e655d09e2a25eb9a16eedcbb2631ad070a8b1797`) is the Vitest output of the accepted v4 run (2026-10-29, start 08:04:22 local). It was copied unchanged from the session scratchpad (`dry-run-v4b.log`).
- It records 1 test file passed and 1 test passed, with a duration of 137.81 s.
- It has no "Errors" line and no "Unhandled Errors" section.

**Evidence gap:** the command's exit status is **not** in this file. The wrapper printed `exit 0 in 139s` to the session's command output, not into the log. That exit status was observed in the session but cannot be independently verified from a file. The forecast-v2 log, by contrast, includes its exit line.

**No rerun was made** just to produce a replacement log. Later runners should append the exit status to their logs.

The failed first attempt is preserved separately in `../dry-run-v4-failed-runner-error/RUN.log` (SHA-256 `c5417410…`, exit 1, one unhandled `onTaskUpdate` error).
