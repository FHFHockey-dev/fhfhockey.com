# Lines IGA gap report (2026-11-06)

Planning deliverable 1 for the Lines three-layer finish. It is a read-only audit of what exists against TJ's goal brief: entry lineup, IGA rail, next-game defaults, evidence feed and safeguards. Nothing was modified.

**Audited:**
- `web/lib/lines/*`
- `web/components/LineCombinations/{GameLineSnapshots,ProjectedLineups}.tsx`
- `web/pages/lines/*`
- `web/pages/api/v1/lines/projected.ts`
- `web/pages/api/v1/db/update-line-sources.ts`
- the snapshot migration
- the FxTwitter queue mapping
- the Nov 5–6 Twitter-lane diaries and artifacts

**Production reads** (read-only, 2026-11-06):
- Vercel `fhfhockey`: environment key names only, nothing decrypted.
- Supabase `fyhftlxokyjtpndbkfse`: four SELECT/catalogue queries.

## Headline

The snapshot engine in `web/lib/lines` is a solid foundation, but nothing is live and nothing can be selected yet. Three things stand between it and a working page:

1. **Production has none of it.** No `LINES_*` environment variable is set in production, so observations, entry serving and carry-forward are all off. Migration `20261002134400_game_line_snapshots` was never applied: the `line_source_captures`, `line_claim_revisions`, `line_claim_relations`, `line_entry_revisions`, `line_pp_decisions` and `line_game_state_observations` tables and the `append_line_decisions` RPC do not exist. Production `/lines` serves the legacy projection path: a flat "Latest reports" rail with a hard 8-report cap, plus the old `lineCombinations` grid.
2. **No producer writes per-claim decisions.** The processor reads `source.metadata.lineEvidence` (`processor.ts:43`), which holds kind, phase, binding spans, certainty, publication attestation and supersedes/retracts. Nothing outside tests writes it. Without it, every real claim picks up `binding_decision_unverified`, `claim_phase_unresolved`, `claim_kind_unresolved` and `original_provenance_unverified`. Each claim is then ineligible (`reconcile.ts:13`) and unbound (`gameId: null`). Even with the flags on, the entry lineup, the PP defaults and the in-game rail would be empty, and everything would land in "Unresolved evidence". The engine works this way on purpose (`processor.test.ts`: "does not invent classifier binding or phase"); the missing piece is the producer.
3. **The parser can't express IGAs yet.** The parsing audit's open Medium items include:
   - no `in_game` context is ever detected;
   - change-only and partial lineups (IN/OUT, `in_for`, swaps) produce nothing;
   - PP is treated as a row type that clears goalies;
   - PP substitutions work through only 3 fixed phrasings.

   Open High items include:
   - the DFO `🥅:` goalie lines are never parsed;
   - the first complete lineup in a bucket isn't preferred;
   - transactions are classified as injuries.

   Real in-game adjustments therefore never reach the claim layer.

## Requirement-by-requirement

Status key: **Done** means the code and tests satisfy the requirement locally, but nothing is live. **Partial** means part of it exists. **Gap** means it is missing.

### 1. Main panel: the lineup going into the game

| Requirement | Status | Evidence / gap |
|---|---|---|
| "Expected game-entry lineup" before puck drop, "Lineup entering the game" once frozen | Done (label logic) | `GameLineSnapshots.tsx:65`. **Gap:** the label follows the *stored* entry status, not live game state. A freeze happens only when the processor runs while the game is live (`persistLineReconciliation`). Nothing schedules that run: the FxTwitter enqueue does not call `update-line-sources`, and the starter-board retry only covers current-day pending rows. If no tweet arrives after puck drop, the page says "Expected" all game. A deterministic freeze trigger is needed (a cron or the poller's tick on the live transition), or read-time labelling from the observed phase. |
| Freeze on actual live state, not scheduled puck drop | Done | `gameState.ts`: an NHL `gameState` LIVE/CRIT state observed within 5 minutes. Phase is never derived from the clock. The cutoff is `actualStart ?? observedAt` (`reconcile.ts:75`). |
| Forwards, D, goalies, PP1/PP2, each with source and confirmed/projected status | Partial | `Units` renders one flat list per entry with designation, source and time per unit. PP units in the entry and in "Current PP defaults" duplicate each other. **Gaps:** no F/D/G/PP grouping, and no per-player status. Goalie confirmation depends on parser High #1/#3 and on Master Task List line 187. |
| Warmup > practice > carried-forward | Done (ranking) | `specificity` ranks warmup 2, game 1, practice 0 (`reconcile.ts:53`). The previous-game fallback appears only when no current entry units exist. **Gap:** no producer sets `specificity`; it defaults to "game". |
| In-game shuffle never rewrites the entry lineup; corrections create a visible revision with the prior version and reason | Done | A frozen entry admits only an `entry_correction` that supersedes a known claim, or a retraction. Each creates a `corrected` revision with `previousId`, a reason and the revision history (`reconcile.ts:85-122`, `GameLineSnapshots.tsx:66,80`). The client refuses an unchained revision swap (`mergeFrozenEntries`). |

### 2. In-game adjustments (IGA) rail

| Requirement | Status | Evidence / gap |
|---|---|---|
| Timestamped, source-attributed observations | Done (render) | Per-capture cards show publication time, ingestion time, `@author` link and per-claim status. |
| Keep only what the report supports (no invented rest-of-lineup, line number or displaced player) | Done (model) / Gap (producer) | `unit.complete`, "Unassigned" line numbers and relationship-only claims exist. The parser does not yet produce partial or change-only claims (audit M5/M8). |
| Older updates reachable, no 8-report cap | Partial | Snapshot rail: paged at 8 with "Show earlier updates", so everything stays reachable. Legacy rail (what production serves today): a hard `slice(0, 8)` (`ProjectedLineups.tsx:37`). |
| Mobile: entry first, then an expandable "In-game updates (N)" | Partial | Single column under 800px with the entry first. The toggle exists but **defaults to expanded** (`useState(true)`); it should start collapsed on mobile. N counts captures, which is correct. |
| Raw feed separate from interpreted IGA lane | **Gap** | One card mixes raw tweet text with interpreted claim statuses. No separate source feed exists. The layout is a design decision (pop-up). |
| Readable without embeds | Done | Snapshot rail is plain text. Legacy rail falls back to blockquote text. |

### 3. Next-game defaults

| Requirement | Status | Evidence / gap |
|---|---|---|
| Live game by default, else next scheduled; previous games selectable | Done (team/game routes) | `chooseDefaultGame`; the selector lists every team game. **Gap:** the `/lines` index mounts `<ProjectedLineups/>` with no team or game, and the API returns 400 when entry serving is on, so the index page would show "temporarily unavailable". |
| Carry accepted in-game PP forward until superseded, PP1 and PP2 separately | Partial | `reconcilePP` handles units 1 and 2 independently and carries in-game PP claims from the latest earlier game. **Gaps:** (a) It requires a complete 5-player unit, so a swap like "Kulich and Krebs replace McLeod and Doan on PP2" cannot be applied to a base unit and carried. (b) It is superseded only by current-game claims. A *pregame* report in game N+1 does not stop game N's in-game observation from carrying into N+2. (c) There is no expiry rule (days, games, trade or roster change). (d) It needs `LINES_PP_CARRY_FORWARD_ENABLED`. |
| Label the prior game and source; "carried" never means confirmed | Done | "Carried forward from {date · away at home}" plus a disclaimer (`GameLineSnapshots.tsx:56,74`). |
| No automatic even-strength carry-forward | Done | Only the `pp` kind is carried. |

### 4. Evidence

| Requirement | Status | Evidence / gap |
|---|---|---|
| Source feed beside lineup, distinct from IGA lane | **Gap** | See 2. A layout decision is needed. |
| Text, timestamp and attribution survive an embed failure | Done | Plain-text rendering. |

### 5. Safeguards

| Requirement | Status | Evidence / gap |
|---|---|---|
| Interpret individual claims, not a whole tweet | Done | `claimsFromReport` splits by unit and relationship with per-key `claimEvidence`. |
| Keep original author and relay, text, publication and ingestion times, game/team binding | Done (model) / Partial (intake) | `SourceTime` keeps original, relay, ingested, interpreted and effective times separate. **Intake gap:** FxTwitter enqueues IFTTT-shaped `text` ("RT @x: …"). The nested repost author, quoted text and alt text sit in `raw_payload.fx` and are not mapped into `report.provenance`, so attribution still depends on X-API/oEmbed lookups. `first_seen_at` is not carried, so the ingestion time becomes the queue insert time. |
| Timestamp alone never binds or confirms | Done | `bindLineGame` needs an explicit game, opponent plus date, or a relative date with a timezone; `no_game_binding_evidence` otherwise. Confirmation needs `confirmationEvidence`. |
| Conflicts, corrections and retractions visible | Done | Conflicts appear in the entry and PP sections, plus unresolved evidence and correction notices. **Copy gap:** "Unresolved evidence" lists raw reason codes such as `binding_decision_unverified`. |
| Deduplicate relays; a relay is not an independent confirmation | Done (engine) / Risk (intake) | `activeLineClaims` collapses relay to original, and `mayReplace` denies relays correction authority. **Risk:** IFTTT keys reposts on the wrapper id, FxTwitter on the original id. During mixed operation the same repost can be processed twice. The engine dedupes on `originalIdentity` only when attribution resolves. |
| Unknown, unavailable, loading and publishing-disabled states are distinct | Done | Loading, temporarily unavailable, stale refresh, disabled, no game and "Game state unavailable" are all covered by `GameLineSnapshots.test.tsx`. |

### Cross-cutting

- **CCC never reaches the snapshot engine.** `update-lines-ccc.ts` never calls `processLineSnapshotEvidence`; only `update-line-sources` does. CCC is a primary lines source.
- **Practice/unconfirmed status.** The engine has `specificity: practice` and `certainty: projected`, but nothing sets them. The trainer answer key has no context, certainty or game-binding field.
- **Trainer answer key.** Production has 5 items with `metadata.answerKey` out of 9,604 review items. The key can express forward lines, D pairs, PP1/PP2 (5 spots each), off-PP and missed names. It cannot express in-game versus practice context, partial/change scope or game binding. Today it is a regression oracle, not a claim-acceptance input.
- **Player resolution** (Master Task List line 191). `resolveEventUnit` accepts only approved aliases at event time. A typo like "Kuluch" fails, which correctly keeps the claim ineligible, but there is no path from a trainer correction to an approved alias.
- **Parser files belong to other lanes.** Owners hold uncommitted work in `web/lib/sources/{tweetInterpretation,linesCccIngestion,lineSourceProcessing,…}.ts`, the trainer files and the Supabase functions. Lines lanes need to sequence around them.
- **Read cost.** `readGameLines` calls the NHL landing endpoint on every GET for up to 3 candidate games (15 s CDN cache). That's acceptable, but worth caching once served.

## What needs production approval (for the plan)

1. Apply `20261002134400_game_line_snapshots` plus any new decision-producer migration, and register them in `migration-authority.json`.
2. Set `LINES_OBSERVATIONS_ENABLED`, then `LINES_ENTRY_SERVING_ENABLED`, then `LINES_PP_CARRY_FORWARD_ENABLED` on Vercel production. Each flag change requires a deploy (memory: env-only redeploys get canceled).
3. Release the web candidate: one fhfhockey build.
4. FxTwitter cutover for DFO, the GameDay accounts and CCC. This belongs to the X-intake lane; Lines only consumes the queues.
5. Any bounded live-game acceptance read (smoke test budget of 5 or fewer).
