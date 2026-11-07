# PC ticket 5: C7 R28 P1 and P2

PC lane, 2026-10-25, ~21:07Z, HEAD `f633654d5`. **Not committed.** No Git changes, no GIT_DIR, no production, no server, no live reads. Only the 4 granted files changed.

## Files

| Path | sha256 before | sha256 after | bytes |
| --- | --- | --- | --- |
| `web/lib/player-cards/cardEvidenceVerdict.ts` | `81e7be20…` | `fd5a2ccd681428c666505303b594405663a3f16f4d12688aa371d40675f36480` | 2806 |
| `web/lib/player-cards/cardEvidenceVerdict.test.ts` | `9d3044cd…` | `dcc4551c540ff810aa789bd821bbe57708d38c5465302ed5e3d4b9cb14d15e61` | 10120 |
| `web/lib/player-cards/evidenceVerdictCopy.ts` | `d2bbb80c…` | `e2ea463484098fdaed40373804dd2989f7dfd215228cf73885c68daaa1f7a23e` | 1865 |
| `web/pages/social-share/player-cards.tsx` | `13f5edef…` | `f17fd0a83eb1f5b328884f3d2c3a19ebd599912104db9a912092a8eea3df7b31` | 1800 |

## Changes

**P1: only `{ state }` reaches the client.**
- `cardEvidenceVerdict.ts` adds `ClientEvidence = Pick<EvidenceVerdict, "state">` and `clientEvidence(verdict) → { state }`.
- The page's `getServerSideProps` returns `{ evidence: clientEvidence(await cardEvidenceVerdict(…)) }`, so `issueCodes`, per-metric states and flags stay server-side and never reach `__NEXT_DATA__`.
- The full `EvidenceVerdict` is unchanged for server use.

**P1 test:** "ships exactly { evidence: { state } }…" checks the JSON round-trip of the real `getServerSideProps` result with `toStrictEqual({ props: { evidence: { state: "incomplete" } } })`. The status-line test now takes the codes from a server-side verdict and still asserts that none appear in the markup.

**P2: copy is passed its context.**
- `evidenceStatusCopy(verdict, context)` now requires `context: "fabricated-preview" | "evidence-bundle"`.
- **Titles** are neutral, keyed by state.
- **Details** are keyed by context and state:
  - The preview keeps today's wording: "Fabricated preview, no admitted evidence. Ranks are illustrative."
  - A real bundle reads, for example, "Not all evidence is admitted. Ranks without admitted evidence are withheld."
- **Fallbacks:** an unknown state reads as rejected, and an unknown context gets the neutral bundle wording, never the preview wording.
- The page passes `"fabricated-preview"` explicitly.

**P2 tests:**
- "has copy for every verdict state and context…" covers every state in both contexts and the rejected fallback.
- "never calls a real evidence bundle a fabricated preview" asserts that the bundle context and an unknown context never mention fabricated or illustrative, for any state including unknown.

The rendered page output is unchanged: the status line still reads "Evidence check: incomplete / Fabricated preview, no admitted evidence. Ranks are illustrative."

## Checks (canonical tree, cwd `web/`, GIT_DIR unset; 21:06:10–21:07:10Z under `/private/tmp/fhfh-heavy.lock`, acquired by atomic `mkdir` with a wait and no steal, released after)

| Check | Result | Log sha256 (`checks5/`) |
| --- | --- | --- |
| `npx vitest run lib/player-cards/` | **PASSED**: 9 files, 103 tests (the previous 102; one props test replaced, one copy test added) | `tests.log` `a5275825…` |
| Scoped `tsc -p checks5/tsconfig.json` (the 4 files) | **PASSED** (exit 0) | `types.log` `e3b0c442…` (empty) |
| **Whole-project** `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit` | **PASSED** (exit 0) | `types-whole.log` `e3b0c442…` (empty) |
| `npx eslint` on the 4 files plus `evidenceLoader.ts` and `evidenceBundle.ts` (including the C1 rules) | **PASSED** (exit 0) | `lint.log` `e3b0c442…` (empty) |
| Mutation check (restored, then `cmp`-verified) | Making `clientEvidence` ship the whole verdict fails the exact-props test. | console only |

Exit codes and timings are in `checks5/run.txt` (`75d9bcc5…`).

**Not run:** build, browser and E2E. C7's L3 client-bundle check still needs build authority, and the line is still unstyled and not checked in a browser (P3).
