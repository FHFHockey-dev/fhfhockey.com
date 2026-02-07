# PRD — NHL Goalie Predictive Modeling Service  
**Working Title:** *The Stochastic Mask Engine*  
**Scope:** Goaltender sustainability, volatility, valuation, and short-horizon (Next 5 Games) projections  
**Primary Use:** Fantasy hockey + betting decision support (start/sit, streaming, props/totals), with a modeling spine reusable across future skater/team modules.

---

## 0) Executive Summary
Goaltending is the NHL’s highest-variance role: traditional outcomes (GAA, Sv%) are heavily polluted by team context and random event variance, and even “better” metrics (GSAx) show weak year-over-year repeatability. The service must therefore (1) explicitly model uncertainty and volatility, (2) separate goalie signal from environment, (3) regress aggressively to stable priors, and (4) translate noisy evidence into operational next-5 decisions.

**Core thesis (merged):**
- **Descriptive accuracy** is possible (xG → xGA, GSAx), but **predictive certainty** is not; the product must sell *probability + risk bands*, not “hot hand” narratives.  
- **Time-window standardization + volatility taxonomy** are non-negotiable, because interpretation changes drastically by sample length.  
- **Context matters**: defense, score effects, rink bias, and tracking limitations must be explicitly accounted for or flagged.

**Primary merged sources:**  
- *The Stochastic Mask* (xG architecture, flurry adjustment, rink bias, hot-hand falsification, fantasy/betting applications, future vision/biomechanics)  
- *Deep Research Task 1A* (Shared Spine windows, volatility taxonomy, evidence rubric, decision templates, unified checklist, contradictions handling)  
- *Phase 1 Framework* (parallel Shared Spine + checklist, and operational start/sit + betting translation)

---

## 1) Problem Statement
Goaltending evaluation suffers from:
- **Outcome pollution:** GAA is largely team-driven; Sv% treats low-danger and high-danger shots as equivalent and embeds “defensive insulation” bias.  
- **Repeatability crisis:** inter-season correlations for Sv% are often very low; even advanced measures struggle to show strong YOY stability.  
- **Narrative traps:** “hot goalie” belief is contradicted by empirical shot-level models showing regression dynamics and potential negative recent-performance correlation.  
- **Data limitations:** public RTSS-based xG models miss crucial pre-shot movement and tracking details, creating model divergence and information asymmetry versus private tracking.

The product must convert this into a reliable user experience:
- **Forecast next-5 blocks** with honest error bars.  
- **Explain why** forecasts are uncertain (volatility drivers, team effects, data limits).  
- **Provide actionable decisions** (start/sit, streaming, props/totals) that are consistent with the evidence hierarchy.

---

## 2) Goals / Non-Goals

### 2.1 Goals
1. **Next-5 Games Forecasts** for each goalie:
   - Distributional projections (not single numbers) for: Sv%, Goals Against, Saves, Win probability proxies (explicitly acknowledging team-dependence).
   - A **Volatility-Adjusted Risk** label and recommended action (Start/Sit/Stream/Prop lean).
2. **Stable, reusable modeling spine**:
   - Time windows, volatility taxonomy, evidence weighting, and “translated inference” rules.
3. **Signal separation**:
   - Distinguish goalie contribution (shot-quality adjusted) vs defensive environment (xGA, attempts against, score effects).
4. **Uncertainty-first UX**:
   - Convey noise bands (especially for 5-game windows) and regression-to-mean defaults.
5. **Operational checklists**:
   - A consistent workflow users can follow in minutes.

### 2.2 Non-Goals (for this phase)
- Full skater forecasting (future phase).  
- Full team context layer build-out beyond goalie-relevant inputs (future phase).  
- Perfect “truth” about pre-shot movement without tracking—must be **flagged** as a limitation, not silently assumed.

---

## 3) Users & Use Cases

### 3.1 Personas
- **Fantasy Manager (H2H):** wants start/sit guidance, streaming targets, ratio risk (GAA/Sv%) blowups.
- **Fantasy Manager (Roto):** wants season-level risk (regression flags, workload, “elite mirage” avoidance).
- **Bettor:** wants edges on save props, totals, and contextual fades (home unders, funnel defenses, underdog correlations).
- **Analyst / Builder:** wants transparent definitions, evidence hierarchy, and stable templates.

### 3.2 Key Use Cases
- “Should I start Goalie X this week (next 5 games)?”  
- “Is this 5-game heater meaningful or noise?”  
- “Which waiver/stream goalies maximize floor (saves) while minimizing ratio nukes?”  
- “Which games have value on save props / totals given shot environment + goalie risk profile?”  
- “Is a breakout sustainable or a burnout setup?”

---

## 4) Definitions (Product Standard)
**Important:** never mix definitions from incompatible models without labeling them as distinct.

### 4.1 Core Outcome & Process Metrics
- **GAA:** team-influenced outcome; reject as individual skill metric. *(Merged: Stochastic Mask + 1A)*
- **Sv%:** noisy; treats all shots equal; team/shot-quality polluted. *(Merged)*
- **xG / xGA:** shot-level goal probability; sum = expected goals against baseline. *(Stochastic Mask)*
- **GSAx:** (xGA − Actual Goals Against) — “gold standard” descriptive isolation attempt. *(Stochastic Mask + 1A)*
- **GSAx/60:** GSAx normalized per 60 minutes.
- **GSAA:** vs league-average Sv% baseline; legacy signal; still context-polluted vs xG-based. *(1A + Phase 1)*
- **All-Attempts Sv%:** includes misses (and/or broader attempt sets) to capture “forcing misses / intimidation” hypothesis; moderately more repeatable in cited findings. *(1A + Phase 1)*
- **Clean Sv%:** Sv% excluding tips/deflections/rebounds to isolate reaction/positioning talent. *(1A + Phase 1)*
- **HDSv%:** high-danger Sv% as context/fit signal; high noise. *(Merged)*

### 4.2 Model Architecture Terms (Standard)
- **Public xG (RTSS-based):** uses X,Y shot coordinates + proxies (time since last event, “speed” proxies, etc.). *(Stochastic Mask)*
- **Flurry adjustment:** discounts rapid sequences so a possession doesn’t exceed ~1.0 total goal probability. *(Stochastic Mask)*
- **Rink bias / venue effects:** systematic scoring biases in shot location/type recording; must be adjusted/flagged. *(Stochastic Mask)*
- **Score effects:** leading teams turtle, suppressing slot chances; trailing teams take riskier chances; must use score-adjusted slices or filters. *(Stochastic Mask + Phase 1)*

---

## 5) Shared Spine (Reusable Standards)

### 5.1 Time Windows & Horizon Mapping
**Primary windows (standardized):**
- **5 games:** next-5 / streaming horizon (≈300 minutes); **high-noise band**.
- **10 games:** trend identification (≈600 minutes); emerging signal.
- **20 games:** stability threshold (≈1200 minutes); breakout vs slump assessment.
- **Full season:** evaluation baseline; still contains large variance.
- **Multi-season (3+):** true-talent validation; regression prior.

**Translation rule:** if evidence is long-horizon (YOY / multi-season), next-5 implications must be labeled **Translated Inference** with lower confidence unless backed by direct 5–10 game evidence.

### 5.2 Volatility Taxonomy (Standard)
- **Game-to-game volatility (micro-variance):** single-start noise; deflections/screens/breakdowns dominate.
- **Intra-season volatility (streakiness):** rolling 10-game segment variance; “bounciness” is a risk characteristic.
- **Inter-season volatility (career stability):** YOY swings in GSAx/60 or era-adjusted Sv%; separates “anchors” vs “mirages.”
- **Era-adjusted volatility:** normalize across scoring environments (league Sv% shifts over time).
- **Team-dependent volatility:** variance driven by defensive chaos (xGA spikes) vs goalie skill.

### 5.3 Evidence Weighting + Validation Rubric
**Hierarchy (descending trust for goalie skill):**
1. **Shot-quality adjusted signals:** GSAx / GSAx/60 (model-dependent; still primary).
2. **All-attempts / clean variants:** stability/talent proxies (when available).
3. **Context signals:** HDSv%, splits (use carefully).
4. **Raw Sv%:** noisy.
5. **GAA:** reject for individual skill.

**Sample minimums (operational):**
- **Reject conclusions** under ~500 shots (≈15–18 games) as too wide error bars.
- **Provisional trends** around ~300 shots flagged low confidence (needs scouting/injury/mechanics confirmation).
- **Accepted baseline** ~1000+ shots for medium confidence.

**Recency bias filter:**
- Discount “last 5” by default (explicit skepticism) unless supported by a verified mechanical change or injury return.

**Outlier handling:**
- Flag seasons >2 SD from career mean as regression candidates until repeated.

---

## 6) Data Inputs (What the Service Needs)

### 6.1 Required Inputs (MVP)
**Goalie-level (rolling windows):**
- Minutes/starts; shots against; goals against.
- Sv% (5v5 and all-situations).
- xGA, GSAx, GSAx/60 (by situation if available).
- Basic split tags: home/away, rest days, back-to-back indicator.

**Team defense environment (rolling windows):**
- Attempts against proxies (Corsi Against / Fenwick Against).
- xGA/60 (team).
- Score state filters (e.g., “close”/score-adjusted variants).

**Schedule / workload:**
- Starts in last 14 days; projected start density.

### 6.2 Optional / Upgrades (Explicitly Labeled)
- Venue adjustment parameters (rink bias correction).
- Flurry-adjusted xG streams.
- Private tracking features (royal road / cross-seam / true pre-shot movement) — if not available, surface as limitation.
- Screen/visibility or future biomechanical features (pose estimation/trajectory) as R&D track.

---

## 7) Forecast Targets & Output Contracts

### 7.1 Primary Forecast Targets (Next 5 Games)
**Per goalie, for next 5 scheduled starts or next 5 team games (declare which):**
- **Expected Saves (distribution)**
- **Expected Goals Against (distribution)**
- **Sv% range (distribution)**
- **Blowup risk** (probability of “ratio killer” start; thresholded definition)
- **Start recommendation** (Start / Sit / Stream-Target / Avoid)
- **Confidence tier** (Low/Med/High) driven by sample size + volatility profile + data completeness

**Important product truth:** wins are **team-dependent**; you may output *win probability proxy* only with explicit label that it’s environment-heavy.

### 7.2 Secondary Forecasts (Mid-term)
- Next 10 games (trend band) and 20 games (stability threshold) as supportive context.
- Season rest-of-season risk flags:
  - Regression watch (elite mirage)
  - Volatility classification (stable vs volatile)

---

## 8) Modeling Approach (No Magic, Explicit Uncertainty)

### 8.1 Core Modeling Principles (Merged)
1. **Regress everything**: next-5 forecasts must be pulled toward rolling 3-year mean (or league average if insufficient history).  
2. **Separate environment vs goalie**:
   - Environment: xGA/60, attempts against, score effects.
   - Goalie: shot-quality adjusted over/under performance (GSAx variants).
3. **Window-aware interpretation**:
   - 5 games is largely noise; meaningful only when exceeding noise bands or corroborated by mechanics/injury context.
4. **Model divergence is real**:
   - Public xG differs by methodology; never pretend one “true” GSAx exists without labeling model source/version.
5. **Event dependence correction**:
   - Prefer flurry-adjusted frameworks where available to avoid phantom “multiple expected goals” in scramble sequences.

### 8.2 Volatility Bands (Operational Defaults)
- **5-game noise band:** treat ±1–2 goals above/below expected as normal variance; don’t call it “hot/cold.”
- **Meaningful deviation flag:** > ±3 GSAx in 5 games becomes an alert for possible mechanical change / injury / extreme run.
- **20-game stabilization:** earliest point for moderate-confidence breakout vs slump assessment.
- **Full-season swing reality:** typical starter YOY volatility can be massive (e.g., ~13–14 goals/season framing), so the product must avoid overconfidence even on season aggregates.

### 8.3 “Volatility-Adjusted Risk” Classification (Product Taxonomy)
Each goalie gets two orthogonal labels:

**(A) Quality (Level):**
- Elite / Above Avg / Avg / Below Avg (based on multi-season or full-season GSAx/60 priors, not last-5)

**(B) Reliability (Variance):**
- Stable / Average / Volatile (based on variance of era-adjusted metrics or YOY GSAx delta framing)

**Premium tier:** Stable-Elite  
**Trap tiers:** Volatile-High (boom/bust), Stable-Bad (predictably poor), Mirage assets (outlier season not repeated)

---

## 9) Decision Translation Layer (What the User Actually Gets)

### 9.1 Start/Sit Template (Next 5)
**Scenario rules (merged):**
- **Volatile-High + heater:** START until first bad start, then bench quickly (ride variance; don’t marry it).
- **Stable-Average + slump:** START (regression to mean expected).
- **Volatile-Low + heater:** SIT/SELL (mirage risk; crash probability high).
- **Stable-Elite + slump:** START (floor is the asset; don’t overreact).

### 9.2 Streaming Pickup Rules
- Target: **stable-good backups** facing **high shot volume** (save floor).
- Avoid: **volatile starters** in **low shot volume** matchups (few bad goals ruin ratios).

### 9.3 Betting Translation (Guardrailed)
**Save props:**
- Saves = (shot volume) × (save efficiency); volume often dominates.
- Target “shot funnel” defenses (high volume, low quality) for save-over logic when applicable.

**Totals:**
- Prefer team shot environment + pace/score effects over “goalie form.”
- Burnout risk (fatigue + deteriorating environment) → Over leans.

**Moneyline:**
- Treat goalie as a variance term:
  - Favorite with burnout-risk goalie → reduce conviction.
  - Underdog with high-volatility goalie → small value edge in “steal” scenarios (variance widens tails).

**System note:** any “system” like home goalie save unders should be presented as a *system hypothesis* with sample context, not as guaranteed edge.

---

## 10) Unified Next-5 Workflow (In-Product Checklist)
**Pre-Week / Pre-Slate**
1. **Volatility profile:** stable vs volatile (career / multi-season variance).
2. **Baseline:** rolling 3-year mean (or league mean if insufficient).
3. **Noise filter (last 5):**
   - within ±2 GSAx → ignore as trend; decide by matchup/context.
   - beyond ±3 GSAx → flag for mechanics/injury/role shift review.
4. **Defensive environment:** xGA/60 trend; if xGA rising but goalie GSAx stable → buy low (team slump, goalie fine).
5. **Workload/fatigue:** clusters (e.g., 4 starts in 8–10 days) increase volatility; fade late-cluster starts.

**Immediate Start/Sit**
- Regression check: volatile goalie off a shutout/1GA game → higher correction risk.
- Volume check: opponent high-shot/low-quality → start for save floor.
- Special teams filter: don’t overweight recent PK disaster (4v5 Sv% is extremely noisy); focus on 5v5 process.

**Failure-case warnings**
- New team bump: wait ~10 games before declaring new baseline; team structural Sv% biases transfer.
- Don’t drop proven starters off 1–2 bad starts; don’t crown waiver adds off 1–2 great starts.
- Ignore “must win” narratives as predictive input.

---

## 11) Contradictions & How the Product Resolves Them

### 11.1 Team Effects vs Goalie Independence
- One thread emphasizes Sv% as largely team-influenced; another emphasizes GSAx as defense-adjusted.  
**Resolution rule (product):**
- For **goalie talent evaluation** → prioritize GSAx-family metrics.  
- For **game outcomes (wins/records)** → weight team defense/context heavily; treat goalie as variance add-on.

### 11.2 Randomness vs Signal
- Some sources argue “basically random”; others show modestly more repeatable variants (all-attempts/clean).  
**Resolution rule:**
- Present goaltending as **high variance** where skill exists but is hard to isolate in small samples.
- Provide **confidence tiers** and force **regression priors** in next-5.

### 11.3 Consistency vs Quality
- A goalie can be consistent but bad.  
**Resolution rule:**
- Keep **Reliability** and **Quality** separate in UI and downstream recommendations.

---

## 12) Product Outputs (What the Website Should Show)

### 12.1 Goalie Card (Core)
- **Next-5 projection band** (Sv%, GA, Saves) with **probability ranges**
- **Risk meter:** blowup risk + volatility class
- **Context strip:** team xGA trend, attempt trend, score-state tendency
- **Workload strip:** recent start density, back-to-back flags
- **Action:** Start/Sit/Stream + confidence label + top reason(s)

### 12.2 Comparison Views
- **Goalie vs Goalie**: Quality × Reliability quadrant
- **Slate view:** best streaming targets (high floor) vs fades (burnout setups)

### 12.3 Disclosure/Limitations Panel (Non-Optional)
- xG model source/version + whether flurry adjustment and venue adjustment are applied
- Public-tracking limitations (lack of pre-shot movement, screen certainty)
- “Translated inference” markers when using long-horizon evidence for next-5 calls

---

## 13) Evaluation & Accountability

### 13.1 Backtest Units
- Evaluate at **blocks** (next 5 games) and optionally single-start (but label single-start as inherently low-signal).
- Compare forecast distributions to realized outcomes (calibration), not just point errors.

### 13.2 Metrics (Product Accountability)
- **Calibration:** do 60% bands contain outcomes ~60% of the time?
- **Error:** MAE/RMSE for GA and Saves (with context that variance is high)
- **Decision outcomes:** start/sit recommendation value-add vs naive baselines (e.g., always start confirmed starter; or always follow last-5 Sv%)

### 13.3 Baselines (Must Beat or Match)
- League-average prior + team-context-only model (no goalie “form”)
- Rolling 3-year goalie prior only (no context)
- Last-5 heuristic (should generally be worse; prove it)

---

## 14) MVP Release Plan (Phased)

### Phase 0 — Foundations
- Implement Shared Spine standards, volatility labels, and next-5 checklist logic.
- Output ranges + confidence tiers (even if initially heuristic-banded).

### Phase 1 — Public xG Integration
- Support one public xG source (clearly labeled) + GSAx/60 and windowing.
- Add optional flurry adjustment flag where applicable.

### Phase 2 — Context Hardening
- Add venue/score-state adjustment controls or filters.
- Improve environment features (team xGA trends, attempt trends).

### Phase 3 — R&D Track (Future)
- Screen/visibility and biomechanics (pose estimation, tracking-based trajectory).
- Private tracking integration (royal road/cross-seam) if accessible.

---

## 15) Appendix — Operational Formulas & Constraints (Product-Level, Not Code)

### A) Conceptual Definitions
- **GSAx (game or window):** sum(xG on shots faced) − goals allowed  
- **xGA:** sum(xG on shots faced)  
- **Flurry-adjusted xG:** discounts dependent rapid sequences so a possession doesn’t imply >1 expected goal

### B) “Noise Zone” Rules (Default)
- Next-5: treat typical performance swings as expected variance; only extreme deviations trigger “mechanical change” alerts.

### C) Labeling Requirements
- Every projection must show:
  - window used (5/10/20/season/3yr)
  - whether it’s a **direct** short-horizon signal or **Translated Inference**
  - confidence tier + reason (sample size, volatility class, data completeness)

---

## 16) Final Product Positioning (What This Service Is)
A probabilistic goalie decision engine that:
- **does not** promise certainty,
- **does** quantify volatility and tail risk,
- **does** separate team environment from goalie contribution,
- and **does** translate evidence into actionable next-5 recommendations with transparent assumptions.

> In short: the edge is not “predicting the hot hand,” it’s **pricing the chaos correctly**.