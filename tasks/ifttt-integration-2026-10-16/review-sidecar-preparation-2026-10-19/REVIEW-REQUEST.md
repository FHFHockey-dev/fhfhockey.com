# Ready for bounded independent review

Proposed destination: existing reviewer task `01a142bb-decf-77fe-ac88-1dc20c8ed0f2`. **Handoff has not been sent; direct human authorization requested through the task UI is pending.** No source hold is imposed on other owners.

Review `source-pins.json`, SHA256 `1c7ec613a52dbfc88e59f05e5163b978501d0a7d0f1feafd894e36402dcb67b9`: seven owned files plus 42 read-only dependencies, with exact copies under `frozen-source/`. The owned seven paths will remain stable for the next review. Existing IFTTT implementation/reviews are context, not acceptance of this addition. Dependency hashes were captured after owner verification; this is not an instrumented proof of every module body loaded during the run. `web/lib/newsFeed.ts` is concurrently owned and its current diff concerns team colors; it has not changed the reused relay resolver. Recheck read-only pins before testing; coordinate drift rather than restoring live files.

Suggested reviewer ownership: a new sibling `review-sidecar-preparation-independent-2026-10-19/` only. Preserve all owner, prior review and other-lane files. Review preparation authority, retained source/text/clock binding and enriched-text holds; zero-claim coverage; immutable packet retry; commit-before-preparation failure recovery; concurrency/ack-loss; exact transaction postconditions and bounds. This review must not infer model quality, provider compatibility, durable model execution or publication authority from these tests.

Bounded verification budget: copy the unchanged 33-case harness without writing owner outputs, add only directly motivated negative controls (at most eight), and run one scoped TypeScript check. No broad suites, full compiler/build, hosted calls, model requests, credentials, production/DDL/flag/queue/scheduler actions. A new reproducible contract failure should stop dependent expansion and be reported with the exact pin; release after final rehash before report-only writing. A broader issue needs a separate scope decision.

Owner commands, from `web/` (outputs must be redirected into the reviewer's own root):

```sh
LC_ALL=en_US.UTF-8 TMPDIR=/tmp IFTTT_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin NODE_PATH=. ./node_modules/.bin/vitest run --config ../tasks/ifttt-integration-2026-10-16/review-sidecar-preparation-2026-10-19/vitest.config.mjs --reporter=default --reporter=json --outputFile=<review-output.json>
./node_modules/.bin/tsc --noEmit --project ../tasks/ifttt-integration-2026-10-16/review-sidecar-preparation-2026-10-19/tsconfig.json
```

The owner `storage.test.ts` writes one synthetic held-packet artifact into its own `evidence/`; copy the harness and adjust only its artifact/fixture paths in the review root before executing, preserving test bodies. Private PostgreSQL needs the normal local Unix-socket permission. Selected SQL6/7/8 and only the new SQL9 proposal are fixture inputs. No old/new SQL alternative pairing is authorized.
