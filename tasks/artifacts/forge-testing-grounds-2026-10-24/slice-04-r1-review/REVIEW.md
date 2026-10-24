# ACCEPT WITH LIMITS — S04-R1 completion formatting

**S04-R1/P2 is resolved on the new two-file pins.** Incomplete work that would round to100.0% now reads “Less than 100% complete.” Exact processed/eligible/pending counts and incomplete/fully-processed status appear in aria-valuetext. Native progress attributes and the operational JSON ratio/counts are unchanged. No new correction defect reproduced; Scout retains acceptance.

| File under `web/lib/forge-testing-grounds/preview/` | Reviewed SHA-256 |
| --- | --- |
| `TestingGroundsPreview.tsx` | `0ba7e33fbddf0eb846811f1be0e9062f2980ce78316c68f60c7174d890f3be4d` |
| `TestingGroundsPreview.test.tsx` | `b7eaba367791e360d4f7d1fa67f1a992fb77e7433d15da214e51fe66c384cae1` |

Canonical `octoberBranch` HEAD `2a5092d37cb863ec92a2a4e609999cf226bfa4a5`. Exact hashes identify this uncommitted pair. All **99/99** candidate/protected/artifact pins match at start/end, including **90 protected pins**. The two before-pins match original slice04 EVIDENCE. Explicit supplied HANDOFF/EVIDENCE hashes match `f34bb7eab023146237ff05c6c6ff36718f94680dbc5c101a9c44c988c53345be` / `d39cea9ad75ad483a0d9bb5ca272d40f0894f70228fa34f80f99d9dbb73758cf`. Original failure/test/log, original slice04 HTML/renderer and original EVIDENCE remain unchanged. [PINS.start.json](PINS.start.json) / [PINS.end.json](PINS.end.json).

## Focused correction evidence

Source inspection confirms the small helper only changes the visible label when rounded percent is100.0 and exact processed count differs from eligible count. It does not clamp/rewrite the underlying percent or any counter. aria-valuetext describes processed work rather than success, preserving the distinction for skipped/failed units. Styles, fixture rows, pure progress/health contracts and runner/auth sources remain protected.

Actual one-run DOM result: **9 passed / 12 intentionally skipped**, three files:

- Original unchanged S04-R1 failure and adjacent zero/pending/all-failed control: **2 passed**.
- Four owner boundaries:99.9%,99.99%, one pending at the largest safe denominator and exact completion: **4 passed**. Native values, exact accessible text and unmodified operational JSON verified.
- Three independent controls: mixed successful/skipped/failed counts that remain one unit short; fully processed failed work without a successful claim; queued zero work with exact pending count: **3 passed**. Each checks native attributes/accessibility wording and JSON equality with the unchanged pure projection. Source in [completion.test.tsx](completion.test.tsx).

No failed reviewer check, correction or retry. The other twelve tests were deliberately filtered out; no repeat of unrelated health/IO/visual/runner suites. Prior no-I/O/sealing/rendering findings remain bounded to their original evidence; this diff introduces no import, handler, timer, storage or network behavior.

## Commands/results

Cwd `web/`, existing Node22.11.0/npm10.9.0. Exact argv, timings and artifact-local cache/log overrides: [COMMANDS.json](COMMANDS.json).

```sh
npm test -- --run --config ../tasks/artifacts/forge-testing-grounds-2026-10-24/slice-04-r1-review/review.vitest.config.mts --maxWorkers=1 --no-file-parallelism
```

**Passed, exit0:9passed/12skipped**, actual output [completion.log](completion.log); retained punycode deprecation warnings.

```sh
npx --no-install tsc --noEmit --strict --skipLibCheck --target es2015 --lib dom,dom.iterable,esnext --module esnext --moduleResolution bundler --esModuleInterop --jsx react-jsx next-bootstrap.d.ts lib/forge-testing-grounds/preview/TestingGroundsPreview.tsx lib/forge-testing-grounds/preview/TestingGroundsPreview.test.tsx
npx --no-install eslint --report-unused-disable-directives-severity warn lib/forge-testing-grounds/preview/TestingGroundsPreview.tsx lib/forge-testing-grounds/preview/TestingGroundsPreview.test.tsx
```

**Passed, exit0 each**, empty [scoped-ts.log](scoped-ts.log) / [scoped-lint.log](scoped-lint.log). Explicit-file checks only, not application-wide verification.

## Artifact/Library and acceptance limits

New R1 HTML is236446bytes, SHA-256 `acc143342a811483740253c58176819be8ae40570a8b2bfeeb3066932ec49c77`; original HTML remains unchanged. Static HTML inspection finds the expected connect-blocking CSP and no external resource attributes: [ARTIFACT-STATIC.json](ARTIFACT-STATIC.json). This reviewer did not rebuild, execute or upload the artifact, operate a server/browser or use a browser slot. Owner's actual artifact jsdom execution is retained owner evidence.

The local, hash-verified LIBRARY-REPLACEMENT.json records succeeded, expected_current_version0→current_version1, same Library identity `libfile_cc38ec891b2481918b7a88ecd0c24341`, file `file_000000009e9c81fdb6b4a09b473d9f4a`, name `preview(2).html`. No remote Library lookup/download, version re-verification or sharing operation was performed by this reviewer.

aria-valuetext attribute assertions are **DOM evidence only**. No actual screenreader/native progress announcement, browser/layout/contrast/keyboard/touch/mobile/screenshot QA was performed. This review does not qualify a production route, real health lifecycle, server owner boundary, launch/persistence/reveal integration, real model or full dashboard. Slice05/page/auth work is outside scope; S03-R1's E+W hosted-budget qualification remains unchanged.

Only this reviewer namespace and existing diary append were written. No owner/shared source, old evidence, config/package/schema, coordination/master/ledger or Git mutation; no production/provider/paid call, browser/server or new worker. No blocked, denied, pending-approval or running reviewer action. Original CHANGES REQUIRED remains history for the old preview source pin; this report resolves S04-R1 only for the new pair.
