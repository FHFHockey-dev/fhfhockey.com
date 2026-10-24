# C7 LUNA-LOCAL independent review — diary

- Scope: read-only independent review of six-file LUNA-LOCAL packet + 4 protected pins (CANDIDATE.json). Writes only coordination/handoffs/C7/ + scratchpad. No Git, no paid/prod, no server.
- Where: octoberBranch HEAD 2a5092d37 (dirty, untouched). Receipt: tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/C7/.
- 14:40Z: all 6 new-file + 4 protected pins + application.patch SHA256 match CANDIDATE.json.
- Next: read source, imported closure, run owner suite under network guard from scratch copy of config, add adversarial controls in scratch.
- 14:42Z: closure 37/38 match; web/lib/newsFeed.ts drifted (test-only import) to release-readiness-2026-10-24 pin de831779…. Owner 41/41 reproduced on current bytes under network guard (scratch config, Vite cache in scratch).
- 14:44Z: 40 C7 adversarial controls. Run1 had 1 reviewer-error failure (C18 exact float ceil); run2 C24 mis-targeted (text lacked subject); final 40/40. Originals kept in evidence/.
- 14:46Z: 7 real-CLI runs. K1 byte-identical to owner disabled result. K2 (kill switch) / K3 (no ledger) with --dispatch → exit 0 review_only attempts 1 → F1/F2.
- 14:47Z: scoped tsc/eslint exit 0; pins 10/10 unchanged after runs.
- State: DONE. Verdict accepted (default-off scope), dispatch blocked on F1 (Decisions-leg holds masked) + F2 (attempts overcount). Receipt: coordination/handoffs/C7/REVIEW.md + RECEIPT.json + evidence/.
- Next: owner lane (C2/packet author) repairs F1/F2 in tweetLunaReview.ts (adapter untouched); C7 re-review is then one rerun of the evidence/ controls + CLI script.
- Gotcha: zsh won't word-split $vars in commands; use bash arrays (evidence/cli-controls.sh). A vitest `zod` alias breaks lib imports; leave it out.

## Ticket 2 — SITE-SOCIAL-SHARE (orchestrator ticket ~15:10Z; :3110 slot held)
- Scope: run existing web/e2e/social-share.spec.ts (sha e702827e…, clean) on isolated :3110 fixture server; evidence only; writes only handoffs/C7/social-share/.
- 15:18Z: 7 tests listed; Chromium 1223 already cached (no install). Server under c7-net-deny-log.cjs preload (denies+logs non-loopback from Node, keeps .env.local creds off the wire); spec itself aborts non-localhost browser requests and mocks the social-share API. Next honors last -p (3110). Run launched in background (run-social-share.sh).
- 15:19Z run1 (assigned command): 0 tests; webServer readiness on '/' timed out because homepage SSR calls api.nhle.com + PROD Supabase fyhftlxokyjtpndbkfse (74 attempts, all denied by preload). Finding SS-1.
- 15:20Z run2 (own isolated server on :3110 + PLAYWRIGHT_SKIP_WEB_SERVER=1, readiness on /social-share/game-grid): 7/7 pass. Browser externals all aborted by spec; Node externals: 1 denied npm registry check.
- 15:21Z: server pgid terminated; 0 listeners on 3110/3000. Slot released. Receipt: coordination/handoffs/C7/social-share/RECEIPT.md.
- State: DONE (both tickets). Next: Playwright config owner decides SS-1; C2/packet author repairs Luna F1/F2.

## Ticket 3 — C1 STATS-S06 + C4 SITE-WIGO review (~15:55–16:20Z)
- Pins: patches ecef9b66/2266893f match; preimages = HEAD blobs; both reverse-apply; C1 deps 15/15, C4 candidate match, before and after runs. No scratch rebuild needed.
- Owner tests rerun 45/45 (C1 39, C4 6). C7 controls 20/20 (deferred-supabase stale-order tests; lineup placement matrix; WiGO 32-team round trip, copy/context).
- Verdicts: C1 accepted with limits (F1 13F/5D extra F shown under "Defense" as pair partner — misleading; F2 19+ skater silent drop). C4 accepted with limits (F1 league links carry no context vs shared copy; F2 unresolved-team copy contradiction). Back = owner browser evidence only.
- Full-tree tsc: exit 2, only Luna errors → Luna F7 appended to REVIEW.md.
- Receipt: coordination/handoffs/C7/RECEIPT-C1-C4.md + c1-c4-evidence/. Gotcha: vitest config outside web/ must sit beside a node_modules symlink and use bare plugin imports.

## Ticket 4 — (1) Luna R1 / (2) C3 / (3) C5 (~16:40Z)
- Luna R1: scratch copy $SCRATCH/c7/luna-r1/web (pins 10/10). Base: owner 41 + C7 40 pass, R1 controls 9 fail (run2), K2/K3 exit0 review_only. Patch b6dc017e applied → hashes = C2 table; 98/98 pass; K2/K3 exit 2 held attempts 0. R1-03 retargeted twice (reviewer errors, logs kept). Full-tree tsc pending: heavy lock held by C2 at 16:47Z — retry once after C3.
- Luna R1 DONE: full-tree tsc on patched scratch exit 0 (lock free 16:50:44Z, released 16:51:44Z). Accepted. RECEIPT-LUNA-R1.md; REVIEW.md header updated.
- C3 DONE: own rsync baseline (5 hashes = receipts); base 6/7 C7 controls fail; both patches → = snapshot bytes; 84/84. Accepted with limits (weak UUID regex shared w/ server; identical screenshots; reuse safety rests on draft SQL, migration file deleted). RECEIPT-C3.md.
- C5 DONE: HEAD bytes via git show; base 8/16 fail; r2 → = canonical; 88/88 (owner 72). Day sim = 1 heartbeat row; real adminOnly denials 0 rows. Accepted with limits. RECEIPT-C5.md. Reviewer errors (default param, missing doc path) kept in logs.
- Evidence: coordination/handoffs/C7/r4-evidence/{luna-r1,c3,c5}. State: ticket 4 complete; no server, no Git, no prod.

## Ticket 5 — NEWS R1 / C1 R2 / SS1 (~17:15–17:45Z)
- NEWS R1: own rsync; base (canonical writer + R1 test) 5 owner fails (orchestrator said 4); R1 115/115 incl 3 C7 controls (unsanitized player-flags path 0 flags; sensitivity 1). Accepted. RECEIPT-NEWS-R1.md.
- C1 R2: canonical = candidates; 75/75 (owner 62); base (R1+S05 reversed) 12/13 C7 fail (structural for grid; S3 non-discriminating). Accepted (S06-R1) / accepted with limits (S05: two 390 screenshots obscured; extras placeholder boxes; 390 panel h-scroll). RECEIPT-C1-R2.md.
- SS1: 16/16 lease hashes = canonical; 47/47 (owner 38 + 9 server controls). No browser (C4 holds :3110) → owner e2e 12/12 claims. Accepted with limits (pickups not built; unauthenticated no-store API → 1 NST read per hit). RECEIPT-SS1.md.
- Evidence: coordination/handoffs/C7/r5-evidence/{news-r1,c1-r2,ss1}. State: ticket 5 complete.

## Ticket 6 — C3 R1 / C4 BLSH / C4 WiGO R1 (~18:00–18:30Z)
- C3 R1: canonical at baseline; delta → 498942ab/71494651; 98/98 (owner 81 + C7 17); base 4/10 R1-U fail; viewed all 9 PNGs (distinct, match states). Accepted; server regex still loose (boundary). RECEIPT-C3-R1.md.
- C4 BLSH v2: canonical = v2; lib pins clean; 82/82 (owner 79 + 3); D1 351 renders 0 stray numbers. Accepted with limits (zoom fix owner-measured). RECEIPT-C4-BLSH.md. Reviewer error run1 (FIXTURE_LEAGUE import) kept.
- C4 WiGO R1: 8/8 on R1; base fails W3-R1 and owner partial-state test. Accepted; noted drivers-panel copy contradiction. RECEIPT-C4-R1.md.
- Evidence: coordination/handoffs/C7/r6-evidence/{c3-r1,c4-blsh,c4-wigo-r1}. State: ticket 6 complete.

## Ticket 7 — SS1-3 (~18:40Z)
- 18/18 lease hashes = canonical; client files unchanged vs HASHES-2 (matchups type-only). 59/59 (owner 45 + C7 14; run1 L1 mock-abbrev reviewer error kept). O1 sweep 0 violations; O2 0 reads on failure; O3 400 with 0 reads; O4 single [0,63] then fail-closed; no leak. Serverless (browser judged non-essential; pinned before/after hashes verified on disk). Accepted. RECEIPT-SS1-R1.md; evidence r7-evidence/ss1-r1.

## Ticket 8 — LEAGUE-CONFIG-ANALYTICS design review (~18:55Z)
- Reviewed existing proposal /Users/tim/Documents/Codex/2026-10-23/task-10/league-settings-analytics-design.md (sha 67e0234d… = master pin); 24/24 source pins unchanged. Spot-verified 5 claims in code (external_leagues index, user_settings defaults, Yahoo substring collapse, Fantrax points fallback :828, ESPN sign inversion).
- Verdict READY WITH CHANGES: LC-1 narrow v1 fields; LC-2 thresholds vs scale; LC-3 fixture gaps; LC-4 sample composition; LC-5 HMAC linkage decision; LC-6 design outside repo; LC-7 prune tests. 10 owner decisions listed. RECEIPT-LEAGUE-CONFIG.md. No data, no server.

## Ticket 9 — SS1-4 / C3-4 / C2 T3 (~19:00–19:45Z)
- SS1-4: 20/20 hashes; server/API unchanged; 58/58 (owner 53 + 5). One browser run on :3110 (deny preload, skip-server): 14/14, all 7 pinned hashes matched; port released. Finding F1: freshness gate uses max timestamps (1 fresh row → 297 stale players 'ready'). O1 tier-fill decision for TJ. Accepted with limits. RECEIPT-SS1-4.md.
- C3-4: base 15/18 statuses leak sentinel; patched 43/43 0 leaks; request unchanged. Finding F1: status-only copy (infra 404 → "not eligible"; 422 config → "window closed", visible in C3's own screenshot 05). Pre-existing "window ended" future-date copy. Accepted with limits. RECEIPT-C3-4.md.
- C2 T3: COPY accepted; DUP accepted as proposal (contract held). 131/131; base reproduces 3 + 13. RECEIPT-C2-T3.md.
- Evidence: coordination/handoffs/C7/r9-evidence/{ss1-4,c3-4,c2-t3}.

## Ticket 10 — SS1-5 (~20:10Z)
- 20/20 hashes; server/API unchanged; 65/65 (owner 55 + C7 10). Browser :3110 (deny preload): 15/15, 7 pins (4 unchanged, 3 new pickup anchors) matched; port released. F1/O1/O2/O3 fixed. Accepted. Observation: half-stale still ready. RECEIPT-SS1-5.md; evidence r10-evidence/ss1-5.

## Ticket 11 — C3-5 (~20:30Z)
- Canonical DraftPro at baseline; delta → 1ffa98c5/e32bd9d5 = snapshot. 157/157 (owner 141 + C7 16): 0 sentinel leaks on load/redeem/verify/Patreon; F1 code-gated; tense ±90s ok. 13 distinct screenshots / 14 checks; tsc 2 known Luna errors only. Accepted. RECEIPT-C3-5.md; evidence r11-evidence/c3-5.

## Ticket 12 — SS1-6 (~20:15Z)
- 23/23 hashes; 68/68 (owner 62 + C7 6; run1 T2 fixture misuse kept). Wed Thu–Sun isolation 0 leaks; Tue deltas = exact column diffs; gates independent; server: Tue schedule-only read. Browser :3110: 19/19, 18 pins matched (Monday unchanged); released. Accepted with limits (O1: Tuesday adds a schedule read before any output exists). RECEIPT-SS1-6.md; evidence r12-evidence/ss1-6.

## Ticket 13 — SS1-8 live player path (~20:45Z)
- No live requests by C7. 25/25 hashes; 73/73 (owner 68 + C7 5 mocked: gating, exposure sentinel, cache, live-shaped freshness, real-loader query shape). percent_ownership numeric (lt OK).
- Live evidence: 4 local GETs (2 page + 2 API), API GETs concurrent (2 ms apart, strict-mode double) → deviates from "concurrency 1/sequential"; receipt says sequential + 1 warm-up (inaccurate). Extra tables: TJ direct second pop-up found in SS1 transcript ("Proceed, include both") — ledger CLAUDE-034 lacks it. Accepted with limits. RECEIPT-SS1-8.md.

## Ticket 14 — SS1-9 / SS1-10 (2026-10-24)
- Scope: read-only review of SS1-9 (correction, editionFetch, serial guard, editionLabel) and SS1-10 (flair, L5, wider pool, streaming evidence, expanded reads, global ownership). No live requests, no server, no edits, no Git.
- Where: receipt handoffs/C7/RECEIPT-SS1-9-10.md; evidence handoffs/C7/r14-evidence/ss1-9-10/ (ss1t10.json, ss1t10-observed.json, serial-guard.log, controls copy).
- Checks: pins ok (patches 364a3118…/afe52ca0…, HASHES-10 30/30); Vitest 82/82 under network guard (SS1's 75 + my 7); node --test serial-guard 2/2; viewed flair-pickups-30 and flair-stream PNGs.
- Verdict: SS1-9 accepted; SS1-10 accepted with F1 (failed recent read prints "No game in the last two weeks" for everyone and caches 300 s) and F2 (top-10 eyebrow/alt text vs wider-pool fills). O1: ~15–17 typical, 34 worst-case upstream reads per uncached GET (map chunks 2 ids/row).
- Gotcha: map view asks for both player_key and player_id per Yahoo row, so chunk count is ⌈2R/150⌉.
- Next: none for this ticket; awaiting the orchestrator.

## Ticket 15 — SS1-12..15 pre-production gate (2026-10-24)
- Scope: read-only review of SS1-12 (colour tiers), -13/-14 (tier list, live trim, e2e), -15 (reset fix, L5 FP ranking, roles, chips, reads) and the LOHO plan. No live, no server, no edits, no Git.
- Where: receipt handoffs/C7/RECEIPT-SS1-12-15.md; evidence handoffs/C7/r15-evidence/ss1-12-15/ (ss1t15.json 151/151, run1 kept, observed JSONs, controls).
- Checks: patch hashes match CLAUDE-053; chain reversed in scratch (15→14 9/9; →12 all but the 2 Codex-returned tests); security files = Codex CANDIDATE except canonical AuthProviderContext.test.tsx (Codex 16:59 edit, pending merge); 22/22 e2e PNG pins re-hashed.
- Verdict: 12/13/14 accepted; 15 accepted with F1 (bad ?week crashes render), F2 (non-unique order on 2-page recent reads), F3/F4 copy. Obs: Vilardi wins via TOI only without roles; two meanings of "relative TOI"; no-store → ~17–20 reads per editor load.
- Gotcha: route no longer uses shareCacheControl (Codex access sets private,no-store).
- Next: none; awaiting orchestrator.
