# PRD: Yahoo Fantasy -> Supabase Ingestion & Mapping Audit ("Yahoo Pipeline")

Version: 2025-08-27
Author: Automated Audit (GitHub Copilot)
Scope: Comprehensive lighthouse pass across Yahoo-related ingestion, transformation, persistence, and mapping utilities.
Audience: AI assistant / future automation agents (structured for machine reasoning + human review).

---
## 1. Executive Summary
The Yahoo Pipeline ingests Yahoo Fantasy NHL game metadata, player keys, player detail (draft analysis + ownership), matchup weeks, uniform numbers, and attempts to map Yahoo players to internal NHL projection player entities. Current implementation consists of a mixture of:
- Python batch scripts (using `yfpy` + Supabase Python client) executed manually / ad hoc.
- Next.js API routes (using `yahoo-fantasy` npm library) for on-demand or scheduled (cron via Vercel) ingestion.
- A partially implemented fuzzy mapping script for NHL <-> Yahoo players.

Key gaps relative to stated goals:
1. Game IDs fetched & persisted (partially complete via `yahooAPIgameIds.py`, but no consolidation with weeks API route; duplication risk). 
2. Player names & IDs fetched (done via `yahooApiPlayerKeys.py` + TS route referencing `yahoo_player_keys`; need consolidation & dedupe). 
3. Draft analysis & ownership currently overwrite rows; required: time-series append of ownership (and optionally draft metrics snapshots) — design needed (history table or JSON array with proper retention + index). 
4. Player mapping exists (`populate_yahoo_nhl_mapping.py`) but lacks: deterministic pre-normalization, manual review queue, conflict resolution, confidence tracking beyond fuzzy ratio, incremental updates, and monitoring of unmatched set.

Additional risks: inconsistent environment paths, duplicated logic for credentials, blocking sequential loops causing potential rate limit collisions, missing retry/backoff strategy, silent fallbacks, missing schema evolution plan for history features, and inconsistent naming across Python vs TS ingestion layers.

---
## 2. Core Goals (From User) With Current & Target State
| Goal | Current State | Target (Proposed) | Gap Severity |
|------|---------------|-------------------|--------------|
| 1) Fetch & upsert all game IDs | `yahooAPIgameIds.py` fetches game records + weeks (second pass) into `yahoo_game_keys`. API route `update-yahoo-weeks.ts` separately loads weeks by `game_key`. | Single unified ingestion (script or scheduled API) capturing: game meta, weeks, and delta detection; idempotent updates. | Medium |
| 2) Fetch & upsert all player names | Python script (`yahooApiPlayerKeys.py`) + TS route consumes `yahoo_player_keys`. Redundant pathways. | One authoritative fetch job producing deterministic `yahoo_player_keys` plus incremental diff log. | Low-Medium |
| 3) Append (not replace) draft analysis & ownership snapshots | Current overwrite: `yahoo_players` table columns `average_draft_pick`, etc. Ownership history not persisted (only current). | Introduce `yahoo_player_ownership_history` + (optional) `yahoo_player_draft_analysis_history` with (player_key, snapshot_date, source_version, metrics...). Maintain latest in base table via trigger or view. | High |
| 4) Comprehensive Yahoo↔NHL mapping with unmatched tracking | Script builds fuzzy mapping into `yahoo_nhl_player_map_mat`; lacks manual review loop & unmatched persistence. | Add two tables: `yahoo_nhl_player_map` (authoritative), `yahoo_nhl_player_map_unmatched` (queue). Add review_status & confidence thresholds; deterministic normalization functions shared in TS + Python. | High |

---
## 3. Inventory of Yahoo-Related Files (Audited)
### Python Batch Scripts
| File | Purpose | Key Functions | Outputs (Supabase Tables) | Issues |
|------|---------|---------------|---------------------------|--------|
| `yahooAPIgameIds.py` | Fetch all Yahoo game metadata + weeks | `build_rows_from_games`, `update_game_weeks`, `main` | `yahoo_game_keys` | No retry logic; redundant with TS weeks route; two-step upsert; no delta detection; no schedule integration. |
| `yahooApiPlayerKeys.py` | Bulk fetch league player keys & names | `fetch_all_player_keys`, `upsert_player_keys` | `yahoo_player_keys` | Hard-coded league/game IDs; blocking loop; no diff logging; risk of stale keys if players removed. |
| `yahooAPI.py` | Fetch player details (draft analysis, ownership) using custom subclass | `get_player_keys_from_supabase`, `build_rows_from_batch`, `main`, subclass `get_multiple_players` | `yahoo_players` | Debug-only single-key fetch; no batching aggregator beyond sequential single fetch; overwrites time-series fields; mixes transformation & transport. |
| `populate_yahoo_nhl_mapping.py` | Build Yahoo↔NHL fuzzy name links | `get_nhl_players`, `get_yahoo_players`, `match_players`, `upsert_mappings` | `yahoo_nhl_player_map_mat` | No unmatched persistence; no incremental mode; fuzzy threshold static; team/position not used for disambiguation; no manual review integration. |
| `yahooUniformNumbers.py` | Supplement uniform numbers | `fetch_and_upsert_uniform_numbers` | `yahoo_players` | Hard-coded Windows path; separate ingestion path duplicating fields; could merge into primary player ingestion. |

### Next.js API Routes (TypeScript)
| File | Purpose | Key Elements | Tables / RPC | Issues |
|------|---------|-------------|--------------|--------|
| `update-yahoo-weeks.ts` | On-demand weeks ingestion | Fetch weeks from `yf.game.game_weeks` | `yahoo_matchup_weeks` | Overlaps with `yahooAPIgameIds.py`; no caching or incremental detection. |
| `update-yahoo-players.ts` | Batched player detail ingestion via RPC | `prepareRpcPayload`, batching 25 → RPC `upsert_players_batch` | RPC writes to `yahoo_players` (and maybe ownership history, assumed) | Ownership history design incomplete; RPC name changed but not versioned; error handling partly robust but no per-player fallback. |
| `manual-refresh-yahoo-token.ts` | Manual token refresh trigger | Fetch credentials & triggers trivial call | `yahoo_api_credentials` | Exposes potentially large response (`games`); no admin auth gate; not rate-limited. |

### Config / Standardization
| File | Purpose | Notes |
|------|---------|-------|
| `yahooConfig.ts` | Constants for draft analysis key mapping & schema keys | Used in UI (projections page) for column mapping. |
| `nameStandardization.ts` | Canonical player name normalization map | Skater-focused; contains accent handling & variant collapse; not integrated with Yahoo mapping script yet (Python side duplicates logic ad hoc). |

### Other Referencing Files (from grep)
- Projections UI (`pages/projections/index.tsx`) uses `YAHOO_DRAFT_ANALYSIS_KEYS` to surface `yahooAvgPick`, `yahooAvgRound`, `yahooPctDrafted` — expects base table fields (not historical).
- `trueGoalieValue.tsx` & shifts APIs reference matchup weeks for date ranges.
- Shift-related ingestion scripts use `yahoo_positions` (not reviewed here but dependent on consistent player identity mapping);
- Pages referencing `yahoo_nhl_player_map` (note naming difference vs `_mat` table in script).

---
## 4. Data Model (Current vs Proposed)
### Current Main Tables (inferred)
- `yahoo_api_credentials(id, consumer_key, consumer_secret, access_token, refresh_token, updated_at, ...)`
- `yahoo_game_keys(game_id PK?, game_key NOT NULL, ..., game_weeks JSONB)`
- `yahoo_matchup_weeks(game_key, season, week, start_date, end_date, ...)` (potentially redundant with `game_weeks` JSON)
- `yahoo_player_keys(player_key PK, player_id, player_name, last_updated)`
- `yahoo_players(player_key PK, player_id, full_name, draft_analysis JSONB, average_draft_pick, average_draft_round, percent_drafted, percent_ownership, status_full, eligible_positions[], last_updated, uniform_number, etc.)`
- `yahoo_nhl_player_map_mat(...)` (materialized-like mapping produced by script; naming suggests a materialized view but is an upsert target)

### Proposed Additions / Changes
1. Split operational & historical data:
   - New: `yahoo_player_ownership_history(player_key, captured_at timestamptz, ownership_pct numeric(5,2), source varchar, raw JSONB, PRIMARY KEY (player_key, captured_at))`.
   - New (optional): `yahoo_player_draft_analysis_history(player_key, captured_at timestamptz, average_pick numeric, average_round numeric, average_cost numeric, percent_drafted numeric, source varchar, raw JSONB, PRIMARY KEY(player_key, captured_at))`.
   - Maintain latest snapshot in `yahoo_players` via: (a) ingestion writing both history + latest OR (b) DB trigger updating `yahoo_players` on insert into history.
2. Mapping tables:
   - `yahoo_nhl_player_map(player_key, yahoo_player_id, nhl_player_id, nhl_player_name, yahoo_player_name, normalized_key, match_confidence numeric, match_method enum('exact','fuzzy','manual'), review_status enum('auto','needs_review','approved','rejected'), last_updated timestamptz, PRIMARY KEY(player_key))`.
   - `yahoo_nhl_player_map_unmatched(id bigserial, nhl_player_id, nhl_player_name, nhl_normalized, candidate_yahoo_keys JSONB[], attempts int default 0, created_at, last_attempt_at)`.
3. Normalization utilities unified across ecosystems; export canonical rules (remove divergent ad hoc regex from Python; centralize in a small spec JSON consumed by both runtimes).
4. Reduce redundancy: either drop `yahoo_matchup_weeks` or stop embedding weeks JSON inside `yahoo_game_keys` — prefer normalized table + derived view.
5. Indexing: add composite indexes on history tables `(captured_at DESC)` partial for recent windows; `(player_key, captured_at DESC)` for timeseries queries.

---
## 5. Functional Relationships & Flow
Ordered ingestion pipeline (proposed canonical sequence):
1. Credentials refresh (automatic prior to any other step if token expiring within threshold).
2. Game metadata & weeks: fetch game list → upsert `yahoo_game_keys`; fetch weeks per game → upsert `yahoo_matchup_weeks`.
3. Player keys baseline: fetch league players → upsert `yahoo_player_keys`; mark removed keys (soft delete flag) if absent in new pull.
4. Player details (batch): fetch players (keys in slices) → transform → upsert `yahoo_players` (latest) + append to history tables.
5. Uniform numbers: integrated in step 4; remove separate script.
6. Mapping generation:
   - Build normalized dictionaries using canonical name map.
   - Perform deterministic matches (exact normalized, then accent-insensitive, then alias map) before fuzzy.
   - Record unmatched & partial matches to unmatched queue.
   - Provide admin UI / API to resolve and approve matches; promote to main map.
7. Downstream UI queries join `yahoo_players` (latest) + mapping + projections.

Flow dependencies:
- `update-yahoo-players.ts` depends on `yahoo_player_keys` having been populated.
- Mapping depends on both `yahoo_players` (for Yahoo names) and projections tables (for NHL names).
- UI depends on stable column naming (`average_draft_pick` etc.) — must preserve or maintain view compatibility if schema evolves.

---
## 6. File-by-File Detailed Audit & Recommendations
### 6.1 `yahooAPIgameIds.py`
Issues:
- Duplicates portion of functionality in `update-yahoo-weeks.ts`.
- Two-phase update (insert then update weeks) — acceptable but can be folded into single transactional sequence.
- No retry/backoff; failures partially update data.
- Embeds weeks JSON + separate table leads to duplication.
Recommendations (Priority: P1):
- Remove weeks JSON embedding OR drop separate `yahoo_matchup_weeks` (choose one canonical).
- Introduce idempotent upsert with hash of weeks array for change detection (skip unchanged).
- Convert to shared library callable by both Python CLI and TS function (consider consolidating on TS for homogeneity unless Python-specific libs required).

### 6.2 `yahooApiPlayerKeys.py`
Issues:
- Hard-coded IDs; no env-based override fallback sequence.
- Large batch size 2000; verify API limits; missing pagination safety for >2000 counts.
- No handling of deletions; removed players remain indefinitely.
Recommendations (P2):
- Add soft delete: maintain `is_active` boolean; mark absent keys after refresh.
- Parameterize league/game IDs via env or CLI args.
- Add resilience (retry 429 with exponential backoff).

### 6.3 `yahooAPI.py`
Issues:
- Debug code restricts multi-key fetch to single key, harming performance.
- Ownership & draft analysis overwritten; no history.
- Mixed responsibilities (fetch, transform, aggregate, persist) in one file.
- Sleep constant; no dynamic rate control.
Recommendations (P0):
- Reinstate multi-key batching (size tuned to API limits, maybe 25–50 similar to TS route).
- Remove direct upsert logic; emit normalized rows to queue (e.g., Kafka-like substitute: Supabase function or batched RPC) for uniform persistence.
- Add history append (see Section 7 design).
- Remove print debug; use structured logging with correlation IDs.

### 6.4 `populate_yahoo_nhl_mapping.py`
Issues:
- Fuzzy match only with ratio & high threshold; lacks layered deterministic pass.
- No unmatched persistence or manual workflow.
- Potential performance issue building large dicts & scanning sequentially (fine for current scale; monitor >10k).
Recommendations (P0):
- Introduce normalization pipeline: strip punctuation, unify diacritics, alias resolution (use `nameStandardization.ts` map exported to JSON for Python consumption).
- Add multiple scoring strategies: exact, token set ratio, position/team assisted confidence bump.
- Persist unmatched rows + store reasons.
- Provide mode flags: `--incremental` (only new or changed), `--recompute-all`.

### 6.5 `yahooUniformNumbers.py`
Issues:
- Windows path; inconsistent with Mac path usage elsewhere.
- Separate ingestion causing potential stale uniform numbers.
Recommendation (P3):
- Deprecate standalone script; merge uniform number extraction into main player detail ingestion path.

### 6.6 `update-yahoo-weeks.ts`
Issues:
- Overlaps w/ Python game weeks logic.
- Only supports single `game_key` query; lacks iteration over all relevant games (multi-season scenarios).
- No cache or last-modified detection.
Recommendations (P2):
- Accept `?all=true` to iterate over stored `yahoo_game_keys`.
- Idempotent skip if row exists & unchanged (compare start/end dates).

### 6.7 `update-yahoo-players.ts`
Strengths:
- Batching & token refresh fallback.
- Uses RPC for bulk operations.
Issues:
- Ownership history not yet appended (payload includes current date but RPC must implement append logic; confirm DB function body).
- Assumes subresource array structure indexes (`percent_owned?.[1]?.value`) — brittle.
- Error handling lumps all players per batch; no partial salvage.
Recommendations (P0):
- Enhance RPC to: (a) upsert latest snapshot; (b) insert into history table using `current_date` + ownership metrics inside a transaction.
- Fallback if percent_owned structure changes: search array for `value` property or handle object format.
- Add per-player error catch to continue within batch.

### 6.8 `manual-refresh-yahoo-token.ts`
Issues:
- No auth/role guard; potential misuse.
- Returns entire games payload (unnecessary for confirmation).
Recommendation (P1):
- Restrict via secret header / admin session; return minimal JSON (`{ refreshed: true, at: timestamp }`).

### 6.9 `yahooConfig.ts`
Issues:
- Currently static; future complexity: preseason vs in-season divergence or multi-source overlays.
Recommendation (P3):
- Add versioning key (e.g., `SCHEMA_VERSION = 1`) to aid migration logic.

### 6.10 `nameStandardization.ts`
Issues:
- Large static map without programmatic generation; lacks goalie coverage & persistent update strategy.
- Not used by Python scripts (duplication risk).
Recommendations (P1):
- Convert to canonical JSON artifact generated from DB + curated overrides; share across Python & TS.
- Add function `normalizeName(raw: string) -> { canonicalKey, matchedFullName? }` for reuse.

---
## 7. Draft Analysis & Ownership History Design (Goal 3)
### Requirements
- Preserve historical trajectory of ownership and draft metrics for trend charts & anomaly detection.
- Avoid unbounded table bloat; implement retention or aggregation if needed.
- Atomic write of latest snapshot + historical append.

### Proposed Schema
```
Table: yahoo_player_ownership_history
Columns:
  player_key text not null
  captured_at timestamptz not null default now()
  ownership_pct numeric(5,2) not null
  percent_drafted numeric(5,2) null
  average_draft_pick numeric(6,2) null
  average_draft_round numeric(4,2) null
  average_draft_cost numeric(8,2) null
  raw JSONB not null
  source varchar(32) default 'yahoo'
Primary Key (player_key, captured_at)
Index ix_yahoo_player_ownership_history_player_time on (player_key, captured_at desc)
Partial Index (captured_at >= now() - interval '90 days') for recent queries
```
Optionally split draft & ownership — combined table acceptable if write volume manageable (< few thousand per day).

### Ingestion Algorithm (Pseudo)
```
for batch in playerBatches:
  begin transaction
    upsert into yahoo_players (player_key, full_name, ..., percent_drafted, average_draft_pick, ...) returning player_key
    insert into yahoo_player_ownership_history (...)  -- no upsert; always append
  commit
```
Add constraint to prevent duplicate snapshot within same hour (optional) via unique partial index on `(player_key, date_trunc('hour', captured_at))` if needed.

### UI Compatibility
- Create a view `yahoo_players_with_latest` selecting latest row from history (if desired) to decouple schema changes from frontend.

---
## 8. Player Mapping Strategy (Goal 4)
### Matching Phases
1. Deterministic Exact: normalized forms equal (strip punctuation, lowercase, collapse diacritics, remove suffixes, map known aliases).
2. Deterministic with Team/Position Assist: if multiple same normalized name, disambiguate using active team abbreviation + position cluster.
3. Fuzzy Candidate Generation: token_set_ratio >= threshold (e.g., 90) OR ratio >= 85 with same first 4 letters.
4. Scoring Adjustment: +5 if same team, +3 if same primary position, -10 if position mismatch (F vs G).
5. Manual Review Queue: results with confidence in [60, 89] or conflicting multi-matches.

### Storage Enhancements
- `match_method` & `manual_notes` columns.
- `superseded_by` for cases where mapping corrected later (lineage).
- Add `effective_from` timestamp for temporal audits.

### Unmatched Workflow
- Insert unmatched NHL players into unmatched table with JSON suggestions: `[ { yahoo_player_key, yahoo_name, confidence } ]`.
- Admin resolves: sets final mapping, rows removed from unmatched, inserted into main map.

### Reconciliation Schedule
- Run daily incremental pass picking up new players (rookies, call-ups) by comparing `yahoo_players` & projections roster delta.

---
## 9. Credential & Token Management
Current: multiple scripts reading `.env.local`; TS routes use service role key directly — risk exposure.
Proposed:
- Central credential service module (TS) + Python `.json` credential artifact with restricted scope.
- Avoid distributing service role key to frontend accessible routes; ensure API routes validate internal secret header or RLS policies.
- Add proactive token refresh (if `updated_at + expires_in - buffer < now()` then refresh before batch loops).

---
## 10. Error Handling & Observability
Recommended structured log fields:
- `component`: (game_ingest|player_detail|mapping|ownership_history)
- `batch_id` (UUID per run)
- `player_key` (when applicable)
- `attempt` (retry count)
Add metrics counters (if using external collector) or summary table `ingestion_runs` storing run metadata (start, end, counts, failures).

Retry Strategy Template:
```
retryWithBackoff(fn, { retries: 5, baseMs: 500, jitter: true, retryOn: [429, 500, 502, 503] })
```

---
## 11. Prioritized Action Plan
Priority Legend: P0 = Critical (immediate), P1 = High, P2 = Medium, P3 = Low.

P0:
- Implement history table(s) + modify RPC / scripts to append.
- Refactor mapping script to store unmatched + deterministic normalization.
- Reinstate efficient multi-key fetch in player detail ingestion (remove debug single-key limitation).

P1:
- Consolidate game weeks ingestion (remove duplication) & pick canonical structure.
- Export normalization spec (shared JSON) for cross-language reuse.
- Secure token refresh endpoint.

P2:
- Soft delete handling in player keys table.
- Add diff detection / hash for weeks & game metadata.
- Introduce ingestion_runs auditing table.

P3:
- Deprecate standalone uniform number script.
- Add schema version tagging to config constants.
- Optimize indexes & add retention policy (e.g., prune ownership history > 18 months or aggregate monthly).

---
## 12. Suggested Supabase Schema DDL (Illustrative)
```sql
-- Ownership & Draft History
create table if not exists yahoo_player_ownership_history (
  player_key text not null references yahoo_players(player_key) on delete cascade,
  captured_at timestamptz not null default now(),
  ownership_pct numeric(5,2) not null,
  percent_drafted numeric(5,2),
  average_draft_pick numeric(6,2),
  average_draft_round numeric(4,2),
  average_draft_cost numeric(8,2),
  raw jsonb not null,
  source text default 'yahoo',
  primary key (player_key, captured_at)
);
create index if not exists ix_yahoo_player_ownership_history_recent on yahoo_player_ownership_history (player_key, captured_at desc);

-- Mapping Table
create table if not exists yahoo_nhl_player_map (
  player_key text primary key,
  yahoo_player_id text,
  nhl_player_id text,
  nhl_player_name text,
  yahoo_player_name text,
  normalized_key text,
  match_confidence numeric(5,2),
  match_method text check (match_method in ('exact','alias','fuzzy','manual')),
  review_status text default 'auto' check (review_status in ('auto','needs_review','approved','rejected')),
  manual_notes text,
  last_updated timestamptz default now()
);
create index if not exists ix_yahoo_nhl_player_map_norm on yahoo_nhl_player_map(normalized_key);

-- Unmatched Queue
create table if not exists yahoo_nhl_player_map_unmatched (
  id bigserial primary key,
  nhl_player_id text,
  nhl_player_name text,
  nhl_normalized text,
  candidate_yahoo jsonb,
  attempts int default 0,
  created_at timestamptz default now(),
  last_attempt_at timestamptz
);
```

---
## 13. RPC / Function Contract (Updated `upsert_players_batch`)
Inputs: `players_data` JSONB[] each element includes: core columns + `current_ownership_value` + `current_date`.
Process:
1. For each payload row: upsert into `yahoo_players` (latest snapshot fields).
2. Insert into `yahoo_player_ownership_history` (no upsert) with `raw = to_jsonb(row)`.
3. Return summary counts `{ processed, inserted_history }`.
Error Modes:
- Reject batch if > N (e.g., 1000) to avoid memory bloat.
- On conflict DO UPDATE for base table only.

Pseudo-SQL body (sketch):
```sql
create or replace function upsert_players_batch(players_data jsonb)
returns jsonb language plpgsql as $$
declare
  rec jsonb;
  processed int := 0;
  history int := 0;
begin
  for rec in select * from jsonb_array_elements(players_data) loop
    processed := processed + 1;
    -- Upsert latest
    insert into yahoo_players (player_key, player_id, full_name, draft_analysis, average_draft_pick, average_draft_round, average_draft_cost, percent_drafted, editorial_team_abbreviation, display_position, eligible_positions, headshot_url, status_full, position_type, status, last_updated, uniform_number)
    values (
      rec->>'player_key', rec->>'player_id', rec->>'full_name', rec->'draft_analysis', (rec->>'average_draft_pick')::numeric, (rec->>'average_draft_round')::numeric, (rec->>'average_draft_cost')::numeric, (rec->>'percent_drafted')::numeric, rec->>'editorial_team_abbreviation', rec->>'display_position', coalesce((rec->'eligible_positions')::jsonb, '[]'::jsonb), rec->>'headshot_url', rec->>'status_full', rec->>'position_type', rec->>'status', now(), (rec->>'uniform_number')::int
    ) on conflict (player_key) do update set
      player_id = excluded.player_id,
      full_name = excluded.full_name,
      draft_analysis = excluded.draft_analysis,
      average_draft_pick = excluded.average_draft_pick,
      average_draft_round = excluded.average_draft_round,
      average_draft_cost = excluded.average_draft_cost,
      percent_drafted = excluded.percent_drafted,
      editorial_team_abbreviation = excluded.editorial_team_abbreviation,
      display_position = excluded.display_position,
      eligible_positions = excluded.eligible_positions,
      headshot_url = excluded.headshot_url,
      status_full = excluded.status_full,
      position_type = excluded.position_type,
      status = excluded.status,
      last_updated = now(),
      uniform_number = excluded.uniform_number;

    -- Ownership/Draft history
    insert into yahoo_player_ownership_history(
      player_key, ownership_pct, percent_drafted, average_draft_pick, average_draft_round, average_draft_cost, raw
    ) values (
      rec->>'player_key', (rec->>'current_ownership_value')::numeric, (rec->>'percent_drafted')::numeric,
      (rec->>'average_draft_pick')::numeric, (rec->>'average_draft_round')::numeric, (rec->>'average_draft_cost')::numeric, rec
    );
    history := history + 1;
  end loop;
  return jsonb_build_object('processed', processed, 'history_inserted', history);
end; $$;
```

---
## 14. Normalization Specification (Cross-Language)
Proposed JSON artifact `player_name_normalization_spec.json`:
```json
{
  "strip_suffixes": ["jr", "sr", "ii", "iii", "iv"],
  "replace_chars": {"é": "e", "ö": "o", "ü": "u", "ï": "i", "š": "s", "ć": "c", "č": "c", "ř": "r", "ĺ": "l", "í": "i", "á": "a", "ó": "o"},
  "punctuation": "[.'`-]",
  "alias_map": {"alexander ovechkin": "alex ovechkin", "jonathan marchand": "jonathan marchessault"}
}
```
Algorithm Outline (Language-Agnostic):
1. Lowercase.
2. Remove punctuation regex.
3. Replace diacritics (explicit mapping fallback to unicode normalize).
4. Collapse multiple spaces.
5. Apply alias_map if present.
6. Remove suffix tokens (end-of-string match).
7. Return canonical key.

---
## 15. Security & Access Control
- Ensure API routes requiring service role key are server-side only; add internal auth header (e.g., `X-Internal-Token`).
- Restrict manual token refresh endpoint.
- Consider RLS policies for history tables (read-only public; write only via service role / RPC).

---
## 16. Testing Strategy
### Unit
- Normalization function test vectors (diacritics, suffixes, aliases, punctuation removal).
- Mapping scorer: ensure deterministic > fuzzy rank ordering.
### Integration
- Mock Yahoo API (fixture JSON) to test end-to-end ingestion without rate limits.
- RPC contract: send sample batch; assert base + history rows.
### Regression
- Snapshot of column presence for UI-dependent views.

---
## 17. Observability & KPIs
Metrics to Track:
- `players_ingested_count` per run.
- `ownership_history_rows_added`.
- `mapping_auto_match_rate` (% matched automatically).
- `mapping_unmatched_count` trend.
- `avg_fetch_latency_ms` per Yahoo API endpoint.
Alert Threshold Examples:
- Ownership history insertion fails >3 consecutive runs.
- Unmatched count increases > 10% week-over-week.

---
## 18. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Token expiry mid-batch | Partial ingestion | Pre-flight refresh + retry wrapper |
| Schema drift breaking UI | Broken projections view | Introduce compatibility view + version gating |
| Fuzzy false positives | Incorrect player mapping | Confidence threshold + manual review queue |
| Table bloat (history) | Storage / query slowdown | Partitioning or retention policy (>18m prune) |
| Rate limits | Failed batches | Dynamic backoff & concurrency cap |

---
## 19. Implementation Phasing (Suggested Sprints)
Sprint 1 (P0): history tables, updated RPC, normalize spec JSON, mapping script revision (deterministic + unmatched queue), multi-key fetch reinstated.
Sprint 2 (P1/P2): consolidate weeks ingestion, soft delete player keys, secure endpoints, ingestion_runs audit table.
Sprint 3 (P2/P3): uniform number integration, retention jobs, UI enhancements for mapping resolution.

---
## 20. Open Questions
- Exact expected frequency for ownership snapshots? (Hourly vs Daily vs On-demand)
- Need goalie vs skater positional weighting in mapping confidence?
- Size of expected player universe (including minors / IR) for scaling ingestion tactics?
- Whether playoff game keys/weeks needed beyond regular season scope.

---
## 21. Quick Reference (Critical Improvements Summary)
- ADD: History tables + RPC logic (PREVENT data loss of time series).
- FIX: Mapping robustness & unmatched workflow.
- MERGE: Uniform numbers into main ingestion.
- NORMALIZE: Shared name spec across Python & TS.
- CONSOLIDATE: Weeks ingestion; single authoritative pipeline.

---
## 22. Completion Criteria
This PRD considered complete when:
- All files enumerated with roles & improvement recommendations.
- Explicit proposed schemas & RPC contract defined.
- Prioritized action plan documented.
- Normalization spec + mapping workflow design present.

End of PRD.
