# Chef rerun of the evidence-bridge suite (2026-11-15)

- Full suite (`node --test tests/bridge.test.mjs`): **13/14 pass**.
  - Test 14 (fidelity) failed **closed** on the runner's 120 s budget: `elapsedMs` 892,502 in a run that normally takes about 22 s.
  - Durations elsewhere in the same run were inflated too (test 3: 3,015 s; test 13: 337 s), which points to a machine stall or contention, not a code defect.
- Test 14 rerun alone (`--test-name-pattern=fidelity`): **pass**, 32 s.
- Conclusion: all 14 pass at the current bridge bytes (SHA256SUMS: 15 entries, all OK at rerun time). The stall incidentally shows the deadline guard firing in a real process.
- The author's own claim was "full suite 14/14, then three asserts added, only TLS tests rerun". This rerun is the full-suite check after those asserts.
- 2026-11-15: Chef full-suite rerun at the v4-aligned bridge: **17/17 pass** (FULL-SUITE-RERUN-v4.log).
- 2026-11-15: Chef rerun after the acquisition tool: **20/20 pass**, SHA256SUMS 18/18, tool `e075b90a…`, `APPROVED_ACQUISITION_TOOLS` empty (FULL-SUITE-RERUN-acq.log).
- 2026-11-15: Chef rerun at tool `4f8a0888…`: see FULL-SUITE-RERUN-acq2.log.
- 2026-11-15: Chef rerun at tool 4f8a0888 = 0/21. Cause: the candidate v5 work overwrote the live successor verifier/pins/patch (b86af692/a2a1e694/e8be50de) that the bridge reads by path. Not a tool defect. Bridge asked to vendor the approved v4 inputs by hash; reviewer warned. Rerun after vendoring.
- 2026-11-15: Chef rerun after vendoring (tool 4f8a0888, v4 inputs vendored): see FULL-SUITE-RERUN-vendored.log.
- 2026-11-15: Chef rerun at v5 rebinding (tool aa8a9cb7): see FULL-SUITE-RERUN-v5.log.
