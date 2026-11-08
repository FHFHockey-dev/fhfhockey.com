# C7 ticket 23 — pre-apply review of PC WIRING-1 (first player-card evidence wiring)

**Verdict: accept with limits.**
- **What holds:**
  - the wiring goes through `validateAdmittedEvidence` only;
  - no receipts, card, values or ranks reach the page props;
  - it fails closed when files are absent, tampered or untraced;
  - the fixture's self-asserted proof is ignored;
  - it lints clean under the `d5413c688` rule;
  - it applies cleanly to HEAD `86583ba6b`.
- **Fix before applying (L1):** the verdict is shipped to **every** visitor in the page's props, and its reason strings can carry internal receipt ids today and population member ids later. Keep the reasons off the props (codes and states only), or don't return the unrendered prop yet.
- **The other limits** are test-gap or check items (L2–L5).

**Reviewer:** Claude C7 lane session (not the author). Read-only on canonical: no `web/` edits, no Git mutations, no `GIT_DIR`, no live reads. All work happened in the snapshot `/private/tmp/c7-r23/web`, made with `git archive 86583ba6b web` (a read-only export). Tests ran under the outbound network-deny preload. Evidence is in `r23-evidence/`.

## Dry-run and pins

- **Patch:** `WIRING-1.patch` = `bc96b5c4…`, matching WIRING-1.md.
- **Canonical page** `web/pages/social-share/player-cards.tsx` = `fac7acb9…`, the pinned baseline, at HEAD `86583ba6b`.
- **Snapshot of `86583ba6b`:** `patch -p1 --dry-run` is clean for all 4 files (`dryrun.log`), and the real apply is clean with no `.orig` or `.rej` files. The post-apply hashes equal WIRING-1.md:

  | File | Hash |
  | --- | --- |
  | `cardEvidenceVerdict.ts` | `291e786e…` |
  | page | `c47bb0c0…` |
  | `cardEvidenceVerdict.test.ts` | `b841fb02…` |
  | page test | `ee9fbff2…` |

## Tests (snapshot)

**101/101** (`r23.json`):
- **PC's 98:** the existing `lib/player-cards` 94, plus 3 guard and verdict tests and 1 page test.
- **My 3:** `c7/r23Leak.test.ts` (K1, K2) and `c7/r23Absent.test.ts` (K3).

**ESLint** on the 4 patched files: exit 0. `cardEvidenceVerdict.ts` imports only **types** from `evidenceBundle`, which the `d5413c688` rule allows, and imports the loader, which the rule doesn't restrict.

## Requirements

| Requirement | Evidence | Result |
| --- | --- | --- |
| **Only `validateAdmittedEvidence`** | `cardEvidenceVerdict.ts:24-25` always calls `loadAdmittedEvidence({ root: RETAINED_EVIDENCE_ROOT, origin })` and then `validateAdmittedEvidence`. The signature takes no root, receipts or evidence. The raw validator isn't imported. | Holds |
| **No receipts, values or ranks reach the client** | The verdict keys are exactly `state, bundleId, metrics{state,reasons}, issueCodes, liveActivation, premiumActivation` (`:26-31`; owner test plus K2). **K2**, an observed-origin bundle against the real fixture root, has no `rank`, `ordinal` or `percentile` in the JSON. **But see L1:** the props *are* shipped to the client, and `reasons` is free text. | Holds for values and ranks; **L1** |
| **Fails closed: absent, untraced or tampered** | **K3:** `process.cwd()` is pointed at a missing directory **before** module load (the root is resolved at import, `:16`). An observed bundle referencing the pinned five-row receipt stays `incomplete`, with `retained-file-missing`. Tampered bytes are covered by the loader's own tests (my R19 K4). **In practice** the studio fixture's origin is `synthetic`, and the ledger has **no synthetic admissions**, so each request reads **no files at all**. Serverless tracing therefore can't change today's result. | Holds |
| **Self-asserted fixture proof ignored** | The fixture sets `population.complete: true` (not for the "unknown-pool" scenario), `verifiedMetrics: all` and `fabricated-…` references (`interactionFixtures.ts:40`). The owner test shows the verdict is `incomplete`, with history, finality, definition and population all `*-missing`, and every metric incomplete. | Holds |
| **Interaction with the `d5413c688` rule and my R22 L2** | I planted `components/c7probe/Probe.tsx` **in the snapshot only** and ran the boundary guard test and ESLint (`guard-probes.txt`). Results below. | **L2** |

**Planted-probe results:**

| Probe | Guard test | Lint rule |
| --- | --- | --- |
| Static `import … from "lib/player-cards/evidenceLoader"` | **caught** | not restricted |
| `import("…/evidenceLoader")` | **missed** | not restricted |
| `require("…/evidenceLoader")` | **missed** | not restricted |
| `import("…/evidenceBundle").then(m => m.validateEvidenceBundle)` | **caught**, because the guard scans the identifier's text | not restricted |
| Computed-name access (`m["validate"+"EvidenceBundle"]`) | **missed** (contrived) | — |
| `cardEvidenceVerdict` imported from `components/` | **caught** | — |
| Clean file | passes | — |

The guard test therefore closes most of my R22 L2 for the raw validator, but not dynamic or `require` imports of the loader.

## Findings (to PC)

| # | Severity | Finding |
| --- | --- | --- |
| **L1** | **Medium-low, fix before applying** | **The props reach every visitor, and the reasons are free text.** `getServerSideProps` (`pages/social-share/player-cards.tsx:15-18`) has no auth check; `SocialShareAccessGate` gates only the client render. So the `evidence` prop is serialized into the page's `__NEXT_DATA__` for **any** request, signed in or not, even though it isn't rendered. `metrics[*].reasons` are the validator's issue texts. **K1:** a bundle reference's receipt id (`"c7-internal/receipt-path.json#x"`) appears verbatim. Once real bundles are wired, reasons will also carry retained paths and population member ids (`evidenceBundle.ts:172`, "population member(s) lack supplied card inputs: …"). Today's server-built unclaimed bundle has no such text, so nothing sensitive leaks *yet*. **Fix:** ship only `state`, per-metric `state` and `issueCodes`, and map reasons to fixed copy on render. Or don't return `evidence` until the reviewed UI change that renders it, behind a server-side role check. |
| **L2** | Low | **The guard regex misses dynamic `import()` and `require()` of `evidenceLoader`/`cardEvidenceVerdict`** (`cardEvidenceVerdict.test.ts:25-27` match only `from "…"`). A client component could `import("lib/player-cards/evidenceLoader")`. The build would probably fail on `node:fs` in the client, but don't rely on that. Extend the patterns to `(from\s+|import\(\s*|require\(\s*)["'][^"']*evidenceLoader["']`, and similarly for the others. The lint rule doesn't cover loader or verdict imports at all; that's intended, but the test should then be the full gate. |
| **L3** | Check before deploy | **Client bundle not verified.** Item 6 of WIRING-1 relies on Next removing `getServerSideProps` and its exclusive imports (`cardEvidenceVerdict` → `node:path`, `node:fs/promises`, `node:crypto`). That is the normal behaviour, and the combined `import { …, type EvidenceVerdict }` should be dropped entirely. No build was run (none authorised). The first local `next build` should confirm that no `node:fs` or `evidenceLoader` chunk is in the page's client JS. |
| **L4** | Process | `web/__tests__/pages/social-share/player-cards.test.ts` is **outside the PC lease**, as WIRING-1 notes. Extend the lease to that path or drop the file; the `lib/` guard test still covers the boundary. |
| **L5** | Info | **Root and cost.** The root is `path.join(process.cwd(), "lib", "player-cards", "__fixtures__", "retained")`, resolved once at module load (`:16`), so it is test-fixture-backed in production. That is fine because nothing synthetic is admitted. The deployed retained root is still undecided. Per-request cost is one fixture build plus one validator pass with zero file reads, on a page that was already server-rendered and `no-store`. Negligible. |
