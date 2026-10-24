# P05 pickup-table extension — unknown ownership and dated evidence

Local implementation complete; independent review pending. Parent released the component after the billing owner finished. Exact pre-edit SHA `b022eec9f26e9ae6fe292ed3480fea9a245cc94b7df8fa7c2461d8fcac8994b1` matched before editing. R1 route/client correction is separately pinned in `../r1/`.

## Exact application inventory and behavior

- `web/components/PlayerPickupTable/PlayerPickupTable.tsx`: strict ownership parsing at the season lookup and row/timeline boundary; carries the existing P05 `ownershipEvidence` type. Valid dated observations outrank undated fallback values. Missing or malformed ownership is Unknown; genuine zero remains zero. Older observations retain value/date and display `Last known 0% · 2026-10-18 (stale)`. Undated valid values display `Last known 0% · date unknown`. Only fresh dated values are current numeric ownership. Both desktop/mobile cells preserve the source date; dated values also have a Yahoo/date title. The native labeled “Include unknown ownership” checkbox defaults on, filters unknown separately from the percentage slider, resets with filters, and is disabled in league mode.
- `web/components/PlayerPickupTable/PlayerPickupTable.test.ts`: correct provider-access mock seam; fixed Date clock; malformed/missing values, numeric/string zero, stale JSON timeline with invalid newer point, desktop/mobile labels and filtering. Existing league roster/status/retry assertions remain; league-mode tests also assert the unknown filter is disabled.

Before: blank strings became 0%, an undated season value could hide an older dated zero, and unknown/stale source age was absent from the table. After: no measured zero is fabricated; last-known values retain their dates and cannot masquerade as fresh values. There are no new queries, freshness thresholds, reclaim probabilities or saved-state changes. The existing three-day policy is applied with the same source-day/clock semantics as the P05 client.

The existing billing delta is preserved: provider-sync hook/import, full state/eligibility/sync effect, notice and guarded account/league controls, and the league player-availability guard match the pre-edit bytes. `FILE-HASHES.json` includes hashes of those protected text sections. No billing source, provider entitlement policy, authentication or league filtering rule was reworked.

## Verification and pins

All checks ran offline in sanitized `/tmp` snapshots with Node v22.11.0/npm 10.9.0, synthetic `.invalid` configuration, and socket/HTTP(S)/fetch denial. No network, database, provider, NST or paid API request occurred.

- Final fixtures against exact pre-edit component: **14 failed / 11 passed**. This red receipt contains application-behavior failures, not the earlier fixture-query errors.
- Final fixed source: **25 passed**.
- Scoped ESLint and TypeScript: **exit 0**, no diagnostics.
- Scoped canonical `git diff --check`: **exit 0**.
- Protected billing sections, A5/A10 files, trends implementation, and R1 dependency bytes verified unchanged at packaging.

Earlier test-only issues are retained as receipts: ambiguous text queries matched unrelated percentile 0% cells; one mobile fixture expected unshortened names; TypeScript rejected the Testing Library `exact` role option. The final tests use actual abbreviated names and an anchored accessible cell-name matcher. `initial-fixture-red.log`, `initial-fixture-green-attempt.log`, and `initial-types.log` are superseded by the final receipts.

Exact sanitized commands and working directories are in `COMMANDS.json`; final results are `red.log`, `green.log`, `lint.log`, `types.log`. Commands inside the wrapper:

```sh
npm test -- --run --config audit.vitest.config.mts components/PlayerPickupTable/PlayerPickupTable.test.ts
npm exec --offline -- eslint --report-unused-disable-directives-severity warn components/PlayerPickupTable/PlayerPickupTable.tsx components/PlayerPickupTable/PlayerPickupTable.test.ts
npm exec --offline -- tsc --noEmit -p audit-pickup.tsconfig.json
```

`correction.patch` contains only the delta from the released component/test preimage; existing billing edits are excluded. `FILE-HASHES.json` records before/fixed hashes, tested snapshot/HEAD, handoff HEAD and retained dependencies. `fixed-source.tar.gz` contains the two tested files. From repository root:

```sh
shasum -a 256 -c tasks/artifacts/p05-ownership-2026-10-22/pickup/SHA256SUMS
```

Checks cover mounted React/jsdom behavior at desktop/mobile widths, not browser layout, touch, focus rendering or assistive technology. No application server/build, full suite or full-project type-check was run. Full persisted RSO restore/revalidation and provider/database behavior remain outside this lease. Existing dirty work and canonical registers were preserved. No commits, pushes, deployments, migrations, dependency changes, credentials or runner/process actions occurred. No denied, pending or uncertain tool action; independent review remains.

Administrative inventory: this handoff, `COMMANDS.json`, `FILE-HASHES.json`, `SHA256SUMS`, `EVIDENCE-SHA256SUMS`, `correction.patch`, `fixed-source.tar.gz`, `audit-pickup.tsconfig.json`, four final and three superseded logs; task diary at `tasks/diaries/2026-10-22-codex-p05-pickup.md` (excluded from release candidates).
