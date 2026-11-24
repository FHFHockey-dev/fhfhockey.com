# FORGE Full-NHL H1–H10: hosted shadow-run packet (rev 4: goalies, FxTwitter path, Q2 storage, Q3 signed dispatch)

This packet supersedes `../SHADOW-ISSUANCE-PLAN.md` and packet rev 1–3. Nothing here is applied, deployed, scheduled or
run against production. The candidate SHA and exit codes are in the lane report (`REPORT.md`, side-session notes).

## 0. Read first

| | |
|---|---|
| **Migrations are required** | The bounded read (q5) found `forge_v2_private` absent in production. The hosted run needs **20261029235656** (v2 history) and the new **20261123200000** (goalie tables), in that order. See §2 and `migrations-apply.sql`. |
| **The trade is real; `rosters` lags it** | The public NHL API, read locally at 2026-11-23T17:14Z and saved with hashes in `nhl-public-20261123/`, lists Larkin `currentTeamId` 8 (on the MTL season roster) and Dach and Montembeault `currentTeamId` 17 (on the DET season roster). Production `rosters` still had the old clubs. Dach and Montembeault were last seen 2026-11-23 02:00Z; Larkin was never seen (`official_seen_at` null; last game 2026-10-26). There is no published news card for any of the three. The NHL endpoints give the current club, not a transaction date, so "effective" means **first official observation**. |
| **D1 (TJ, 2026-11-23): official roster plus FxTwitter** | Built in the route. **Nightly:** before the freeze the route reads every club's official NHL roster (`api-web.nhle.com/v1/roster/{club}/{season}`, 32 GETs, sequential, 8 s timeout, no NST). A player the official roster lists on another club, or a call-up FORGE does not list, becomes an **official move** dated by its first observation; it outranks the lagging `rosters` snapshot, which is then reported as a conflict. This needs no tweet and does not depend on FxTwitter. **Material:** accepted news cards (`news_feed_items` `published`, the existing poller's output, read-only) are snapshotted. A credible trade/recall/roster-move report only triggers a **bounded official recheck** (at most 4 clubs per call: the player's FORGE club, the card's club, the player's named club). The report stays pending until the official roster shows the move; then the player's next ten targets are rebuilt under the new club, once. Availability (out, scratch, questionable, confirmed return) and goalie-start role are **overlay revisions** on the stored forecasts, never new forecasts (§1a). On real data the official observation gives **804 players / 8,040 keys, identical to Astra's set**. **q8 has no card for Larkin, Dach or Montembeault**: FxTwitter alone would not have caught that trade; the nightly official read does. The 07:45Z `update-players` run is no longer needed for H10 but stays an open item. |
| **Material feed today** | `forge_roster_events` has had **zero rows since 2026-10-01** (q4, q7). The material path now runs on accepted news cards plus the official recheck; q8 shows cards published at :00 and :30, so a material job at :05 and :35 is proposed (§4). |
| **Goalies are built and run on real data** | A separate target (`nhl-official-goalie-start-v1`, if-starts) covers SAVES, SHOTS_AGAINST, GOALS_ALLOWED (SV + GA = SA), WIN and SHUTOUT, with the additive migration. **Read #2 ran** (`read-results-goalies-20261123/`): 821 lines, 795 goalie/dates. **The 26 extra are Utah**: `teams` lists `UTA` twice (59 Utah Hockey Club, 68 Utah Mammoth), so the abbreviation join returned every Utah line twice. The same join had doubled **864 skater lines** in the rev-3 G2. The reader now keeps only the copy whose club played the game and drops anything it cannot place, by name; nothing is guessed. **G2 with goalies: 730/730 goalie keys numeric on H1–H10** (739 training starts). Only if-starts is built; start probability is not modelled (a confirmed-starter report is a role overlay). |
| **Q2 storage (TJ, decided)** | Monthly partitions by issuance time (`20261123210000`, applied while empty), a never-archived `forge_h10_evidence` table for news, official moves and overlays, and an insert-only archive manifest plus a searchable (player, game) index. One month rehearsed end to end locally: export, checksum, isolated restore, every row reconciled, as-of lookup and backtest reproduced (§6). No production archival or partition drop. |
| **Q3 auth (TJ, decided)** | Per-dispatch HMAC after the 11-17 pregame pattern (`20261123220000`). A dedicated Vault secret signs route, mode, run, dispatch id and a 90 s expiry; only the signature travels. The route verifies before any work and consumes the dispatch once. **No bearer fallback** (`adminOnly`/`CRON_SECRET` removed from this route). Proven: valid, expired, altered, wrong route, other run, concurrent duplicate (§4). |
| **D5 (TJ, decided)** | Keep the inferred log clock, labelled `log_receipt_clock_inferred_next_wgo_ingest_after_game_end`. |
| **Evidence class** | Skater numbers on real data are local and unevaluated; the recipe constants were chosen in this lane. Every vintage carries `predeclared_recipe_unreviewed` and `prospective_shadow_unqualified`. |

## 1. What ships

| Piece | File | Producer closure |
|---|---|---|
| Dated membership ledger and frozen denominator | `lib/forge-v2/denominator.ts` (+ `schedule.ts` additive split) | outside |
| Skater features, capped training, kernel recipe (existing `official-appearance-kernel-means-v1`) | `lib/forge-v2/h10Features.ts` | outside |
| Goalie if-starts contract, features, kernel means | `lib/forge-v2/h10Goalies.ts` | outside |
| Skater producer and readback (v2 ledger, queues, issuance, receipts) | `lib/forge-v2/h10Producer.server.ts` | outside |
| Goalie store, issuance and readback | `lib/forge-v2/h10GoalieProducer.server.ts` | outside |
| Bounded reader SQL and mapping | `lib/forge-v2/h10Reader.server.ts` | outside |
| Nightly and material handler, guard | `lib/forge-v2/h10Route.server.ts` | outside |
| News snapshots, availability overlay, recheck plan, official moves (pure) | `lib/forge-v2/h10News.ts` | outside |
| News SQL, official roster fetch, record storage, overlay revisions | `lib/forge-v2/h10NewsRoute.server.ts` | outside |
| `POST /api/v1/db/forge-h10-shadow?mode=nightly\|material` | `pages/api/v1/db/forge-h10-shadow.ts` | outside (no FORGE root imports it) |
| Opt-in `prospective_shadow` and means-only issuance | `lib/forge-v2/pipeline.server.ts` | outside |
| Goalie tables (proposed migration) | `supabase/migrations/20261123200000_forge_v2_goalie_h10.sql` | n/a |
| Monthly partitions, H10 evidence table, archive manifest + index (proposed migration) | `supabase/migrations/20261123210000_forge_v2_h10_partitions_archive.sql` | n/a |
| One-use HMAC dispatches, owner-only tick (proposed migration) | `supabase/migrations/20261123220000_forge_h10_hosted_dispatch.sql` | n/a |
| Dispatch verification (route, mode, run, expiry, one use) | `lib/forge-v2/h10Dispatch.server.ts` | outside |
| Archive export / checksum / restore / reconcile / as-of lookup / backtest (operator tooling) | `lib/forge-v2/h10Archive.server.ts`, `scripts/forge-h10-archive-rehearsal.ts` | outside |
| v2 writers: `ON CONFLICT (col)` → `ON CONFLICT DO NOTHING` (behaviour unchanged; partitioned keys include the month) | `lib/forge-v2/history.server.ts` | outside |

- **Producer closure.** The print is `23af25d3f3f534d5e8ce09de44c916ed8ba778bd080395486ec4dfb2500f5b27`, identical to
  production, so **no re-registration is needed**. Re-print on the final SHA.
- **No Codex-lane file is touched.** `lib/sources/**` is consumed read-only through the database (accepted cards);
  `lib/lines/authority.ts` is imported read-only for author tiers.
- **Serving surfaces are untouched.**
  - Daily, pregame and RSO are unchanged.
  - `api/v2/forge` stays `enabled: false`.
  - `RSO_V2_ADAPTER_ENABLED` stays `false`.
  - Qualification refuses non-`public_serving` evidence.

## 1a. FxTwitter/News material path (rules, proven in `h10News.test.ts` and `h10NewsRoute.test.ts`)

| Report (category / subcategory) | Effect |
|---|---|
| TRADE, SIGNING, WAIVER, ROSTER MOVE, RETIREMENT, TRANSACTION / roster move or status | Official recheck of the named clubs only. **Never moves a player**; pending until the official roster confirms, expired after 72 h. |
| INJURY / OUT, SURGERY / REHAB | Out from the post time on: the stored forecast is withheld, not replaced. |
| SCRATCHES / CONFIRMED SCRATCH | Out for the next game only (within 48 h of the post). |
| INJURY / other, REPORTED INJURY | Questionable on the next game; the forecast is still served. |
| RETURN / RETURNING, RETURNING TO LINEUP, FULLY HEALTHY ("will play", "activated off IR") | Lifts the out overlay: **the same stored vintage is served again**; nothing is re-issued. |
| RETURN / PROJECTED RETURN; practice or projected lines | Annotation only; never lifts. |
| GOALIE START / CONFIRMED STARTER (EXPECTED STARTER) | Role on the next game; a confirmed starter marks his club's other goalies `not_confirmed_starter`. |

- **Credibility.** Availability and role need a club account or a reviewed beat reporter (`lib/lines/authority.ts`
  tiers `team`/`beat`); relay and unknown authors change nothing. Any accepted card may trigger a recheck.
- **Provenance.** Each card revision is stored once (`forge_v2_records`, kind `history_event`, scope `forge-h10-news`)
  with the original post id and URL, the author, the post time (`observed_at`) and FORGE's first-seen time.
  `published_at` is re-stamped by the feed and never used.
- **Ordering and dedupe.** Reports are applied in post-time order, so a late-arriving older report never overwrites a
  newer one. An identical redelivery is the same stored revision. A changed card is a new revision that supersedes
  its predecessor. Same-time contradictions are recorded as conflicts and change nothing.
- **Official evidence.** Each distinct official roster response is stored, content-addressed, before any move is
  derived from it; a move is stored once with its first-observed time and a predecessor chain (reverse trades work).
- **Departures.** Only a complete nightly read of all 32 clubs can remove a player: a FORGE member no official roster
  lists is recorded as a departure (an `assignment` off his club, listed out of scope), so a send-down after a call-up
  or a trade closes. A partial read (a failed club, or a material recheck) never removes anyone. On real data this
  removes 3 players `rosters` still listed (two of them with transaction cards on 11-19 and 11-21).
- **Long injuries.** Every revision of any card that was ever an out or a return stays loaded, so an out overlay lasts
  until an explicit return however old the card is.
- **Overlay revisions** (`forge-h10-overlay`) name the stored vintage they apply to and their predecessor; only a
  change writes a revision.
- **No new table or migration.** All of this uses the existing `history_event` kind.
- **Recheck schedule.** A pending report is rechecked at first sight and at 1, 3, 6, 12, 24 and 48 h (at most seven
  times), not on every call. A report FORGE already reflects (every named player already on the named club) is
  settled without a recheck.
- **Official appearances lift an older OUT (TJ approved the rule on 2026-11-23; rule only, not the material cron):**
  - **Actual participation only:** the player's own box-score line with time on ice above zero (skaters
    `toi_per_game`, goalies `time_on_ice`, `games_played = 1`). Dressing, a lineup listing, or a goalie sitting as
    backup lifts nothing.
  - **Must follow the OUT report and never overrides a newer credible OUT:** ordered by the game played, so an OUT
    posted after that game began (an in-game injury) stays in force; a later OUT applies again.
  - **From FORGE's first observation:** the hold lifts for games starting after the time the route first read the
    line (stored once per line in `forge_h10_evidence`, `forge-h10-appearance`), not from the game.
  - **Earlier editions and overlay revisions are preserved;** lifted games carry `participation_assumed_not_confirmed`.
  - Proven in `h10News.test.ts` (each condition) and `h10NewsRoute.test.ts` (real ice time lifts; zero ice time does
    not; the first-observation stamp is kept across calls). Read #3: 5 of 35 players reported out played again within
    the week with no return post.
- **Read volume.** The news read pages by (updated_at, id), 500 a page, up to 5,000 cards; past that the call refuses
  the news step and reports the gap (`news.status = refused`, where it stopped), and membership still runs. Nothing is
  ever truncated silently.

**G2c (read #3 replayed locally, `g2c-news-replay.json`, `scripts/forge-h10-news-replay.ts`).** 385 published cards
(11-16 18:00Z .. 11-23 21:00Z) through the rules at every proposed material tick (273 ticks), against the real
denominator and the real 32-club official read.

| Measure | Result |
|---|---|
| Volume | **At most 192 cards in any 72 h read** (route filter). n4's 774 counts drafts (920 OTHER/AMBIGUOUS drafts alone); the route never reads drafts. |
| Authors | beat 240, team 16, **unknown 129**: 109 cards have no `source_account` and no post URL (25 roster moves, 25 confirmed goalie starts, 20 scratches, 14 outs, 18 questionable, 1 return), plus 20 from handles outside the reviewed list. |
| Availability reports | 339, of which **241 credible**; 98 not credible (unknown author) change nothing. |
| Membership reports | 46: 24 already reflected by `rosters`, 2 confirmed by an official read, 15 expired unconfirmed, 3 pending at the end. **113 official GETs in the week (≤18 a day, ≤4 per call)**, 64 of 273 ticks. |
| Overlays at the end | 271 keys / 91 players: 150 out (15 players), 1 questionable, 120 available after a lift or with annotations only; 3 confirmed starters, 4 not-confirmed goalies; 0 conflicts. **5 players lifted by an official appearance** (50 keys, each labelled participation assumed; without the rule: 200 out keys). About 45 overlay revisions a day. |
| Limits | latest card state only (earlier revisions invisible, first-seen times are upper bounds); membership is the end-of-week state; the official state at each recheck is the 11-23 read. |
| **Estimates, not live acceptance** | Appearance observation times in the replay are the first material tick after the inferred WGO receipt; read #3's skater lines carry no time on ice, so a line counts as participation there (goalies need a start or shots against). The hosted route stamps its own first read and requires time on ice > 0. |

**Material job readiness:** the official-appearance rule is approved (rule only). The job itself still needs its own
approval to schedule or enable, after one watched nightly run. Known gap, not blocking: 28% of accepted cards have no author or post URL, so they never change availability
(a provenance fix belongs to the Codex lanes that write the cards).

## 2. Migrations (`migrations-apply.sql`)

- **Apply order** (one session, before any issuance, through the gated migration process, not `db push`):
  1. `20261029235656_forge_v2_immutable_history.sql`: schema, sequence, vintages, receipts, records, artifacts, queue,
     triggers, `service_role`-only grants.
  2. `20261123200000_forge_v2_goalie_h10.sql`: goalie vintages + receipts; refuses without step 1.
  3. `20261123210000_forge_v2_h10_partitions_archive.sql`: rebuilds the five history tables as monthly partitions
     (refuses if any holds a row), adds `forge_h10_evidence`, `forge_v2_archives`, `forge_v2_archive_index` and month
     partitions through 2027-08.
  4. `20261123220000_forge_h10_hosted_dispatch.sql`: dispatch table, run-key function, owner-only tick, begin/finish
     RPCs. Creates no secret and no cron job.
- **Readback.** Relations, partitions per parent, triggers (including per-month no-truncate) and grants, with expected
  values, in `migrations-apply.sql`. Every table starts empty; `service_role` cannot run the tick.
- **Rollback.** Only before the first issuance, while every table is empty: drop the two public dispatch functions,
  the goalie tables and functions, `drop schema forge_v2_private cascade`, and remove the four migration-history rows.
  After the first issuance, rows are immutable by design.
- **Indexes.** No extra index migration: 30-night query times are in §5; each month partition carries the parent's
  indexes.

## 3. Configuration (Vercel, fhfhockey production)

- **New:**
  - `FORGE_H10_SHADOW_ENABLED=true`
  - `FORGE_H10_SHADOW_APPROVAL_ID=<TJ approval evidence id>`
  - `FORGE_H10_SHADOW_APPROVED_AT=<ISO time>`
- **Optional:** `FORGE_H10_OFFICIAL_ROSTERS=false` turns every official roster read off (default on). Membership then
  comes from `rosters` plus stored moves only, and a trade report stays pending.
- **Signing secret (new, both sides, ≥32 printable characters, used nowhere else):** Vault `forge_h10_dispatch_secret`
  and Vercel `FORGE_H10_DISPATCH_SECRET`, the same value. Not `CRON_SECRET`, not the pregame secret.
- **Database URL:** `SUPABASE_DB_POOLER_URL`, else `SUPABASE_DB_URL`, else `POSTGRES_URL` (the transaction-pooler URL
  the Supabase integration syncs). Correction 11-24: this line used to call `SUPABASE_DB_URL` "existing", but it was in no
  Vercel project, so every 11-24 dispatch answered 503 `database_url_missing` before any database work. TJ is adding
  `SUPABASE_DB_POOLER_URL` (host `*.pooler.supabase.com`, port 6543, user `postgres.<project-ref>`) to `fhfhockey`. The
  direct `db.<ref>.supabase.co:5432` host is IPv6-only unless the IPv4 add-on is on, so Vercel cannot use it. An env var
  reaches only deployments made after it is saved.
- **Existing:** `VERCEL_GIT_COMMIT_SHA`. `CRON_SECRET` is no longer accepted by this route.
- **Fail-closed behaviour.** Without the signing secret the route answers 503 before any database connection; with an
  invalid, expired, altered or wrong-route signature it answers 400/401 before any database connection; with the
  approval variables missing it returns `skipped` without a database connection.

## 4. Schedule (`cron-proposed.sql`, not applied)

- **Two jobs, approved separately.**
  - `forge-h10-shadow-nightly`, `*/15 8-12 * * *` UTC, **20 calls a day**.
  - `forge-h10-shadow-material` (new; G2c done, after one watched nightly), `5,35 0-7,13-23 * * *` UTC, **38 calls a day**. Cards publish at :00 and :30
    (q8), so each call sees them within about 5 minutes. It stays out of the 08–12 UTC nightly window so it never
    overlaps a nightly freeze or issuance.
  - Before 04:00 ET a call returns `skipped` without a database connection.
- **The first call after 04:00 ET freezes the night.** Order: off-season skip, lines check, roster guard on `rosters`
  plus stored moves (all before any request or write), then the 32-club official read, then the guard again, then the
  freeze. Only that last guard can refuse after the read; its roster records are content-addressed, so a repeat writes
  nothing new (but re-reads the 32 clubs).
  - **Cutoff = freeze time.** `games.game_state_observed_at` and `rosters.official_seen_at` are last-observed stamps.
    The real read showed `observed_at` = 10:05Z on every game, so a fixed 04:00 cutoff would have made the whole
    schedule look future.
  - **Guard.** It requires 32 clubs, ≥90% of the previous night's players, at least the recipe's minimum training
    lines, and no shortfalls unless the regular season ends within 30 days. With no future games it returns `skipped`
    (off-season). Otherwise it returns 409 and writes nothing.
  - **Freeze record.** The denominator, its schedule and a hash of the skater and goalie lines.
- **Later calls** resume 320 team × horizon skater queues under a 200 s budget (at least one queue per call), then the
  goalie phase. A complete night costs one SELECT per call.
- **Material mode** (per call):
  - snapshots cards changed in the last 72 h (one bounded SELECT, limit 500);
  - rechecks at most 4 clubs for pending reports (no request when none is pending);
  - diffs membership (rosters + official moves) against the latest freeze and issues confirmed moves and roster events,
    one event per player and evidence row, cutoff at first detection;
  - writes overlay revisions for changed availability/role.
  A call with nothing new writes nothing and returns `no_change`.
- **Auth (Q3, decided): per-dispatch HMAC.** Each cron job calls the owner-only `forge_h10_tick_v1(mode)`, which
  closes expired or stale dispatches, sends nothing while one is in flight, and otherwise records a one-use dispatch
  and posts `{dispatchId, mode, runKey, expiresAt}` with `X-Forge-H10-Signature` = HMAC-SHA256 over
  `forge-h10-dispatch-v1 / route / mode / run / dispatch id / expiry` (90 s). The route, in order: POST only, no query;
  signature (timing-safe); expiry (≤120 s ahead, not past); run key equals the route's own (`nightly:<ET date>` of
  the latest 04:00 ET cutoff, same function in SQL and TS, tested across DST); then `forge_h10_dispatch_begin_v1`
  starts the dispatch exactly once under an advisory lock. Then the forecast work, then `finish`.
  - **Retries.** A retry of the same delivery, or a concurrent duplicate, gets `duplicate` with the run's outcome and
    does no work. The next tick (15 minutes) resumes the night through the existing freeze and queues, so a retry can
    never start a second edition or overwrite an issued one (issuance keys and the freeze are idempotent as before).
  - **Proofs** (`h10Dispatch.test.ts` on PostgreSQL with Vault, pg_net and pgcrypto stand-ins; the database's HMAC is
    verified by the route's code; `__tests__/pages/api/v1/db/forge-h10-shadow.test.ts` for the page): valid dispatch
    starts once; the secret never appears in the posted headers; expired signature (route) and expired dispatch
    (database) refused; altered mode, run, id or expiry refused; another route's signature and the wrong path refused;
    a correctly signed other night refused as `run_mismatch`; three concurrent deliveries → one start, two
    `duplicate`; a bearer token, a query string or no secret → refused with no database connection and no work.

## 5. Capacity and runtime

**Measured on real data.** G2 dry run, `g2-real-dry-run.json`: disposable local PostgreSQL 17, TJ-approved read plus
the public NHL observations, cutoff 2026-11-23T17:20Z.

| Measure | Result |
|---|---|
| Inputs | 1,344 games, 1,337 roster rows (498 never officially seen, so listed unverified), 14,435 skater lines → **13,571 mapped (864 Utah alias copies dropped)**, 821 goalie lines → **795 mapped (26 Utah alias copies dropped)** |
| Denominator (rosters + official) | 804 players / 8,040 keys, 32 clubs, H1–H10 each 731 skaters + 73 goalies; 0 shortfalls; guard passes; **key set identical to Astra's** (0 differing) |
| Route's nightly official read on real data (`routeNightlySweep`) | All 32 official season rosters fetched locally at 19:51Z (`nhl-public-rosters-20261123/`, hashed; 804 players listed), complete read as the route does. 10 official records: 3 club changes (Dach and Montembeault MTL→DET; 8481133 club 13→23, which had a TRANSACTION card on 11-22 while `rosters` still said 13 at 02:00Z), Larkin verified on MTL, 1 call-up absent from `rosters`, 2 never-stamped players verified on their own club, **3 departures** (8478424, 8480326, 8484268: listed by `rosters`, on no official roster; two had transaction cards). Denominator **804 players / 8,040 keys (732 skaters, 72 goalies)**, guard passes, 3 `rosters` contradictions reported. **800 players identical to Astra's set**; the other 4 differences come from the later official read. |
| Skater issuance | 7,310 published, **7,310 numeric on every horizon (731 per H)**, 0 stray, receipts all match. 276 s, 154k statements. Training: 2,000 of 13,391 examples (rev 3 counted 14,255 with the doubled Utah lines; those figures are superseded). |
| Goalie issuance | **730 published, 730 numeric on every horizon (73 per H)**, 0 gaps, 0.9 s. Training 739 starts (10 with no prior receipt, 5 with inconsistent values skipped). |
| Matchup spread (real) | Skaters: 8–10 distinct forecasts across ten games (10: 502, 9: 205, 8: 24); the default-score range is min 0.012, **median 0.085**, max 0.144. Goalies: mean saves 23.3–24.2 across all keys. The matchup signal is weak (L4). |
| Bytes, first night (default TOAST) | Skater vintages 21.0 MB, records 18.2 MB, receipts 3.6 MB, goalie vintages 1.8 MB + receipts 0.3 MB; queue table 6.5 MB, rewritten in place (live state about 1.1 MB) |
| Compressibility | Vintage payloads 24.2 MB raw → **1.55 MB gzip across rows** (15.6×); records 7.7 MB → 0.22 MB. Payload column alone, like for like: **pglz = lz4** (vintages 15.0 MB, records 8.4 MB), so per-row column compression gains nothing. |

**Synthetic full scale (earlier, same code path).**

- Interrupted-then-resumed run, rerun adds 0 rows.
- Night two rotates all queues, and every episode closes and reopens.
- 30-night query times at 443k records / 219k vintages: episode heads 294 ms, opportunity heads 326 ms, latest
  vintages 3 ms per queue, readback 94 ms.
- Per-key compute: 31 ms at the 2,000-row cap, 127 ms at 8,000, 225 ms at 13,824. Keep the cap.

**Hosted estimate (unmeasured).**

- **CPU.** About 4–5 min of active CPU per night: 7,310 keys × 31 ms, plus the freeze read and goalies.
- **Wall time.** About 154k short statements at a 1–3 ms round trip adds 3–8 min of I/O wait, so 7–13 min, in 3–4
  working calls of ≤200 s each.
- **Total Vercel time per night.** About 4–5 min of active CPU plus about 16 cheap calls at under 0.5 s. That is
  roughly 2.5 h of active CPU a month. Provisioned memory is about 1–2 GB for 13 min a night, so 6–12 GB-h a month.
- **Load on the production database.** About 200–400 short statements per second inside the window. The first night is
  watched (§6).
- **NST.** 0 requests.
- **Outbound HTTP.** `api-web.nhle.com` only: 32 GETs at the nightly freeze, and at most 4 per material call while a
  trade/recall report is pending (none otherwise). Worst case about 32 + 38 × 4 ≈ 184 a day; typical well under 50.
- **Material job (estimate).** 38 calls a day, each a few bounded SELECTs and two in-memory denominator builds, about
  2–4 s; about 2 min of active CPU a day. A confirmed move adds about 10 keys × 31 ms per player.

## 6. Storage, retention and archive (Q2, decided; rehearsed locally on one representative month)

**Design** (`20261123210000`, applied while empty):
- **Monthly partitions by issuance time.** Skater and goalie vintages, both receipt tables and records are range
  partitions on their insert clock: the server time the edition was written, so a month is a closed set of editions
  with their receipts and ledger records. Writers are unchanged. A guard trigger keeps ids, issuance keys, sequences
  and receipt vintage ids unique across months (a duplicate is skipped, like `ON CONFLICT DO NOTHING`, and the
  writers' byte readback still decides). Foreign keys become triggers with the same rule. Every month partition keeps
  the immutability triggers, including its own no-truncate trigger (statement triggers are not inherited; a test
  caught this).
- **Never archived:** `forge_h10_evidence` (news snapshots, official rosters and moves, availability overlays; about
  0.2 MB a day), because long injuries and move chains outlive any window. Also the work queue (operational state).
- **Archive unit:** one gzip CSV per table and month, written by `COPY` in insertion order (UTC), so every column
  comes back unchanged: payload bytes, output and content hashes, transaction ids, receipt and insert clocks, ordinals.
  That preserves every immutable edition with its run, model, feature and code versions, cutoffs, if-playing /
  if-starts projections, uncertainty fields and source manifests, and the episode/lock/freeze records needed to
  reconstruct what was known at each cutoff.
- **Manifest (searchable):** `forge_v2_archives` (table, month, rows, content digest, file sha256, bytes, storage path,
  insert-time span, restore verification) and `forge_v2_archive_index` (archive, player, game, forecast count,
  first/last issue time). Both insert-only, in Postgres permanently (2.3 MB for a month).

**Rehearsal** (`archive-rehearsal-2026-11.json`; `scripts/forge-h10-archive-rehearsal.ts`): night 1 is the real
issuance on the approved real data (804 players, 8,040 keys, the route's 32-club official read); nights 2–30 replicate
it with their own ids, keys, sequences, cutoffs (the 29 days before 11-23) and receipts. Forecast values repeat; row
sizes are real.

| Step | Result |
|---|---|
| Month in Postgres (tables + indexes + TOAST) | **1,383 MB, of which indexes 366 MB** (about 46 MB a night). Vintages 640 MB, records 575 MB, receipts 108 MB, goalie vintages 52 MB, goalie receipts 9 MB. Rows: 219,600 + 21,600 vintages, the same receipts, 444,270 records. |
| 1. Export (5 files) | 9.6 s; 1,373 MB CSV → **116 MB gzip** (11.8×; about 3.9 MB a night) |
| 2. Checksum | sha256 per file, verified again before restore (a wrong checksum refuses the restore: tested) |
| 3. Restore into an isolated database | **61.9 s** (the four migrations, then `COPY` with triggers off) |
| 4. Reconcile | **All five tables identical**: row count, key digest and full-row digest (every column of every row); one altered byte is caught (tested) |
| 5. Reproduce | **1,192 as-of lookups identical** (latest edition with cutoff ≤ T and receipt ≤ P); **backtest identical** (7,320 targets, MAE and bias by horizon; outcomes are a seeded fixture, the games are in the future) |
| Manifest, then local detach + drop | 5 archive rows, 8,040 index rows; after the drop the hot lookup finds nothing and the index points to the archive file and its sha256 |

**Live retention window (proposed), from what reads the data:**
- Issuance needs the last freeze and open episode/lock heads for targets up to ten games ahead (about 25 days; ≤30
  with breaks). Material and overlays read `forge_h10_evidence`, which never leaves.
- Evaluation of a month's editions needs every target game final plus stat corrections: the last target is about 30
  days after the month ends, plus about 14 days, so a month is fully gradable about 45 days after it ends.
- **Proposal: keep the current month plus the two previous full months in Postgres; archive month M from the 1st of
  M+3** (at least 59 days after M ends, about 14 days of slack for a re-run of the monthly evaluation). Hot peaks at
  about three months ≈ **4.2 GB** (vs about 8.8 GB for a whole season unarchived); the archive is about **0.75 GB a
  season** in private Storage.

**Production archive procedure (separate approval each month; none done):** export the month's five partitions with
`h10Archive.server.ts` (operator machine, psql), upload to a private Supabase Storage bucket (`forge-v2-archive/`),
re-download and verify sha256, restore into an isolated database, reconcile and reproduce the as-of sample and the
backtest, then insert the manifest and index rows, then `DETACH` and `DROP` the five partitions. Rows are never
updated or deleted; a month leaves Postgres only whole, verified and indexed.

## 7. Gates

**Before arming:**

- **G0.** The closure print is `23af25d3…` on the release SHA, and the diff from `9ac6f4bcc` touches only §1 files plus
  artifacts.
- **G1.** The four migrations applied in order, then `migrations-apply.sql` readback: relations, month partitions,
  triggers and grants as expected, every table at 0, and `service_role` unable to run the tick.
- **G2. Real-data dry run.** **Done** for skaters and goalies (§5): key set identical to Astra's; 7,310 skater and
  730 goalie keys numeric on H1–H10; every dropped input line named.
- **G2c. News real-data replay. Done** (§1a): 192-card 72 h peak, 241 of 339 availability reports credible, ≤18
  official GETs a day, 5 players correctly lifted by official appearances.
- **G2b (informational, no longer blocking).** The route reads the official rosters itself, so H10 does not wait on
  `update-players` stamping Larkin. Re-reading q6 after the next 02:00Z run still tells the `rosters` owner whether IR
  players fall outside that refresh.
- **G3.** Env vars and the signing secret (Vault and Vercel, same value) are set; cron SQL is reviewed; the deployed SHA
  is the candidate. A manual `select forge_v2_private.forge_h10_tick_v1('nightly')` after 04:00 ET returns `queued`
  and its dispatch finishes (`forge_h10_dispatches`).
- **G4.** 0 NST requests; outbound HTTP only to `api-web.nhle.com` within the §5 bounds (count it from the response
  bodies: `official.clubs`, `news.recheck.clubs`).

**First hosted night (watched).** Abort if production DB CPU stays above 70%, or if any FORGE Daily or pregame job
slows. To abort, unschedule the job and set the flag false.

**Readback after the night** (read-only):

- **R1.** One freeze record and one complete record for the date.
- **R2.** Skater vintages = skater scopes, and goalie vintages = goalie keys, each with a matching receipt.
- **R3.** `readbackH10` + `readbackH10Goalies` coverage by horizon and class. Stray is limited to traded players'
  old-team keys. Every non-numeric value has a reason.
- **R4.** A repeated nightly call returns `cached: true` and adds 0 rows.
- **R5.** `forge_v2_artifacts` = 0 (means-only).
- **R6.** Existing FORGE tables change only through their own jobs. RSO and Daily `forecastSource` and revision ids
  are unchanged.
- **R7.** Every vintage is `prospective_shadow` with `qualificationId = null` and the unreviewed limitations.
- **R8.** One `forge-h10-official-roster` record per distinct club roster; official moves listed with their first
  observation; the nightly body shows `official.failures` empty.

## 8. Rollback

- **Stop:** unschedule the job(s) and set the flag false. Removing `FORGE_H10_DISPATCH_SECRET` also stops every
  dispatch at the route (503).
- **Rows stay.** Rows are immutable. To withdraw a night, append a retraction record.
- **Drop the schema** only per §2, before the first issuance.
- **No code rollback** is needed.

## 9. Known limits

- **L1. Inferred log clock.** `wgo_skater_stats` and `wgo_goalie_stats` have no ingestion timestamp (q5: 0 columns).
  Each line's receipt clock is **inferred** as the first 07:30 UTC WGO ingest after start + 3.5 h, labelled
  `log_receipt_clock_inferred_next_wgo_ingest_after_game_end` (D5: TJ kept it, labelled inferred).
- **L2. Membership.** Membership comes from official roster observations. IR, LTIR and assignment status are not
  separated from roster status. Rows never seen, or unseen for more than 36 h, are listed unverified (498 in the real
  read), never issued.
- **L3. Unreviewed recipes.** Both recipes are unreviewed, with no selection run. Participation and start probability
  are not modelled; forecasts are if-playing and if-starts.
- **L4. Weak matchup signal.** On real data the forecasts are distinct per game but close together (median 0.106 points
  across ten games).
- **L5. Mutable inputs.** The freeze keeps the denominator, schedule and a lines hash. Changed lines after the freeze
  fail closed.
- **L6. FxTwitter path.** Proven on fixtures only (G2c pending). The official roster gives the current club, not the
  transaction type or IR status: a club change is recorded as `trade`, a new listing as `recall` (both status
  `roster`). A pending report whose destination is not among the rechecked clubs waits for the nightly 32-club read.
  The model has no role or line features, so lineup reports are annotations only. Existing `forge_roster_events`
  rows still re-issue vintages (that feed is empty); news-derived availability never does.
- **L7. Utah alias.** `teams` lists `UTA` for both 59 and 68. The reader resolves it through the game; the duplicate
  row itself is a data issue for whoever owns `teams`.

## 10. Approvals TJ would need

Decided by TJ on 2026-11-23 and built: D1 (official roster + FxTwitter), Q2 (partitions + verified archive; retention
window adopted: current month + 2 hot, archive M from the 1st of M+3, each archive approved separately), Q3
(per-dispatch HMAC), D5 (inferred clock, labelled). Read #3 approved and run; G2c done. Migrations go out with the
release, in the same window.

- **10.1 Official-appearance rule — DECIDED** (TJ, 2026-11-23: "Yes, box score lifts", with conditions given in the lane
  session). An official NHL box-score appearance after an OUT report ends the out overlay and restores the stored
  if-playing forecast as a new overlay revision citing the box score. Conditions: actual participation (time on ice
  > 0); it must follow the OUT and never overrides a newer credible OUT; it lifts from FORGE's first observation; earlier
  editions preserved; later participation labelled assumed. A practice report or projected line alone never lifts.
  Rule only: scheduling or enabling the material cron is a separate approval. Built in `3260cc022`; the exact
  sequence (OUT → box score → lifted revision, same stored vintage; OUT → practice / projected → still out) is tested
  in `h10NewsRoute.test.ts`.

Still to approve:

1. **Official roster reads from the hosted route** (new outbound HTTP to `api-web.nhle.com`, bounded per §5).
2. **Release window:** the four migrations in order (§2) with readback, then the candidate.
3. **Named later:** the Vault secret `forge_h10_dispatch_secret` and the same `FORGE_H10_DISPATCH_SECRET` in Vercel; the
   env vars; the nightly job, a watched first night; then the material job.
4. **Each monthly archive** (upload, verify, detach, drop).
5. **Open, not needed for H10:** the extra 07:45Z `update-players` run; G2b; the duplicate `UTA` row in `teams`; author
   provenance on the 28% of accepted cards that have none (Codex lanes).

## 11. After release (2026-11-24): uncertainty, first-night verifier, completion rule (local candidates, not released)

H10 went to production on master `7db94da1d` (Chef, TJ's per-step pop-ups). Everything below is a **local candidate**.
Each item needs TJ's separate approval to release. None is a migration applied, a deploy, a cron change or a route run.

- **First-night verifier.** `first-night-verify.sql` (`f3695ee76`): read-only and key-by-key. TJ: a night is judged only by this check, never by the route's marker. Unchanged since.
- **Uncertainty.** 50% and 90% predictive bands per issued key (`93ee303b2` … `f6bd031ca`; receipt `INTERVALS.md`).
  - Additive migration `20261124000000`, not applied.
  - Bands are conditional (if appearing / if starting) and not summable.
  - Goalie band policy v1 (TJ), with a predeclared revisit threshold.
  - Same-cutoff parity: 8,040 of 8,040 forecasts byte-identical with and without bands.
  - Worst call 200.3 s against 200.8 s without bands.
- **Completion rule** (`3853901512`, `08a4c0efa`, and the goalie accounting commit after them). Deployed `829258397` can mark a night "complete" with skater jobs failed or expired, or goalie keys not issued. The candidate marks a night complete **only if every frozen key was issued**. Otherwise it writes `forge-h10-nightly-incomplete:<date>` with a `shortfall` by cause:
  - `skaterJobsFailed`, `skaterJobsExpired`, `skaterGaps`;
  - `goalieGaps`, including `publish_failed:*` after retries and `issuance_lock_closed`;
  - `goalieKeysUnaccounted`: expected goalie keys neither published nor declared.
- **Ambiguous publication** (TJ, before release approval): the receipt write commits, then the response is lost. Regression test `h10 nightly after a lost publication response`, in `h10Route.test.ts`, on disposable Postgres. It passed on `e6c947ab5` with **no production change**:
  - Skaters retry through the queue on a later tick. Attempt 2 finds the stored draft, and its receipt predates the attempt, so it is acknowledged as a recovered publication (`pipeline.server.ts:378`, `refresh.ts:348–350`).
  - Goalies retry in the call on the same vintage.
  - Per affected key: one vintage, one receipt, the original id and output hash. Overall: one vintage, one receipt and one issuance sequence per key (1,380 skater, 120 goalie). The night is `complete` with 1,380 published and no failed job or gap.
- **Retries.** Bounded, same-draft (never a second edition): skaters get 3 attempts at least 60 s apart; goalies get 3 in-call attempts, 1 s and then 4 s apart. Regression tests are in `h10Route.test.ts`.
