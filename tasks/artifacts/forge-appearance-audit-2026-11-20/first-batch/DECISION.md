# First FORGE appearance batch for TJ

Approve one transaction on **36 rows of public.rolling_player_game_metrics**, changing **team_id** only. The proposed slot is **Saturday November 21, 2026, 18:10–18:15 UTC (1:10–1:15 p.m. Eastern)**. Claude requested that changes land after 18:00Z if 0359 has armed. The FORGE, hosted replay and release owners have been asked to confirm this five-minute interval against all games. A conflict, missing clearance or missed slot defers the transaction. No production write has taken place.

**Exact manifest SHA-256** `800c9ef136ca9d17b6d427b659774fd7654ea91168912c79184521cdf2aa01fc`. Every CSV row contains its full key, audited xmin, old and proposed identity, violated rule, event side and original participation source. This proposal supersedes the earlier bulk approval request. [Manifest](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-first-batch/manifest.csv) · [Sealed source decision](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-decision/DECISION.md)

## Exact keys and evidence

Each line represents three primary keys with strength_state **all, ev and pp**. “Latest” and roster membership refer to the frozen November 20 cutoff. Deeper rows can be read by the legacy scan. Neither rolling transport projects team_id. The correction records the team that actually iced the player. Roster membership alone was never used as team evidence.

| Player ID | Game date | Game ID | Old → new team ID | Lookup / roster |
|---:|---|---:|---|---|
| 8470600 | 2024-01-25 | 2023020751 | NULL → 25 | deeper / outside current roster |
| 8471218 | 2023-12-19 | 2023020489 | NULL → 3 | deeper / outside current roster |
| 8474145 | 2024-10-22 | 2024020104 | 68 → 59 | deeper / outside current roster |
| 8474145 | 2025-04-15 | 2024021297 | 68 → 59 | latest / outside current roster |
| 8479981 | 2024-04-16 | 2023021297 | NULL → 13 | deeper / current |
| 8480880 | 2024-04-16 | 2023021295 | NULL → 6 | deeper / outside current roster |
| 8481059 | 2024-02-27 | 2023020934 | NULL → 19 | deeper / current |
| 8481521 | 2024-04-06 | 2023021222 | NULL → 4 | latest / current |
| 8481537 | 2023-12-15 | 2023020459 | NULL → 28 | deeper / outside current roster |
| 8481564 | 2023-12-31 | 2023020566 | NULL → 7 | deeper / current |
| 8483045 | 2024-03-30 | 2023021171 | NULL → 29 | latest / current |
| 8484326 | 2024-03-07 | 2023021001 | NULL → 53 | latest / outside current roster |

The 8,700 conditional-window rows comprise 8,649 missing team IDs and 51 wrong, populated IDs. This pilot includes 30 missing and six wrong, six home and six away appearances, all four lookup/membership combinations, both seasons, and all four original row versions. The two Utah dates deliberately cover the rarer populated-ID correction. All 17 such appearances belong to one player. Selection used fixed quotas, preferring distinct players and then distinct teams with a deterministic hash tiebreaker. The remaining 8,664 rows comprise 8,619 missing and 45 wrong.

The parent manifest is pinned to `f71f2e195731677664ddaa5419c710bfd43d74b1523832ef74cd81e6ae95e275`. Source proof for these events includes the sealed NHL player boxes and dated WGO participation. A fresh read-only production snapshot at 18:09:51Z on Nov 20 matched all 36 versions, game/season IDs, dated sides, positive participation, team/opponent abbreviations and absence of a support sidecar. It sealed each target's SHA-256 over the other 622 columns. A second read-only verification matched. A planner-only production EXPLAIN at 18:13:37Z showed 36 complete primary-key probes through a nested loop. Production load for the write remains unmeasured. [Row witnesses](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-first-batch/preapproval.json) · [Bounded production readback](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-first-batch/production/readback-pre-readback-1795198377693000000.json) · [Production plan without execution](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-first-batch/production-plan-only.json)

## Disposable proof

PostgreSQL 15 used all 623 production columns, all six production index definitions, 36 complete target rows and six outside-batch controls, including three with valid, independently matched team identities. Both local reader paths used the previously pinned deployed implementation and original RPC. On the small fixture all 36 player/strength probes per path returned a verified event, with identical baseline, applied and restored output files. The initial local fallback trial exposed a missing updated_at column in the disposable sidecar schema. The corrected fixture produced the successful baseline in reader-baseline.json. The prior full-reader receipt remains available for whole-history context. [Pilot rehearsal](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-first-batch/rehearsal.json) · [Original full-reader receipt](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-decision/reader-proof.json)

| Local measure | Apply | Rollback |
|---|---:|---:|
| Committed rows / retry writes | 36 / 0 | 36 / 0 |
| Statement WAL bytes / records / full-page images | 234,289 / 285 / 23 | 112,569 / 284 / 0 |
| Shared blocks hit / read / dirtied / written | 483 / 0 / 37 / 13 | 505 / 0 / 13 / 13 |
| Database execution time | 0.790 ms | 0.843 ms |
| Transaction wall time through commit | 29.210 ms | 32.413 ms |

All six control rows retained their contents and xmin. Rollback restored all 623 columns of all 42 rows. An unrelated one-field change on one target refused the entire apply. A second clone demonstrated that a later edit also refused rollback with all 36 corrected teams intact. A lock held on one target yielded SQLSTATE 55P03 and no partial rollback. The compact local fixture has a different page layout, cache and network latency from production. [Apply counters](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-first-batch/local/apply-committed.json) · [Rollback counters](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-first-batch/local/rollback-committed.json) · [Post-apply drift refusal](/Users/tim/Documents/Codex/2026-11-20/forge-appearance-first-batch/fixture/rollback-drift/result.json)

## Operation and readback

The operator verifies the manifest and sealed witness hashes. Run only after TJ approves this hash and Claude's owners confirm the slot is clear. Recheck the mailbox immediately beforehand. Any new arm, pending conflicting release or replay supersedes earlier clearance. Use the same fixed receipt directory on this Mac for apply, readback, a retry and any rollback. The first command verifies the executable and shared helpers from the canonical checkout.

```sh
cd /Users/tim/Code/fhfhockey.com
shasum -a 256 -c tasks/artifacts/forge-appearance-audit-2026-11-20/first-batch/OPERATOR.sha256
pilot=tasks/artifacts/forge-appearance-audit-2026-11-20/first-batch/pilot.py
batch_hash=800c9ef136ca9d17b6d427b659774fd7654ea91168912c79184521cdf2aa01fc
python3 "$pilot" readback --production
# Only with exact approval and a confirmed open slot
python3 "$pilot" apply --production --approved-sha256 "$batch_hash"
# Fresh bounded repeat of the same key, source, version and non-team-column checks
python3 "$pilot" readback --production
```

The serializable transaction revalidates WGO, game, season, player, both dated teams, lack of a sidecar and user triggers. Its sole UPDATE requires the complete primary key, the original xmin and exact prior game/season/team values for every target. A precommit check requires exactly 36 new versions, the intended teams and all other column hashes unchanged. The operator aborts on an unexpected access path, 300 ms lock timeout, 3 s statement timeout, more than 4 MiB of statement WAL, update execution exceeding 500 ms or more than 5 s before commit. An expired apply slot also aborts before commit. A failed attempt may generate WAL while PostgreSQL rolls back. Investigate before retrying.

A durable local intent records the full transaction ID before commit. A fresh read-only connection verifies that transaction's status and xmin on every row, source joins and all 622 non-team columns. The committed receipt includes statement WAL, buffer counts, server and client times and commit latency. Another call provides an independent post-commit re-audit of these 36 keys. Repeating the same successful action validates the receipt and writes zero. A lost or ambiguous receipt is an investigation stop. Post-commit production evidence will be saved under `forge-appearance-first-batch/production/` and reported to TJ and Scout. [Guarded operator](/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-appearance-audit-2026-11-20/first-batch/pilot.py)

If reversal is required, coordinate a clear slot and obtain TJ's rollback direction. With the same variables and receipt directory, use:

```sh
python3 "$pilot" rollback --production --approved-sha256 "$batch_hash"
python3 "$pilot" readback --production
```

Rollback requires the committed apply transaction ID, each written xmin and all expected values. It restores the 30 prior NULLs and six prior 68s atomically. PostgreSQL assigns new row versions to the restored contents. A later change to any target refuses the entire rollback.

## Sizing the next batch

Use **production** apply counters after exact post-commit readback. The operator measures WAL and buffers on the same UPDATE that makes the repair. Statement WAL excludes commit, vacuum and other sessions. Transaction wall time includes the validation, update and commit round trips. Full-page images and write latency can vary between checkpoints.

For a clean pilot, compute the next candidate size as the smallest of 72 rows, `36 × 1,048,576 / WAL bytes`, `36 × 128 / shared blocks dirtied`, `36 × 100 / database execution ms`, and `36 × 1,000 / transaction wall ms`. Use a denominator of at least one and round down to complete triples. The 72-row cap limits the first increase to twofold. A lock timeout, unresolved contention, incomplete readback, rollback, budget refusal or a result below three rows stops expansion. Apply the same limits to each later measured batch with its own size as the baseline. Bring the next manifest, hash and quiet slot for separate approval. The 8,664 remaining rows are outside this authorization.
