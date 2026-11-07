# P2/P3 repair ready for independent re-review

Both findings in `tasks/artifacts/rso-settlement-audit-2026-11-01/REVIEW.md` are fixed in the isolated adapters. This records implementation and local verification, not independent acceptance.

| Finding | Correction | Failing-original evidence |
|---|---|---|
| P2: offset-free readback capture clocks vary by machine timezone | Both RSO and Start Chart reject capture clocks without explicit `Z` or numeric offset; real calendar dates are required. Valid original representations are retained. | Five new failures: four consumer/timezone combinations plus impossible capture clocks/dates. Original readback source: `300257339bfa5db82a659a57f13fd2de8d150ae7fc445c70fd412258c0cdd2e2`. |
| P3: impossible settlement timestamps normalize to another date | Capture, source, issue and scheduled clocks use the production strict parser before chronology. Sub-millisecond ordering uses its bigint microseconds. | Six new failures: four November 31 clocks, non-leap February 29 and microsecond chronology. Original settlement source: `ed4b33a04806ca7702d6611decc12f09ace270d7528c5f3c0caf886fb5c555ab`. |

`before.json` and its two logs retain the baseline: readback **13 pass / 5 fail**, settlement **12 pass / 6 fail**, with original source pins independently recorded by the audit. No source fix preceded those runs. The valid explicit-offset readback regression already passed before the fix.

`after.json` contains the exact commands and logs: **18 readback tests and 18 settlement tests pass under both UTC and America/New_York**; **11 E1 binding-preflight tests** and **21 integrity-checker tests** also pass. That is **68 distinct tests, 104 executed cases** with the timezone repeats. Readback tests ran with TypeScript checking enabled; tests include real RSO transport decoding, both consumer normalization flows, their integrity CLI, and settlement CLI/checker integration. Unknown values, observed zero, denied uses, identity checks, New York settlement floor and explicit versions retain their prior behavior.

Both adapters reuse `web/lib/projections/evidenceTime.ts`; the runtime parser is unchanged. `timestamp-parser.cjs` lets the standalone E3 and E1 Node entry points load that pure utility through the already installed ts-node. The E1 preflight was previously drafted while settlement review was underway; it received the same shared loader and its tests passed again. It does not score or admit forecasts. `SOURCE-PINS.json` binds all review files and the unchanged dependencies.

Re-review scope: `normalize-readbacks.ts/.test.ts`, `normalize-settlement.mjs/.test.mjs`, and `timestamp-parser.cjs`. Please independently confirm that both original audit reproductions now reject before any normalized rows are accepted, that valid offset and leap-day inputs survive, and that the loader does not introduce service/configuration side effects. The E1 preflight is separately described in `../ISSUED-PACKET-HANDOFF.md` and is available for its own review.

No application/held-tooling edit, scientific scope mutation, Git mutation, provider/production request, build or deployment was performed for this repair. No further 403 access attempt occurred. The final admission commit remains pending from Claude1e668672; the prepared four-file delivery is unchanged. Current model/configuration and authentic issued evidence remain absent, so no live canary or forecast-use qualification is claimed.
