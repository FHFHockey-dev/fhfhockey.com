# P02-R1 extension — independent acceptance

**Qualified local acceptance: P02-R1 is closed for this three-file candidate. No new defect was identified in the extension.** Both original imported-component failures now pass. This closes the unknown-participation caller gap; broader P02/data/release qualification remains separate.

`PlayerSummaryStrip.tsx:65–76` and `PlayerStatsSummary.tsx:24–35` validate the unfiltered selected log before appearance filtering. The check matches the existing contextual consumer: `games_played` must be a finite, nonnegative numeric value. Unknown or invalid participation makes SV% and GAA unavailable; it is not inferred from complete counts. Known numeric zero still gets excluded as a nonappearance. The Trends check follows the selected regular-season/playoff log. No aggregation formula, query, helper, qualification threshold or VuDu weight changed.

**Independent verification:** all **26 imported-component tests passed**: two unchanged original failure oracles, six unchanged original controls, and 18 extension regressions/controls. The original 27/30 plus null-participation/incomplete-count row now produces unavailable Overview and Trends SV%, matching the contextual card. The added controls also establish unavailable GAA, complete pairs yielding `.925` and exposure-weighted `3.43`, exclusion of known zero despite missing counts, observed `.000` / `0.00`, missing-pair rejection, playoff-window switching, and preserved skater count/SH% behavior. Scoped TypeScript and three-file ESLint both exited **0**, with no diagnostics.

## Pin reconciliation

The preservation claim is correct **for the named nine-file lease and 13 A7–A9 paths**, not for every historical dependency fingerprint:

| Historical/current set | Independent reconciliation |
| --- | --- |
| Original P02 nine source/test files | All 9 unchanged; no extension file overlaps these paths |
| A7–A9 fence | All 13 unchanged; no extension file overlaps these paths |
| Old owner 50-file import closure | 49 unchanged; `PlayerSummaryStrip.tsx` intentionally changed |
| Old independent 51-file closure | 49 unchanged; both `PlayerSummaryStrip.tsx` and `PlayerStatsSummary.tsx` intentionally changed |
| Extension | Those two modified consumers plus new `PlayerGoalieSummaries.test.tsx` |
| Current extension import closure | All 52 canonical/scratch hashes matched before and after this review |

Thus the earlier caller hashes are superseded, not still-valid acceptance pins for the corrected consumers. The original nine-file manifest remains unchanged at SHA-256 `ed8550bfaf63983d71bd8f203de16f3fd5ac1013409db1bae1b169d6d266a275`. The earlier 96-test pass is a **historical receipt**, not a fresh pass for the changed dependency closure; it was not rerun or added to this pass's 26-test count. Fresh focused tests and scoped compilation cover the extension.

## Accepted snapshot

The prior independently reviewed source archive was reconstructed in a fresh isolated directory, then the exact `extension.patch` was applied with `git apply --check` and `git apply`. All 52 resulting source/configuration files matched the extension manifest and canonical bytes. Before/after copies also matched their recorded hashes. No checkout, branch or application source was modified by the reviewer.

Branch/HEAD stayed `octoberBranch` / **`a565238f670edc4cf65da79ad52ba82ec41f3b71`**. Working-tree fingerprints establish the candidate beyond the commit alone:

| Accepted path | SHA-256 |
| --- | --- |
| `web/components/PlayerStats/PlayerSummaryStrip.tsx` | `3956e59250acfa65c7d855b512268da1416825319953fda71778e0a773385b84` |
| `web/components/PlayerStats/PlayerStatsSummary.tsx` | `7dbddd62b5d1b8469b96daa2652b96d8649362d517db77ec0aec1dd65a8687d3` |
| `web/components/PlayerStats/PlayerGoalieSummaries.test.tsx` | `97422008b0835ac6aa8e33e9223aa42a594df8e1d461fad0ec74152aa0f97e10` |

Extension patch: `712a58a6ee28d936672f62979e092d1e94f158b4fdc3912c57cc18bb08b270f7`.

Original independent test, unchanged: `5d59b1e227962677b784f271518d5914ca13d9a45ad2800a6957d366eb6b099c`.

Independent retained source archive: `ad9bf818c61b1f86f3c77e1779fed3b5aed8d5c07226a88a0ff5461d859d2980`.

Start/end integrity JSON records 77 manifest comparisons (with overlap), exact path membership and historical-caller reconciliation. `focused-tests.log` / `.json`, empty compiler/lint logs, `verification.json`, `RUN-CHECK.sh` and `COMMANDS.md` retain the independent receipts. Historical owner/reviewer packets were not rewritten.

## Boundaries

Execution used Node **22.11.0**, npm **10.9.0**, Vitest **3.2.7**, existing installed dependencies, an empty inherited environment with synthetic `.invalid` service values, inert npm configuration, `envDir:false`, one worker and the retained offline network-deny preload/setup. No network-block diagnostic occurred; the existing `punycode` dependency warning remains benign. No paid/API/service call, credential/private-data access, application edit, dependency change, Git mutation, build or deployment occurred.

The existing profile QS/time omissions still yield unavailable results; source hydration, numeric TOI type reconciliation, live data validity/grain, season joins and broader P02/S07/S12 closure remain open. Existing no-appearance summary visibility is unchanged. No full suite/compiler, browser, full player-page SSR or live/provider evaluation was run. This accepts a bounded local correction, not a release or model qualification. There is no execution blocker; later source changes require new hashes and review.
