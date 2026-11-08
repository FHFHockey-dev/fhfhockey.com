# BLSH independent assessment: stage 1, before reconciliation

- Author: Claude session, 2026-10-28. Read-only review; no source, database or lease changes.
- Written **before** reading the October 28 conversation synthesis, the BLSH PBP review ZIP, the BLSH PRD/research folders, or the recovered historical relationship script. The two Codex diary entries I read were for access rules (reserved seasons, lease scope); I did not use their modeling conclusions.
- Stage 2 (reconciliation) will be a separate file. This file stays as written, so the two stages can be compared.

## 1. What exists today

| Piece | Path | State |
|---|---|---|
| Frozen historical snapshot reader + validator | `web/lib/buyLowSellHigh/researchSnapshot.ts` (+ server, tests) | Untracked, Codex lease. Reads a 10 MB precomputed JSON for 2024-04-18. Fails closed on version, chronology, list sign and rank drift. |
| Snapshot data | `research-snapshots/2024-04-18.v1.json` | 924 profiles: 364 BL, 265 SH, 295 withheld. 63% of all profiles are in the "provisional/estimated" tier. Streak evidence present for only 4 profiles. |
| Preview UI | `web/components/buyLowSellHigh/*`, `web/pages/buy-low-sell-high/preview.tsx` | Separate BL / SH / withheld tabs, per-family evidence detail. Shows saved values; computes nothing. |
| Current-season input qualifier | `currentInput.ts` (+ 35 tests per owner) | Qualifies WGO + NST individual + NST on-ice captures per player-game, with reasons. `score: null`, `streak: null`. |
| **Scorer** | not in repo | The function that produced the snapshot's `actual / baseline / support / adjustment` vectors is outside the repository. Nothing in the repo can score current-season data. |

Snapshot contract worth keeping: three production tracks (FHFH Standard FP, G+A, WiGO Game Score); current window = the last 5 appearances; reference = up to 50 earlier personal games blended with a cohort (`personalWeight`/`cohortWeight` are reported); families = deployment (total/ES/PP TOI), individual chance creation (ixG, SOG, iCF, HDCF per appearance and per 60), finishing (provider xG − G, G/xG, G/SOG) and peripherals; `trusted: false`, `confidenceProbability: null`.

Gaps visible from code alone:
1. No in-repo, reproducible scorer, so the current season cannot be scored, and the formula cannot be reviewed or tested.
2. The score is a single value per track; there is no additive breakdown showing *how much* of the gap is shooting luck, on-ice/teammate luck, involvement (IPP) or a change in process.
3. Assist support is thin. Families cover individual shooting only. On-ice xGF/GF and personal involvement rate are not explained components, yet assists are about 60% of skater points.
4. A 5-game window is short. With a 7-day freshness proxy, 68% of profiles reach a list, which is too permissive for an "evidence" list.
5. Confidence is withheld (`null`) rather than reported separately as an exposure/coverage measure.

## 2. Data coverage (count-only reads, 2026-10-28; seasons 2022-23, 2023-24, 2026-27; 2025-26 not read)

| Source | 2022-23 | 2023-24 | 2026-27 (through 2026-10-27) |
|---|---|---|---|
| WGO skater-game rows | 47,206 | 47,223 | 7,127 (all GP = 1) |
| WGO `game_id` null | **47,206 (all)** | 2 | 0 |
| WGO ES / PP TOI null | 0 / 0 | 0 / 0 | 0 / 0 |
| NST ES counts rows | 46,418 | 46,786 | 6,479 |
| NST PP counts rows | 30,378 | 30,571 | 4,256 |
| NST all-strength rows | 46,418 | 46,786 | 6,658 |
| NHL PBP / shift games | 0 | 0 | 230 / 230 |
| In-house xG predictions / player-game aggregates | 0 | 0 | **0** |

The in-house xG tables exist only for 2025-26, which is reserved. PBP exists only for 2025-26 and 2026-27.

2026-27 join coverage (WGO GP = 1 rows joined to NST on player + date; NST has no game id):

| Check | Rows | Meaning |
|---|---|---|
| NST ES row present / absent | 6,479 / **648 (9.1%)** | Absent = **missing**, never zero. |
| NST ES `ixg` null where row present | 0 | — |
| PP TOI > 0 and NST PP row present | 4,218 | usable |
| PP TOI > 0 but **no** NST PP row | **431** | missing PP process: unknown, not zero |
| PP TOI = 0 and no NST PP row | 2,440 | genuine zero PP exposure: valid data |
| PP TOI = 0 but NST PP row exists | 38 | definitional mismatch: flag, exclude PP fields for that row |
| Zero-shot games | 1,941 (27%) | genuine zeros: keep |
| WGO total TOI missing/zero | 0 | — |

Owner-reported (Codex, not re-verified by me): 1,463 current rows have the six ES/PP/SH GF/GA fields null. These fields feed **only** the Game Score track.

## 3. Proposed approach: the shortest sound route

### 3.1 Principle
BLSH evidence = **actual production − production expected from the player's current support**, where "expected" uses the player's own (shrunk) conversion rates applied to the opportunity and process they **currently** have. Positive = buy-low evidence (producing below support). Negative = sell-high evidence. Opportunity changes move *expected*, not the gap, so losing PP1 does not look like bad luck.

### 3.2 Per-track decomposition (goals + assists; FP and Game Score layer on top)
For the current window W (all strengths; ES and PP computed separately when scope-matched coverage exists):

- **Expected goals** `EG = ixG_W × f_p`, where `f_p` = the player's shrunk finishing multiplier (personal G/ixG over the reference, credibility-weighted toward their position's 1.0-ish norm by reference ixG volume).
- **Expected assists** `EA = onIce_xGF_W × s_p × a_p`, where `s_p` = the player's shrunk on-ice finishing multiplier and `a_p` = their shrunk assists per on-ice goal (involvement).
- **Gap** = `(EG + EA) − (G + A)`, split additively into components:
  - personal finishing luck `EG − G` (scope-matched NST ixG vs NST goals; never WGO goals vs NST ixG);
  - on-ice/teammate finishing luck `(onIce_xGF_W × s_p − onIce_GF_W) × a_p`;
  - involvement luck `onIce_GF_W × a_p − A`.
- **Process change** (shown, not scored as luck): ixG/60, iSOG/60, iCF/60, on-ice xGF/60 versus the player's own reference, by strength. A real process collapse is the *opposite* of buy-low, so it is a separate signed chip.
- **Opportunity change** (shown, not scored): total, ES and PP TOI per game versus the reference.
- **FP track** = 3·goal gap + 2·assist gap + PPP gap (PP scope). SOG/HIT/BLK are observed process, so they carry no luck gap. **G+A track** = the gap above. **Game Score track** adds GF/GA on-ice terms and is computed only on rows where those six fields are present.
- **Evidence score** = gap ÷ its standard error (a Poisson/overdispersed SE from the expected counts), with the raw gap in points reported beside it. Ranking uses the evidence score; display shows both.

### 3.3 Eligibility, sparse data and unknowns
- Eligibility is by **exposure and coverage**, never by shot count. Current window: last N appearances, with a minimum total TOI and a minimum fraction of window games with a scope-matched process row. Reference: earlier games with a minimum TOI; below it, shrink toward the position cohort and report the personal/cohort weights.
- A low-shot player gets a small, wide-SE expected goals value, so their finishing component is small and their assist components still work. A zero-shot game is data (ixG = 0). A missing NST row is **missing**: it is excluded from both numerator and denominator of that component's window, and counted in coverage.
- PP components require PP TOI > 0 *and* an NST PP row. A row with PP TOI = 0 and no NST PP row contributes a genuine zero.
- If coverage falls below the floor for a component, that component is `unavailable` with a reason. If the core components are unavailable, the player goes to **Insufficient evidence**, with no score.

### 3.4 Outputs
- Separate Buy-low and Sell-high lists, each sorted by evidence score, plus an Insufficient/Balanced list.
- Per player: actual, expected and gap per track; the four components above in points; process-change and opportunity-change chips; **confidence** as its own field (window TOI, reference TOI, personal weight, SE); and **coverage by reason** as its own field (`nst_es_absent`, `nst_pp_absent_with_pp_toi`, `pp_definition_mismatch`, `gs_goal_fields_null`, `reference_below_floor`, `stale_reference`, and so on).
- Copy: "evidence of a production/support gap", never trade value.

### 3.5 Parameters and validation (no correlation-to-weight shortcuts)
- The decomposition is an accounting identity. The only fitted quantities are the credibility constants for `f_p`, `s_p`, `a_p`, the window length and the floors. Fit them on 2022-23/2023-24 by **forward predictive likelihood** of next-window G and A: rolling as-of, no future rows.
- **Retrospective score** (is the gap real?): check that the component sums reconcile exactly to actual − expected, then run coverage and sign audits and hand-check fixtures.
- **Predictive angle, evaluated separately:** does today's evidence score predict next-K-game production *relative to the player's reference* better than (a) the reference alone and (b) recent form alone? Measure strictly forward, on development seasons, then test **once** on the reserved 2025-26 season after freezing, if the owner releases it for that purpose.
- Streak research (from the brief): FP, raw points and Game Score baselines separately plus one documented combined assessment; hot and cold separately; entry, during and exit phases; all ten sustainability-survey metrics tested, keeping same-window associations apart from strictly forward tests, and survey rankings never used as weights. **I do not have the ten survey metrics in the repo context I read. They are needed from the synthesis.**

## 4. Limitations and real blockers, separated

| Issue | Scope | Blocks all work? |
|---|---|---|
| No in-repo scorer | whole feature | No. This is the first thing to build (pure function, fixtures). |
| In-house PBP xG absent for 2026-27 and dev seasons; present only in reserved 2025-26 | xG source choice | No. Use NST ixG per strength (scope-matched). Running the in-house model on 2026-27 is a production job that needs separate approval. |
| 2025-26 reserved | personal reference for current players (2023-24 is about 2.5 years stale; 2026-27 has about 10 games) | **Partly.** Early-season personal references will be thin and stale, so confidence is low and many players are Insufficient. This needs an owner decision: keep 2025-26 as a one-time holdout and then release it for references, or keep it reserved and accept a cohort-heavy reference. |
| NST ES absent 9.1%, PP absent with PP TOI 431 rows | per-record | No. Treat as missing with reasons. |
| 38 PP-definition mismatches | per-record | No. Flag them and exclude the PP fields. |
| 1,463 GS goal-field nulls (owner-reported) | Game Score track only | No. FP and G+A tracks are unaffected; GS shows those rows as unavailable. |
| NST has no game id; WGO 2022-23 has no game id | joins | No. Join on player + date (one game per player per date). |
| NST strength/date/unit semantics not formally qualified (Codex `unknown` flags) | process inputs | Needs one documented qualification check, not a stop. |
| On-ice NST counts not yet checked per strength (I read ES/PP individual only) | assist components | Coverage check needed in step 2. |

## 5. Smallest ordered implementation and validation plan (proposal, not started)

1. **Ownership first.** Agree in the mailbox on exact new paths (for example `web/lib/buyLowSellHigh/supportGap.ts` + test) alongside the active Codex lease. No edits to the nine leased files.
2. **Pure scorer + fixtures.** Implement 3.2–3.4 as a pure function over `qualifyCurrentResearchInputs` output plus a reference set. Fixtures cover: zero-shot player, missing NST row, PP genuine zero vs PP missing, opportunity change with no luck, pure shooting luck, pure teammate luck, thin reference (cohort shrink), and component sums reconciling to the total gap.
3. **Development backtest offline** on 2022-24 captures (rolling as-of): fit the credibility constants, report forward log-likelihood vs baselines, coverage by reason and list sizes.
4. **Current-season dry run** on the frozen 2026-27 capture Codex already holds: lists, confidence, coverage. Local only, no writes.
5. **Wire into the preview** behind the existing research flags; snapshot path unchanged.
6. **Holdout test** on 2025-26, once, only with explicit owner release.

Acceptance checks:
- For every scored player, components sum exactly to actual − expected (within 1e-9).
- No player with a missing core component has a numeric score; every withheld player has at least one reason.
- No list entry is driven by shot-count eligibility; zero-shot fixtures score.
- Sign test: shooting-luck fixture → BL (+), hot-finishing fixture → SH (−).
- An opportunity-only change yields gap ≈ 0 and a deployment chip.
- Forward test beats the reference-only baseline on development seasons, or the predictive claim is dropped and the score stays retrospective only.
- Local evidence (fixtures, backtest) is reported separately from any production behavior. No production claims until a separately approved run.
