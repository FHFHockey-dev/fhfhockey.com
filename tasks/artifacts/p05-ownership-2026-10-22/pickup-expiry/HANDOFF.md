# P05 pickup mounted-freshness correction

Local correction complete; independent review pending. This supersedes only the two pickup-table hashes from `../pickup/`. Independently accepted R1 ambiguity handling and A5/A10 remain unchanged.

## Exact changed-file inventory

- `web/components/PlayerPickupTable/PlayerPickupTable.tsx`: rederive current ownership and freshness from the retained source value/date on render. Schedule one local timeout for the next freshness transition; recheck on visibility, focus and page restore, and clear the timeout/listeners on cleanup. Hidden tabs stop scheduling until resumed. Filter interactions also use the current clock if a timeout was delayed. The original observation stays in `playersData`; the derived display/filter rows do not mutate it or trigger data effects.
- `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`: six mounted-clock regressions covering desktop/mobile expiry, hidden/resume via visibility/focus/pageshow, and interaction before a delayed timeout. Each verifies stale eligibility is excluded when unknown ownership is disabled, retained zero/date remain visible when included, and no additional database reads or fetch calls occur. Fixtures explicitly install Date and timeout fakes and restore visibility mocks after each test.

Administrative changes are this bundle and the continued task diary `tasks/diaries/2026-10-22-codex-p05-pickup.md`; the diary remains excluded from release candidates. No shared canonical register was edited.

## Before and after

Fixture: a source observation of **0% on 2026-10-19** is loaded at **2026-10-21 23:59:59 UTC**. Before, freshness was computed once and remained 0% after the three-day limit; disabling unknown ownership retained the player. All six final regressions fail on the exact prior component (`40b10373…`).

After, the existing inclusive three-day policy is unchanged: the observation is fresh at the exact boundary, then becomes current-ownership null after it. The row displays **Last known 0% · 2026-10-19 (stale)** and is excluded when unknown ownership is disabled. A suspended timer does not preserve eligibility after resume or interaction. Source date/value, ownership thresholds, provider/authentication/billing rules and source freshness policy are unchanged. There is no polling, data refresh or service call.

## Verification and fixed pins

All commands ran in sanitized `/tmp` snapshots, using Node **v22.11.0**, npm **10.9.0**, synthetic `.invalid` configuration, and socket/HTTP(S)/fetch denial. No ignored env/credential files were copied.

- Final regression red: **6 failed / 25 skipped** against the exact pre-correction component.
- Final component suite: **31 passed**.
- Scoped TypeScript and ESLint: **exit 0**, no diagnostics.
- Canonical scoped `git diff --check`: **exit 0**.
- Canonical candidate matches tested bytes. Protected billing hook/state/full sync effect/notice/eligibility and league-availability sections match the prior handoff. R1's four files, A5/A10's two files and the trends route match retained pins.

Exact working directories, sanitized command wrappers and results are in `COMMANDS.json`. Commands inside the wrapper:

```sh
npm test -- --run --config audit.vitest.config.mts components/PlayerPickupTable/PlayerPickupTable.test.ts
npm exec --offline -- eslint --report-unused-disable-directives-severity warn components/PlayerPickupTable/PlayerPickupTable.tsx components/PlayerPickupTable/PlayerPickupTable.test.ts
npm exec --offline -- tsc --noEmit -p audit-pickup.tsconfig.json
```

The red command adds `-t 'mounted pickup ownership freshness'`. Final receipts are `red.log`, `green.log`, `lint.log`, `types.log`. An intermediate fixture had already enabled Date-only fake timers; a second call did not replace native `setTimeout`, so its two timeout cases failed. `timer-diagnostic.log` shows native timeout/zero fake timers; restoring timers before installing the full clock fixture resolved this. That superseded run is retained as `superseded-timer-fixture.log`; it is not a product failure or final acceptance receipt.

| File | Fixed SHA-256 |
|---|---|
| `web/components/PlayerPickupTable/PlayerPickupTable.tsx` | `169e2d681069599a9980337d8888583fcc3072932288430e6dac6ba3b1d75b77` |
| `web/components/PlayerPickupTable/PlayerPickupTable.test.ts` | `bb80fb4e1642307a8c852362f71262e2a35af9cda39778b9751d4a222b0f234e` |

`correction.patch` is the delta from the prior pickup candidate; `fixed-source.tar.gz` contains the two full tested files. `FILE-HASHES.json` records pre/fixed hashes, final red-fixture pins, retained dependencies, protected billing sections, tested snapshot and HEAD. Source/checksum validation from repository root:

```sh
shasum -a 256 -c tasks/artifacts/p05-ownership-2026-10-22/pickup-expiry/SHA256SUMS
shasum -a 256 -c tasks/artifacts/p05-ownership-2026-10-22/pickup-expiry/EVIDENCE-SHA256SUMS
```

This is mounted React/jsdom clock/event coverage, not real-browser suspension, focus rendering, touch or assistive-technology verification. No application server/build, full suite, full-project type-check or RSO persistence check was run. No network, production/service/NST request, credentials, runner/process change, commit, push, deployment, migration, dependency or lockfile change occurred. No denied, pending or uncertain tool action; independent review is the remaining step.

Bundle inventory: this handoff, `COMMANDS.json`, `FILE-HASHES.json`, `SHA256SUMS`, `EVIDENCE-SHA256SUMS`, `correction.patch`, `fixed-source.tar.gz`, `audit-pickup.tsconfig.json`, four final logs and two diagnostic/superseded logs.
