# PC ticket 4: evidence status line on the studio page

PC lane, 2026-10-25, ~20:52Z, HEAD `80fa80b5c` (after WIRING-1's release `e8b0c95c3`). **Not committed.** No Git changes, no GIT_DIR, no production, no server, no live reads.

**Product choice:** TJ picked this by pop-up: "Small status line (Recommended)". The alternatives were per-metric badges, or not rendering yet.

## Files

| Path | Status | sha256 | bytes |
| --- | --- | --- | --- |
| `web/lib/player-cards/evidenceVerdictCopy.ts` | new | `d2bbb80c34e550b44bfdae998e44db96ce10f24ff58280d6a8a81db2edb31fc1` | 890 |
| `web/pages/social-share/player-cards.tsx` | modified (from `c47bb0c0…`) | `13f5edefb1354131c51de60fbc97f210a74100879f0c6f6ced014f083eddd1dd` | 1759 |
| `web/lib/player-cards/cardEvidenceVerdict.test.ts` | modified (from `d1e15b20…`) | `9d3044cd1430b29426ca173627014137ff4df9a11b9b55000bdb383c4cf2f102` | 9323 |

`cardEvidenceVerdict.ts` is unchanged at `81e7be20…`. No studio component, card or scss file changed.

## What it does

- **Status line.** Inside `SocialShareAccessGate`, below the studio, the page renders `<p role="status" data-evidence-state=…>`:

  > **Evidence check: incomplete**
  > Fabricated preview, no admitted evidence. Ranks are illustrative.

- **Fixed copy.** `evidenceVerdictCopy.ts` maps the verdict **state only** to fixed copy, with entries for eligible, incomplete and rejected. An unknown state falls back to rejected. Issue codes and reasons are never displayed.
- **Client-safe.** The copy module imports nothing from the evidence modules; it declares its own state union. So the client bundle gains no evidence code, and the boundary guard still holds.
- **Still a single gate.** `validateAdmittedEvidence`, via `cardEvidenceVerdict` in `getServerSideProps`, is still the only path. The props are unchanged: codes and states only.

## Checks (canonical tree, cwd `web/`, GIT_DIR unset; 20:50:37–20:51:40Z under `/private/tmp/fhfh-heavy.lock`, acquired by atomic `mkdir` with a wait and no steal, released after)

| Check | Result | Log sha256 (`checks4/`) |
| --- | --- | --- |
| `npx vitest run lib/player-cards/` | **PASSED**: 9 files, 102 tests (the previous 100, plus 2 status-line tests) | `tests.log` `6038ad62…` |
| Scoped `tsc -p checks4/tsconfig.json` (the copy module, the verdict and its test, the page) | **PASSED** (exit 0) | `types.log` `e3b0c442…` (empty) |
| **Whole-project** `NODE_OPTIONS=--max-old-space-size=8192 npx --no-install tsc --noEmit` | **PASSED** (exit 0) | `types-whole.log` `e3b0c442…` (empty) |
| `npx eslint` on the 4 files above plus `evidenceLoader.ts` and `evidenceBundle.ts` (including the C1 rules) | **PASSED** (exit 0) | `lint.log` `e3b0c442…` (empty) |

**New tests** in `cardEvidenceVerdict.test.ts`:
- **Page render:** the real `getServerSideProps` props are passed to the page, rendered with `renderToStaticMarkup`, with the gate and studio mocked. The markup contains the fixed incomplete copy and `data-evidence-state="incomplete"`, and none of the issue codes.
- **Copy table:** every state has copy, and an unknown state falls back to rejected.

Exit codes and timings are in `checks4/run.txt` (`2ab6e5fc…`).

**Not run:** build, browser and E2E. C7's L3 client-bundle check still needs build authority, and nobody has visually checked the line's styling. It is a plain unstyled `<p>` under the studio.
