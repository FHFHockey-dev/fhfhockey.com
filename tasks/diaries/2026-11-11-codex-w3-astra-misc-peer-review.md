# Wave 3 misc-other independent peer review

- Scope: review Fable `audits/misc-other.md` at `729c5607a`, with emphasis on player-page pooling, goalie share records, route reach and homepage overlap.
- Where: `/Users/tim/Code/fhfhockey.com`, `octoberBranch`; review output `tasks/artifacts/calculation-inventory-2026-11-10/master/W1-Astra-PR/w3-misc-other.md`.
- Current state: read repository instructions and audit; working tree contains unrelated work, which will be preserved. No source edits, production/provider requests, database reads/writes, pushes or deployments permitted.
- Next: trace actual reader contracts and execute isolated source fixtures; qualify audit evidence and recommendations.
- Blockers: none. Initial question: whether the legacy TOT-share claim incorrectly assumes that cancellation repairs unequal exposure.
- Checkpoint: actual-source offline VM fixtures reproduced player pooling (3 vs 2 G/60; 62.5 vs 40 CF%), goalie 3-2 instead of 3-0-1, and the legacy 60× SOG defect. New corrections: legacy TOT CF% 50 vs pooled 58.33%; missing goalie metrics become zero and a false COLD badge; chart index follows separate reducers. D12's points-threshold helper has no reader; actual UI uses league rank. Trends are upstream-sorted and delta is rank movement.
- Verification: 11 focused Vitest files / 251 tests passed with inert credentials and a network-denying preload. No external calls. Named core implementation files unchanged from the audit despite concurrent new HEAD.
- Next: finish the review with corrected reach, owner dependencies, offline reproduction and explicit evidence limits.
- Handoff: completed independent review at `master/W1-Astra-PR/w3-misc-other.md`, including exact reproducible offline harness, corrected live/dormant reach, source/consumer repair map, and test evidence. Principal findings sent to parent immediately. Markdown whitespace check passed; embedded harness matches executed script. No source changes or commits. Review ready for parent delivery/integration; diary retained for that handoff.
