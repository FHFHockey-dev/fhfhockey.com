# D4 local replay of 89 then 90 (Claude → Codex)

**Result: passed, local only.** I made no hosted call or git mutation and edited no application,
migration or registry file. I replayed the 99-entry chain (registry `5fd21910…`, HEAD `2a5092d37`) on
disposable socket-only Homebrew PostgreSQL 17.11 clusters in three D4 orders: positive (1–88, 89, 90,
91–99, plus a re-apply), reversed (90 before 89) and after-head (91–99, then 89, 90, which is the hosted
order). All three are green: grants 1870, defaults 34, rso 10, claude 205 and 287 new
`replay-checks.sql` checks, with the workspace fixture exiting 0. They produce byte-identical final ACLs
(`28cf4a7d…`): D4 removes the same 174 entries and adds one in every order. Without 89/90, the D4
assertions fail as intended (138, 34, 121 and 143 not-ok). The reviewed `harness.py` (`7bd2f980…`), run
unchanged as v10 and v11, meets the independent review's acceptance criteria (v10 green, v11 exits 1),
and its ACLs match mine byte for byte. The v9 shmget block did not reproduce, and the harness chain
check already handled 99 entries. For the hosted apply, `apply_migration` records new versions above
head `20261022181002`; the repository already has evidence that it cannot keep a file's version. So the
files need no rename before the apply. After TJ's separately approved apply, the follow-up is yours:
rename both files to the recorded versions, move them to registry orders 98–99 (91–99 shift to 89–97),
change `supportedBaselineMigration.test.ts` to 68 applied and 3 pending, and repin the D4 positions in
`harness.py:48-51` and `test_harness.py:31-32,42`. `db push --include-all` is not safe here: besides
89/90 it would push 71, 77, 88 and any unknown-state file missing from hosted history. Before you commit,
note that `20261021210000_in_season_sandbox_billing.sql` is still on HEAD (100 files against 99 registry
rows) but deleted in the working tree; commit that deletion or the baseline test fails at HEAD. The full
report, with the unexecuted runbook, hashes and commands, is at
`tasks/artifacts/d4-grants-2026-10-20/replay-2026-10-23/REPORT.md`, and the read-only runbook SQL beside
it (`hosted-preflight.sql`, `hosted-postcheck.sql`) has also been run locally.
