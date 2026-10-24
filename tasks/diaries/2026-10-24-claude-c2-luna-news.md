# C2 LUNA-LOCAL repair + NEWS metadata-loss (Claude, 2026-10-24)

## Scope
- Slice 1: LUNA-LOCAL F1 (Decisions-leg holds reported review_only, CLI exit 0), F2 (attempt overcount), F3 (whole-project tsc TS2345 Buffer→BinaryLike).
- Slice 2: NEWS-SOURCE-PRESENTATION sync metadata loss: synthetic writer→loader→JSON failing test, smallest fix proposal.
- Snapshot only: /private/tmp/fhfh-c2-isolated/web. Canonical files and protected pins are read-only. No Git, no dispatch, no paid calls.

## Where
- **Base:** HEAD 2a5092d37 (octoberBranch). All 12 canonical pins matched at 16:14Z, and again after both slices.
- **Snapshot manifest:** /private/tmp/fhfh-c2-isolated/SNAPSHOT-MANIFEST.sha256 (4046 files, sha de744d55…, 16:14:20Z).
- **Outputs (handoffs/C2/):**
  - Luna: C2-LUNA-F1-F2-F3.patch (b6dc017e…), RECEIPT-LUNA.md, luna-evidence/.
  - News: C2-NEWS-METADATA.patch (4ac0b496…), RECEIPT-NEWS.md, news-evidence/.
- **Scratch:** /private/tmp/claude-501/-Users-tim-Code-fhfhockey-com/622ce9ac-39ba-4f02-ab8f-0330e32934fd/scratchpad/c2 (configs, network guard copy, logs).

## State / checks
- **Luna:**
  - Original failures: 5 failing regressions on the unfixed source; CLI K2/K3 exit 0 review_only; scoped tsc showed the 2 TS2345 errors.
  - After the fix: 46/46 tests; K2/K3 exit 2 held attempts 0; K1 byte-identical; ESLint 0; whole-project tsc 0 (lock 16:19–16:20Z).
- **News:**
  - Original failures: 4 failing on the unfixed writer; claims [] despite a valid retained interpretation.
  - After the fix: 50/50; neighbours 157/157; scoped tsc 0; ESLint 0 errors; whole-project tsc 0 (lock 16:26–16:27Z).

- **News R1 (orchestrator chose variant b, 16:35Z):** the builders write `retainedInterpretation`.
  - Canonical writer: 5 fail, byte-identity passes. Variant (a): byte-identity fails. R1: 51/51.
  - Cross-writer public view is byte-identical (0be4e781…).
  - Neighbours 158/158; scoped tsc 0; whole-project tsc 0 (lock 16:47–16:48Z).
  - Patch C2-NEWS-METADATA-R1.patch (c7f29a2c…), RECEIPT-NEWS-R1.md. The snapshot now holds R1.

- **Ticket 3 (CODEX-022/-024/-034, 17:00–17:50Z):**
  - **Copy:** NewsCard plain copy "We couldn't verify the player details in this report.". Unmodified card 13 fail, candidate 39/39, neighbours 251/251. C2-NEWS-COPY.patch (ded81fc5…), RECEIPT-NEWS-COPY.md.
  - **Dup:** a linkless IFTTT event and the snapshot naming it (metadata.iftttEventId) got two identities. R1 writer 3 fail, fixed 56/56, wide 352/352 (15 env-gated skips). C2-NEWS-DUP-on-R1.patch (5414faf0…, applies after R1), RECEIPT-NEWS-DUP.md.
  - **Parser evidence:** 9 synthetic shapes did not reproduce the prose capture; one shape loses a name (a line becomes a D pair). PARSER-EVIDENCE-NOTE.md.
  - Whole-project tsc 0 (lock 17:46–17:47Z).

## Next
- C7 independently reviews both patches. C7's own controls C05/C06/C07 and the K2/K3 expectations may need updates for the new held/attempt semantics.
- News: the release owner decides between variant (a) interpretation, which reaches the public validator, and (b) retainedInterpretation, which is authority-neutral.

## Blockers / approvals
- None for C2. Integration into canonical, and the public-authority choice for news, belong to Codex/TJ.

## Gotchas
- In zsh, `echo ====` fails (`=` expansion). Quote it.
- The homepageNewsCompatibility playerIdentity mock needed a partial mock (`normalizeIdentityName`) before the automation builder could run.
- `newsLineupPresentation.ts` also reads `metadata.interpretation` (units precedence over a legacy lineupCard).
- vitest default cacheDir would write into the symlinked canonical node_modules, so always pass cacheDir in scratch.
