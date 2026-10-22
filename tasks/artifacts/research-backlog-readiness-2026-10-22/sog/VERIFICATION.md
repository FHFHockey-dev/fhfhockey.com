# Synthetic SOG contract verification — 2026-10-22

Result: **23/23 tests passed**, zero failed, skipped or cancelled. One Node test execution; no correction/retry loop. Wall-clock duration reported by the test runner: 63.121458 ms. Runtime `/usr/local/bin/node`, **v22.11.0**, matching `web/.nvmrc`.

Executed from `/Users/tim/Code/fhfhockey.com`:

```sh
node --test tasks/artifacts/research-backlog-readiness-2026-10-22/sog/sog-contract.test.mjs > tasks/artifacts/research-backlog-readiness-2026-10-22/sog/TEST-RESULTS.tap
```

The full receipt is [TEST-RESULTS.tap](TEST-RESULTS.tap). [SPECIFICATION.md](SPECIFICATION.md) defines admission, arithmetic, window semantics and proposed presentation. [fixtures.mjs](fixtures.mjs) contains 17 reusable fictional packets, supported by [reference-arithmetic.mjs](reference-arithmetic.mjs) and [sog-contract.test.mjs](sog-contract.test.mjs). The reference module is research-only, with no application imports or consumers.

Coverage includes hand-derived expected counts/frequencies for same-mean/different-distribution samples, inclusive thresholds, valid zero, missing SOG, participation uncertainty, empty samples, partial/unknown source populations, fixed last10 selection, short windows, last20/30, custom dates, season/playoff/finality/cutoff exclusions, exact/conflicting duplicates, trades, malformed inputs, denominator conservation, order/duplication invariance and input immutability. The 23rd check matched all five inspected application source hashes in [SOURCE-REFERENCES.json](SOURCE-REFERENCES.json). This pins source compatibility inspection; it does not execute those application functions.

Application code, tests, dependencies and canonical registers were unchanged. Only this research package, its parent readiness report and the required existing task diary were written. The package reads no private datasets, session stores, environment files or credentials, performs no network/provider/database call, and requires no dependency installation.

Not verified: live source population completeness, raw provider parsing, canonical event identity/finality transport, as-known-at-the-time history, application integration, page rendering/accessibility, or any predictive claim. No application suite, browser, fitting/backtest, build, commit or deployment ran. The precise remaining implementation prerequisites are stable game/team-at-game IDs, finality/source-coverage metadata and agreement with the page owner about the proposed previous-Eastern-day scope. No operation was denied, is awaiting tool approval, or has an uncertain outcome.
