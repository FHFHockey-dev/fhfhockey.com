# Candidate test dependency corrections — completed locally

Owner disposition and explicit Chef grants covered only the following changes. Both baseline test hashes and the mapper source hash matched the accepted candidate before editing. All earlier audit assertions preserved.

| Path | Exact correction | Final SHA256 |
|---|---|---|
| `web/lib/buyLowSellHigh/currentProcessEvidence.server.test.ts` | One equality expression becomes `expect(Array.from(f.requestBytes)).toEqual(Array.from(before))`. Independent `before = Uint8Array.from(f.requestBytes)` copy and `expect(a).toEqual(b)` retained. | `0e3a7dfdb02b4e6271ddc14371e8f6fcf39f1ab80929fc503bdfa6f44b584a23` |
| `web/lib/buyLowSellHigh/displayProfile.test.ts` | Only FIXTURE constant changed to `join(__dirname, "__fixtures__/display-profiles.jsonl")`. PINS/readPinned, cases, historyStatus audit regression, SOURCE/SUMMARY and opt-in block unchanged. | `7d0391a76bcbfbf19cb3876df813166dd9eef0e94c35c9fdb22afc5ac98e475a` |
| `web/lib/buyLowSellHigh/__fixtures__/display-profiles.jsonl` | New 143,457-byte opaque exact copy of the owner-authorized artifact fixture. Destination was absent. No refresh, re-extraction or data regeneration. | `bed954ae624b1877c67fa80c5b5615c471b408655367a5e7805f9be37c32ba33` |

The fixture remains **real saved research profiles**, not synthetic. Authorization is for local verification candidate inclusion only, **not public release/redistribution clearance**. Original artifact remains byte-identical. No source Profiles beyond that exact copy, reserved history, database or provider access.

Source gate remains `9011207c1d16af7a2834a80b4d19d85d0b772a02093eef822e0dd44a9959af83`; mapper remains `6de7898a08f4ece36307b9817ce0dae33f1ee238ebf5eb52dad7f583f4d7178c`. Both verified unchanged after checks. Gate policy and canonical Vitest config/setup untouched.

## Actual verification

Acquired `/private/tmp/fhfh-heavy.lock` atomically while absent, ran the following equivalent focused Vitest command using existing Node/Vitest directly under an empty inherited environment, explicit dummy Supabase values and the **existing composer non-loopback network-denial preload**:

`vitest run lib/buyLowSellHigh/currentProcessEvidence.server.test.ts lib/buyLowSellHigh/displayProfile.test.ts --maxWorkers=1 --reporter=dot`

- **TZ=UTC: 2 files passed, 81 tests passed / 1 skipped**, exit 0, 775 ms.
- **TZ=America/New_York: 2 files passed, 81 tests passed / 1 skipped**, exit 0, 651 ms.
- The existing opt-in packaging test stayed skipped; `BLSH_DISPLAY_OUT` was absent. No packaging ran.
- Existing changed-request-byte, appended-bundle-length, artifact tamper, nonzero-offset view, malformed UTF-8, Unicode/zero and microsecond/offset/DST controls were retained and passed. No test environment switch was used to hide typed-array realm behavior.
- Targeted ESLint for both changed test files: **passed**, exit 0, same empty/dummy/preload environment.
- Scoped `git diff --check`: **passed**. Final five file hashes and exact original/copy byte equality verified.
- Own shared lock released after the checks. No broader typecheck, browser/server, full-suite or build run; full candidate types remain composer responsibility.

Logs: `focused-UTC.log`, `focused-America_New_York.log`, `lint.log`; structured outcomes `CHECKS.json`; one-line patches and before/after pins in this directory. Existing punycode deprecation warning only.

These two test corrections and fixture must replace/add the corresponding inputs in the next local candidate. The accepted legacy-detail/v0.2 preview proposal remains candidate-only: canonical detail and preview were not changed. Yahoo test-only release inclusion remains deferred pending cron-owner acceptance. No registry, Git/index/ref, production or deployment operation performed.
