# C7 independent review — PC trusted retained-evidence loader (uncommitted)

**Verdict: accepted with limits.**
- **Closes my C1-install F1/F2 for every caller that uses `validateAdmittedEvidence`:**
  - the loader hashes the actual retained bytes and parses the subject from those same bytes;
  - it writes authority labels **only** from the reviewed admission ledger;
  - it hands out a runtime-branded handle that copies, clones, proxies and caller-built indexes can't impersonate.
- **Five-row result:** stays "ingestion observed", with 0 ranks.
- **Checks:** whole-project `tsc` passes; the 36 lease pins have 0 drift; there is no wiring.
- **The limits:**
  - the raw validator is still exported;
  - the production retained root is undecided.

**Reviewer:** Claude C7 lane session (not the author). Read-only: no edits, no Git, no live reads, and no server. Tests ran under the outbound network-deny preload. The whole-project `tsc` ran under the heavy lock, which I took and released. Evidence is in `r19-evidence/pc/`.

## Pins

| File | Hash |
| --- | --- |
| `evidenceAdmissions.ts` | `d2af7842…` |
| `evidenceLoader.ts` | `ec89625c…` |
| `evidenceLoader.test.ts` | `82b96d9d…` |
| `__fixtures__/retained/player-cards-2026-10-25/completion-read-01/RESULT.json` | `6ee7b37d…` |

- **Pin match:** these equal `PC/RECEIPT.md`, and the fixture equals the CODEX-080 pin.
- **Untracked, and nothing else:** all four paths are untracked. No tracked `lib/player-cards` file differs from HEAD, and `evidenceBundle.ts` is still `2899407e…`.
- **36 PC lease pins** (`CLAUDE-LEASES.json`, lane PC `write_paths`): I recomputed all 36 from the tree. **0 drift.**

## Trust contract (CODEX-080) against the code

| Requirement | Evidence | Result |
| --- | --- | --- |
| **Hash the actual bytes; parse the subject from the same bytes** | `admit()` reads `root/<admission.path>`, copies it to a plain `Uint8Array`, computes SHA-256 **over those bytes**, and compares it with the pinned `admission.sha256`. Only then does it `JSON.parse` (with a fatal UTF-8 decoder) **those same bytes**. Missing file → `retained-file-missing`; mismatch → `retained-bytes-mismatch`; either admits nothing. | Holds |
| **Schema** | `receipt-v1`: a strict envelope `{kind, receiptId, origin, capturedAt, subject}` and a strict per-kind `FACTS` subject. Unknown keys fail, so a self-declared `sha256` in the envelope is refused (**K4**, `retained-schema`). `completion-read-rows-v1`: a strict 18-column row shape with no repeated requested game, and only fully ingested, matched, regular-season, `outcome: complete` rows become candidates. | Holds |
| **Identity** | Each admitted claim must be parsed **exactly once** from the bytes, with matching `kind` and `origin`. A receipt id admitted twice across the ledger → `admission-duplicate`, and **neither** copy is admitted (**K3**). Paths are relative with no `.`, `..` or empty segment (**K3** traversal → `admission-path`). | Holds |
| **Source authority** | The admission must carry a recorded decision: `CODEX\|CLAUDE-YYYYMMDD-NNN` for observed data, `SYNTHETIC` for synthetic data. **K3:** synthetic + CODEX authority, observed + `SYNTHETIC`, and a malformed `CODEX-2026-1` are all refused (`admission-authority`). The format ceiling holds: `completion-read-rows-v1` can only ever establish `ingestion-completion` finality. | Holds |
| **Self-labels never admitted as proof** | The admitted `subject` is `{...facts parsed from the bytes, ...labels from the admission claim}`. **K4:** a file asserting `official-game-end` under a review of `ingestion-completion` is admitted **at `ingestion-completion`**, with `self-label-unverified`. A file asserting `ingestion-completion` under a review of `official-game-end` is **not admitted** (`self-label-conflict`). A file with no admission is never read (owner test). | Holds |
| **Hash-only evidence never admitted** | Hashes are recomputed from bytes, not read from the file or the bundle. A reference without loader-admitted bytes resolves to the validator's `receipt-not-retained`. A tampered byte → `retained-bytes-mismatch` (**K4**; whitespace-only rewrite, owner test). | Holds |
| **A caller-built index can't reach the validator as `retained`** | `loadAdmittedEvidence` deep-freezes its output and registers it in a module-private `WeakSet`. `validateAdmittedEvidence` checks `issued.has(evidence)`, otherwise `rejected` / `untrusted-evidence` / `card: null` with every metric rejected. **K1:** a `Proxy` of a real handle, `Object.create(handle)`, `structuredClone(handle)` and `{...handle}` are **all rejected**; the genuine handle proceeds (`incomplete`, `appearance-history-missing`). The TypeScript `unique symbol` brand stops casual typing; the runtime `WeakSet` is the real gate. | Holds |
| **Five rows stay "ingestion observed"** | The real ledger has one admission (CODEX-20261025-080, `completion-read-rows-v1`). **K2:** loading the fixture root gives exactly **5** `game-finality` receipts, all `sourceClass: "ingestion-completion"`, with `endedAt` = each row's `ingestion_completed_at` (not `scheduled_start`), and frozen subjects. The owner test shows the validator then reports 5 × `finality-not-actual-end`, with no `verified-final` and **0 ranks**. An admission trying to read the rows as game-ended is refused (`authority-exceeds-format`). | Holds |
| **No wiring; formulas, readers and ranking unchanged** | `grep` for `evidenceLoader`, `evidenceAdmissions` and `validateEvidenceBundle` across `lib`, `components`, `pages`, `app`, `scripts`, `utils` and `hooks` finds only the four player-card files themselves. No tracked file is modified. | Holds |

## Tests and typecheck

- **Vitest: 98/98** (`pc.json`).
  - The owner's **94** across 8 `lib/player-cards` files: the existing 76 (unchanged) plus `evidenceLoader` 18. That reproduces PC's 94.
  - My **4** (`pcLoader.test.ts`: K1–K4).
  - Run 1 is kept (`pc-run1.*`). There, K1 used a settings-less dummy input, so the validator threw before reaching the trust check. That was a reviewer error; I rebuilt K1 with well-formed settings.
- **Whole-project `tsc --noEmit`** (8 GB heap, under the heavy lock, 17:05:12–17:06:10Z): **exit 0, 0 errors** (`tsc-whole.log` empty, `tsc-whole.meta`). This confirms the Buffer→`Uint8Array` fix for the 3 errors TG reported.

## Limits and observations (to PC and the wiring slice)

| # | Item |
| --- | --- |
| **L1** | `validateEvidenceBundle` is still exported, and calling it directly bypasses the loader. That is correct for its 26 tests and C1's accepted bytes, but **the first route, server or UI wiring must import only `validateAdmittedEvidence`**, and a reviewer must check that the raw validator isn't on a request path. This replaces my C1 F2 as the remaining gate. |
| **L2** | The production `root` is undecided. Today the five-row bytes exist only in the recovery checkout and this test fixture. `root` is caller-supplied, but that is safe: every admitted file must hash to its pinned SHA-256, so a different root can't change the content. Only availability depends on it. |
| **O1** | On the untrusted path, `validateAdmittedEvidence` still calls the validator with `[]` to build its per-metric shape. Structurally malformed card input therefore **throws** (a TypeError) instead of returning `untrusted-evidence`. It is never permissive, but returning the rejection before calling the validator would make the trust failure the reported one. |
| **O2** | The committed fixture is real observed data: 5 public NHL game ids with ingestion timestamps, and no account or private data. It is byte-identical to the CODEX-080 pin. Keeping real rows under `__fixtures__` is fine for the pin test; keep it read-only. |
| **O3** | My C1 F3 (the wording "retained" / `receipt-not-retained` in the validator) is still unchanged, as PC notes. It is cosmetic. |
