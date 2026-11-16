# Stage C receipt — local reader at 89da739cb-equivalent source against production DB (2026-11-15 01:16–01:19 UTC)
Isolated `next dev -p 3110` (PLAYWRIGHT_ISOLATED_NEXT=1), sequential curl with a 30 s cap. Raw responses: `stage-c/resp-*.json`; log: `stage-c/timings.log`. Local times include dev-mode route compiles and are not production latency.

Attempts: 12 (budget 12).
- 1 sandbox DNS failure: no DB contact (`stage-c/timings-sandbox-dns-fail.log`).
- 4 validation 400s with no DB contact. These were my URL errors: page_size >50; window `last_10`; `entity=goalies` / `entity=teams` sent to the skater-only matrix route.
- 7 reached the DB.

**Stop-rule breach (Chef error):** c06 hit the 30 s cap, but c07 and c08 were already queued in the same batch and ran afterwards (14.9 s and 10.5 s). No further requests followed. Goalie and team views were not exercised (400 only).

| id | view | HTTP | local s | bytes | source / snapshot | total / peer | notes |
|---|---|---|---|---|---|---|---|
| c01 | skaters season 5v5 all, current | 200 | 4.10 | 852,440 | entity_metric_rankings / 11-11 | 740 / 740 | composites v3 on all 50; P/60 #1 has 1 GP, 468 s, "medium", minimumSampleMet |
| c03 | same + team=EDM | 200 | 21.05 | 436,945 | **fallback rolling / 11-13** ("No entity_metric_rankings snapshot rows matched") | 23 / 23 (peerGroup team 22) | ranks recomputed inside team pool; **all composites null** |
| c04b | skaters last10 all-strength, current | 200 | 15.31 | 773,265 | fallback rolling / 11-13 | 736 / 712 | composites null (none published for this window) |
| c05 | skaters season 5v5, 20252026 | 200 | 4.03 | 850,503 | entity_metric_rankings / 04-16 | 776 / 776 | composites present |
| c06 | snapshot player 8473533 (one of 24 unpublished) | timeout | 30.00 | 0 | — | — | server logged 200 at 30,005 ms; body not received |
| c07 | snapshot McDavid + team=EDM | 200 | 14.88 | 17,241 | fallback rolling / 11-13 | peer team 22 | team token accepted (R04 parser fixed); rank 1 of team pool |
| c08 | comparison McDavid + 8479591 + team=EDM | 200 | 10.55 | 20,664 | fallback rolling / 11-13 | status partial | off-team subject returned explicit "unavailable for the requested filter context" |
