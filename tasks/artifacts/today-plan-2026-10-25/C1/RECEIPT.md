# C1 — qualified card evidence-bundle validator (SITE-PLAYER-CARDS, P1) — frozen handoff

Claude session, 2026-10-25. First-pass candidate for Codex integration review and Scout. **Not installed in the canonical checkout.** The two canonical paths are still absent and wait for Codex's grant (request CLAUDE-20261025-060; no grant seen through CODEX-20261025-078). There were no DB or provider reads, no Git, and no changes to formulas, eligibility, ranking, UI or existing card files.

## What it is

`web/lib/player-cards/evidenceBundle.ts` exports `validateEvidenceBundle(input, bundle, retained)`. It returns `eligible | incomplete | rejected`, exact `EvidenceIssue`s (`severity`, `code`, `reason`, plus subject `playerId`/`gameId`/`metricId`/`receiptId`), and a per-metric `eligible | incomplete | rejected` with reasons. It also returns the card, built by the unchanged adapter (`null` when rejected). Live and premium activation are always `false`.

- **Binding.** The bundle declares selection (player, season, game type, strength, window, cutoff) plus receipt references for:
  - per-player appearance history;
  - per-game finality;
  - per-metric definition version;
  - per-metric population membership.

  Each reference must resolve to exactly one entry in `retained`, the index from the retained-artifact loader. The entry must match on sha256 and kind, have a retained path and the same origin, and have a subject matching the selection.
- **Caller claims are never proof.** The validator rebuilds every adapter proof flag from verified receipts, discarding the caller's values:
  - `completeHistory`, `historyThrough`, `historyReference`;
  - per-game `completion`;
  - `source.verifiedMetrics` / `definitionReference`;
  - `population.complete` / `expectedPlayerIds`.

  A reference or hash with no retained entry is `incomplete` (`receipt-not-retained`). A hash mismatch is `rejected`.
- **Five rows are not history.** A history `sourceClass` of `row-count` or `latest-n` is `incomplete` (`history-not-complete`). Only `complete-official-log`, with `through ≥ cutoff`, a UTC date basis and an exact game-ID match against the frame, counts.
- **Ingestion completion is not finality.** Only `official-game-end` counts. `ingestion-completion` gives the reason "Ingestion completion is not an actual game-end time". Every played appearance on or before the cutoff date needs one. A real end after the cutoff correctly drops the game, which can leave a known-short sample.
- **Date basis.** A `provider-game-date` basis is `incomplete` (`date-basis`). This mirrors the completion-read finding: games 2026020151 and 2026020167 have game dates one day before their scheduled UTC start dates.
- **Zero semantics.** A definition receipt needs `zeroSemantics: "verified-distinct"`. Otherwise the metric is unverified and the adapter marks it missing. With verified semantics:
  - a measured 0 stays valid and ranked;
  - a zero-denominator result stays `undefined`, neither 0 nor missing;
  - a null component stays `missing`.
- **Metric-specific populations.** Metrics are grouped by their verified member set, and `adaptLocalSnapshot` runs once per group on exactly those members. Each metric is ranked against its own pool.
  - Members with no supplied inputs make the result `incomplete` (`population-incomplete`, listing the IDs).
  - A pool that excludes the selected player is rejected, as is one built for another season, strength, window, cutoff, scope or definition version.
  - Roster or position-filter pools are `incomplete`.
- **Reuse.** No rate, window, aggregation or rank logic is duplicated: all values and ranks come from the existing `adaptLocalSnapshot`, `selectWindow`, `aggregateWindow` and `rankMetric`.

### Trusted-receipt input boundary (proposed; needs Codex agreement)

`retained: RetainedReceipt[]` must be built by the retained-artifact loader from kept receipt files, with hashes it computed itself, never by the card caller. The validator does no file or network I/O, so it cannot tell a forged index from a real one; that guarantee belongs to the loader. Mapping the existing receipts onto this boundary:

| Existing receipt | Maps to | Validator outcome today |
| --- | --- | --- |
| `player-cards-2026-10-25/completion-read-01/RESULT.json` (sha256 6ee7b37d…) `ingestion_completed_at` | `game-finality` with `sourceClass: "ingestion-completion"` | `incomplete`: not an actual game end |
| same, `date` vs `scheduled_start` | history `dateBasis: "provider-game-date"` | `incomplete`: `date-basis` |
| `observed-adapter-01/READINESS.md` (sha256 17bb9916…) and capture-reconciliation | none of history, definition or population (it explicitly keeps `completeHistory:false`, no verified metrics, unknown population) | `incomplete`: every kind missing |

## Files and pins

| Item | sha256 | bytes |
| --- | --- | --- |
| `source-files/evidenceBundle.ts` → `web/lib/player-cards/evidenceBundle.ts` (new) | 2899407e81b88dec5c78548cd9c9eff524c7592a3c67f5d6253c2181a3424084 | 20098 |
| `source-files/evidenceBundle.test.ts` → `web/lib/player-cards/evidenceBundle.test.ts` (new) | d4c674cb41deadcb05941d3c2bbb0312495894393cce6faa675c4895711d23b3 | 21319 |
| `source.patch` (two new-file hunks, `patch -p1`; reproduced byte-identically in an empty tree) | d859293bbb4a54e1b4a45d5ee8dbb4d2452e476bdaede538b7c0a78206bc839a | |
| `SNAPSHOT-MANIFEST.sha256` (4488 files, `web/` copied 14:13Z without node_modules/.next*/.env*) | b5aea737491115acc2363c75111e65a1701534b826cf0b450012f0827266a00a | |

Base: canonical checkout `octoberBranch` HEAD `9d4996033c978fb1570c85e3ca226627872fdf30`, dirty working tree. The read-only dependencies match the canonical working tree byte-for-byte as of 14:21Z:

| File (read-only) | sha256 |
| --- | --- |
| adapter.ts | 095368ab27e9a207a62b0309f0ff45f7a401e2735c609ed6481199846883c81f |
| windows.ts | b7e989c211b8a9f5a1a91af157c69fc28cd29a409442f89365e57c662d10adb2 |
| aggregation.ts | 4ffe0ed5cbdea97ecb15b153543aace6b2d349cac10b0ff3e6de7484768b410a |
| ranking.ts | 813a18860ac97ce19bceeb01f014541644b9a4d002c34ac7a0d95c09ef6b5338 |
| registry.ts | f9c6a55ef5ee37a4e9de4cb1321ee971af5da0e3008dfdd86dfcec260c25cd29 |
| contracts.ts | 5bc0b00708a6dd9f3638f801701d3bf56dfe9a0dfcdd1484fd34d806ff8c283d |
| nstCapture.ts | 8febc82875c998d9b89c9e8d70194ddf25f204b6fcca8ef08b32d338c16bebb5 |
| domain.test.ts | da0e7e3bcc4b923acc7e4229e63236efe4e7210877092f063e4bb3c96bac46b1 |
| nstCapture.test.ts | 7c88e4a14687c325858eb4ca7b4c297368179dfedfc6d1a1837539a5829914ed |

Install precondition: re-check these pins and that both target paths are still absent, then apply `source.patch`. Nothing else changes.

## Results (snapshot `/private/tmp/fhfh-c1-isolated/web`)

- **Focused tests: PASSED.** `npx vitest run lib/player-cards/` gave 7 files and 76 tests, all passing: 26 new, 50 existing unchanged (domain 19, nstCapture 10, aggregation r1 7, ranking 5, portrait 5, shareExport 4). Log: `tests.log`.
- **Mutation check.** Accepting `ingestion-completion` as finality fails the five-row/ingestion test. The file was restored and verified with `cmp`.
- **Scoped lint: PASSED** (exit 0, no output). Log: `lint.log`.
- **TypeScript: no errors in the C1 files; the whole app FAILED on 2 inherited errors.**
  - The first `npx tsc --noEmit` aborted with a V8 heap out-of-memory (exit 134, default heap). That is not a type result.
  - The retry used the repo's `npm run typecheck` (8 GB heap) under `/private/tmp/fhfh-heavy.lock`, 14:21–14:22Z. It exited 2 with exactly two errors, both outside C1 in untracked Luna files from another lane: `lib/sources/tweetLunaReview.test.ts:192` and `scripts/review-ifttt-luna.ts:22`. Both are the same `Buffer` → `BinaryLike` TS2345. There are zero errors in `evidenceBundle*`.
  - Log: `types.log` (sha256 ecbe6f3d…). Logs: `tests.log` f7a968fa…, `lint.log` 5e039407….

All test data is labelled SYNTHETIC: fabricated players 1001–1003, games, values and receipts. Coverage:

- **Positive:** an explicitly qualified bundle is eligible, and its readings equal a direct adapter run on the same receipt-derived proof.
- **Negatives:**
  - caller `complete:true` with no receipts;
  - an unretained reference;
  - a hash mismatch;
  - five-row history plus ingestion-completion finality;
  - mixed origin;
  - mismatched season, strength, cutoff, window or player;
  - receipt subject player, game or season mismatch;
  - population strength, cutoff or definition-version mismatch;
  - definition source mismatch;
  - actual end after the cutoff;
  - missing history;
  - history short of the cutoff;
  - receipt game absent from the frame;
  - extra frame game;
  - provider date basis;
  - duplicate dates in the receipt and in the frame;
  - incomplete population (only that metric unranked);
  - per-metric pool sizes;
  - selected player excluded from a pool;
  - position-filtered pool;
  - valid zero, undefined and missing values;
  - unverified zero semantics;
  - no mutation of frozen inputs, with direct adapter output unchanged.

## Real evidence still missing (C1 cannot create it)

1. **Actual game-end timestamps** (`official-game-end`) for every played appearance up to the cutoff. Today only ingestion completion (`statsUpdateStatus.completed_at`) and scheduled start exist.
2. **Date convention:** whether `games.date` is a UTC calendar date. Two of the five games contradict that. This needs an explicit UTC date or a declared conversion.
3. **Complete per-player appearance history** (`complete-official-log`, `through ≥ cutoff`) for the selected player and every pool member, including traded and non-roster players. The five-game read does not establish it.
4. **Metric-definition receipts** per metric, tying registry `proposed-nst-v0` to the NST source definition and version. They must cover provider field/model semantics (xG model and event universe) and verified null-vs-zero semantics. Ingestion currently coerces dash placeholders to 0.
5. **Metric-specific all-NHL population inventories** (`metric-population-inventory`), giving member IDs per metric, season, strength, window, cutoff and definition version. The `pos=S` ingestion filter is not sufficient.
6. **Codex agreement** on the trusted-receipt boundary (who builds `retained`, and the receipt schemas above). A consumer hook, if wanted, is a separate Codex integration patch.

No repeat of the five-row query is proposed. Acquiring any of items 1–5 needs its own bounded, authorized plan.
