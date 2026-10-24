# C7 design review — LEAGUE-CONFIG-ANALYTICS

**Reviewer:** Claude C7 lane session (independent; not the design author, LEAGUE-DESIGN `01a168f5…`). This was read-only:
- no collection, export, migration, query of real league data, or implementation;
- no server, no source edits, no Git;
- no duplicate design written.

## Artifact reviewed

- **The existing completed proposal:** `/Users/tim/Documents/Codex/2026-10-23/task-10/league-settings-analytics-design.md`. Its SHA-256 `67e0234d9080c5eac0e224d2f370047a8b8d42b68a46063f5396c13e0315eff7` **matches** the master pin (MASTER-TASKLIST-2026-10-20 line ~2759, "Existing-settings inventory and design proposal complete"). It is 322 lines and includes the source inventory, the contract, dedup/bias, consent/retention, RLS/API and a planned test matrix.
- **Source pins:** all **24/24** of the proposal's source pins still match the current working tree, so there is no drift since 2026-10-23.

## Verdict: **READY WITH CHANGES**

The design is careful and largely correct. It is ready for TJ/Codex decision review once the changes below are made. It is **not** ready for implementation until the owner decisions listed at the end are taken.

## Spot-verified claims (against code at the pinned bytes)

| Claim | Check | Result |
| --- | --- | --- |
| `external_leagues` has scoring/roster/metadata/season_key/imported_at, and its uniqueness is per connected account | baseline SQL `:8117-8128`; unique index `(connected_account_id, external_league_key)` at `:34144` | True. Several co-members create several rows, so row ID is not a global league identity. |
| `user_settings` DB defaults include 12 teams and snake; `team_count` is limited to 2–40 | `20260814192101_fantrax_settings_first.sql` | True (`not null default 12`, `default 'snake'`, check 2–40). Legacy "12" can't be told apart from a confirmed 12. |
| The Yahoo adapter collapses formats | `yahoo/liveDraft.ts:450-459` uses substring `includes("point")`, `"head"` or `"roto"` | True. Each-category vs most-categories is lost, so the exact `scoring_type` must be captured separately (the design says so). |
| Fantrax unknown formats fall back to points | `fantrax/normalize.ts:341-345` returns `null`; `:828` uses `scoring.type ?? "points"` | True. |
| ESPN direction is a sign relative to the app's own inversion | `espn/normalize.ts:271-273` (`reversed === appAlreadyInverts ? 1 : -1`) | True. Direction must come from the original `isReverseItem` (the design says so). |

## Assessment by requested dimension

| Dimension | Assessment |
| --- | --- |
| **Minimal fields and reuse** | Reuse is excellent: `user_settings`, `external_leagues`, provider normalizers and dictionaries, RSO rule vocabulary, saved teams as read-only references; no provider mirror. **But the field set is not minimal** for the stated purpose ("inform defaults, audit category coverage"). See LC-1. |
| **Raw / custom / canonical mapping** | Strong. `source_rule_key` keeps separate rules separate; `provider_stat_code`/label, a nullable `canonical_stat_key` from the existing dictionary (no new alias registry), `mapping_status` and staged support. Custom labels are restricted triage only. |
| **Format distinction** | Strong. Three axes (`scoring_family`, `competition`, `category_result`) plus a raw `provider_format_code`; unknown never defaults to points; nothing is broadened in the operational enum. **Fixture coverage is partial** (LC-3). |
| **Zero / null** | Excellent. Zero, null, absent, empty and non-finite are distinct; `value_state` per numeric field; "no `Number(null)`"; a weight of 1 only as a tagged provider convention. Legacy NOT-NULL defaults are handled via `legacy_unverified` plus reconfirmation. |
| **Units** | Good. Unit vocabulary, `ratio` numerator/denominator/scale (the GAA × 3600 example), fraction vs percent, rule kind vs measurement kind, and no averaging of incompatible scales. |
| **Temporal provenance** | Good. `observed_at` vs `received_at` vs evidence-only `effective_*`; independent schema/mapping/normalization/capability versions; immutable sequence/supersedes; a remap is not a new observation; 90-day preset freshness; season never inferred from today. |
| **Multi-league dedup** | Technically sound: the unit is one league-season at a cutoff; a server-only HMAC over (provider, sport, season, provider league identity); verified sources outrank self-reports; no merging by name or similarity. **The linkage it creates is a privacy decision** (LC-5). |
| **Sampling bias** | Acknowledged well: self-selection, provider/manual mix, feedback from presets, no claim of representing all leagues. One gap (LC-4). |
| **Free/paid independence** | Strong. Same eligibility, choice and deletion rights for every tier; a manual path needs no sync or paid save; no checkout, billing lookup or grant; billing fields excluded from the contract. |

## Concrete findings (for LEAGUE-DESIGN / the parent)

**LC-1 (medium): narrow v1 to the fields the purpose needs.**
- For "defaults + category coverage", v1 needs:
  - the format axes;
  - scoring entries;
  - roster slots;
  - `team_count`, season and provider;
  - provenance and versions.
- The following go well beyond that and widen the privacy surface, validation and test burden: acquisitions/waivers/FAAB, goalie minimums, game caps, season rules (playoffs, matchup length, keeper count), draft type, league continuity and lineup lock timing.
- Recommendation: mark them **v2, deferred**, unless TJ wants defaults for those rules (a decision below).

**LC-2 (medium): the publication thresholds versus FHFH's scale.**
- The thresholds are: cells need ≥20 verified league-seasons **and** ≥10 contributors, and presets need ≥50/20 per compatible cohort.
- Combined with fine cohort splitting (format × result rule × units × lineup × team-size band × rule signature), these may yield **no publishable presets for a long time**.
- That's a sound privacy posture. The consequence is that v1's real deliverable is the **internal category-coverage triage**, which has no threshold.
- Recommendation: say this explicitly and sequence that first. Whether to accept that outcome is a decision for TJ.

**LC-3 (medium, implementation gate): provider format fixtures are incomplete.**
- **In-repo today:**
  - ESPN `H2H_POINTS`, `TOTAL_SEASON_POINTS`, `H2H_MOST_CATEGORIES` (`espn/__fixtures__`);
  - Fantrax `POINTS_BASED`, `HEAD_TO_HEAD_POINTS_BASED`, `ROTISSERIE`, `HEAD_TO_HEAD_ROTI_SINGLE/MULTI_WIN` (tests);
  - Yahoo only as test strings `head`, `roto`, `headpoint`.
- **Missing:** ESPN `H2H_CATEGORY`/`ROTO`; Yahoo `point`/`headone` and any real Yahoo settings payload.
- The proposed Yahoo mapping is labelled "intended", which is correct.
- **Needed:** obtaining real fixtures may need a provider read (owner approval). Until then, those codes stay `unknown` / coverage-only.

**LC-4 (low): state the sample composition's dependence on capability.**
- Participation is tier-independent, but verified provider observations come only from accounts that use provider import/sync.
- If those capabilities skew toward paid or engaged users, the *sample* is not tier-independent even though *eligibility* is.
- The design rightly refuses to collect paid status. Reports should therefore carry the source mix (provider-verified vs manual) as the visible proxy, with an explicit caveat.

**LC-5 (decision): cross-owner linkage from the HMAC key.**
- A per-league-season key shared across owners lets the server and maintainers link which accounts are in the same league. That is a social-graph signal, even pseudonymously.
- The design never returns keys or membership to users, but the stored linkage itself exists.
- **TJ/Codex must accept or reject it.** The alternative is weaker dedup (count per contributor, accept double counting, label it).

**LC-6 (low, process): the design lives outside the repository.**
- The proposal and its diary are only in `/Users/tim/Documents/Codex/2026-10-23/task-10/`, and the master pins them by absolute path.
- Recommendation: the release/ledger owner (Codex) copies the pinned bytes into `tasks/` (e.g. a `league-config-analytics` design folder) for durability. This is Codex's decision; C7 copied nothing.

**LC-7 (low): v1 needs a smaller acceptance matrix.**
- The 18-row future test matrix is appropriate for the full design. After LC-1 scoping, prune it to the v1 fields, so the first implementation lease is bounded.
- These are planned tests and haven't been executed (as the design states).

## Owner decisions required (TJ / Codex). C7 makes none of these

1. **Whether to collect at all,** and the **opt-in model**: off by default, all signed-up users invited, no silent enrolment (as recommended).
2. **Consent notice text and versioning,** plus completing the incomplete sitewide privacy notice. Includes a **provider secondary-use terms review** (Yahoo/ESPN/Fantrax) and the jurisdiction or legal review. The design explicitly makes no compliance determination.
3. **Retention targets:**
   - custom labels 90 d;
   - pseudonymous observations ≤ 13 months;
   - aggregates ≤ 24 months;
   - backups 35 d, which must be verified against the actual infrastructure;
   - deletion purge ≤ 30 d.
4. **New storage:** the two proposed relations `league_research_preferences` and `league_settings_observations`, plus whether they go in an unexposed research schema, along with the grants/RLS and a migration admission path. These are a **new table** and a **migration**, both owner-gated.
5. **Cross-owner league linkage (HMAC dedup key),** key rotation and secret custody (LC-5).
6. **Aggregate thresholds and release cadence** (20/10 cells, 50/20 presets, banding by 5, monthly at most) and accepting that presets may not publish for a long time (LC-2).
7. **v1 field scope** (LC-1): which rule families beyond scoring, roster and format are in.
8. **Provider-disconnect behaviour:** purge that account's research rows.
9. **Who may see sanitized raw triage** (the maintainer set), and the audit requirement.
10. **Whether to obtain real provider format fixtures** (LC-3), which may need an approved provider read.

## Not done

No query of any real league data, no export, no migration, no schema or implementation work, no server. All checks are code reads at pinned bytes plus hash verification.
