# BLSH lists: mapper v3 handoff to Codex (2026-11-04)

From the Claude BLSH-lists lane. Mapper change: `web/lib/buyLowSellHigh/displayProfile.ts` and its test only, commit `42a6752ae` on `octoberBranch`.

The decisions come from TJ (decisions 1, 2 and 5 in `tasks/artifacts/blsh-brief-decisions-2026-11-03/DECISIONS.md`), the binding gating spec in `tasks/artifacts/blsh-list-gating-2026-11-03/PROPOSAL.md`, and two pop-up answers on 2026-11-03:
- List order follows the league-scoring gap (FHFH Standard), not the frozen tier/|index| order.
- A listed profile whose FHFH Standard gap points the other way is withheld as conflicting.

The saved JSON snapshot, the preview and Player Cards are unchanged until Codex does the steps below.

## 1. What mapper v3 saves

`mapperVersion` is now `blsh-display-profile-v3`. `scoreVersion` is unchanged, and `supportGap.score()` and `rankTwoLists` are unchanged and still decide who can be listed.

### List gate

The gate runs only on profiles the frozen rule lists. The first failing rule wins:

| # | Rule | `score.reason` |
|---|---|---|
| 1 | Personal history count missing, invalid, disagreeing with the scored axis, or 0 while reference games exist | `personal_history_unavailable_list_withheld` (existing) |
| 2 | 0 personal games, no reference games | `no_personal_history_list_withheld` (existing) |
| 3 | 1–19 personal games (`BLSH_MIN_PERSONAL_GAMES = 20`, provisional) | **`insufficient_personal_history_list_withheld`** |
| 4 | Window under 5 games (`BLSH_LIST_WINDOW_GAMES`) | **`short_window_list_withheld`** |
| 5 | FHFH Standard track missing or non-finite | **`headline_track_unavailable_list_withheld`** |
| 6 | FHFH Standard gap is 0 or points the other way (BL needs gap > 0, SH needs gap < 0) | **`headline_track_conflict_list_withheld`** |

Every code has a `REASON_TEXT` entry, so `score.reasonText` is always written text.

### New `score` fields (every profile)

- `rank`: the 1-based place in the side's full list, ordered by the **FHFH Standard gap in the list's direction**, largest first, with ties broken by playerId. It is contiguous per side, as before.
- `positionRank`: the 1-based place within the same side **and** position group (F or D). It is null when the profile is not listed. A listed profile with no position fails closed.
- `positionTopN`: true when `positionRank <= 25` (`BLSH_LIST_TOP_N`).
- `headline`: `{ track: "fantasy_points", scoring: "FHFH Standard", label: "FHFH Standard points", observed, expected, referenceAtCurrentTOI, gap }`.
  - `expected` is the support-conditioned FHFH points (`tracks[0].supportConditioned`); `gap = expected − observed`, so a positive gap is buy-low.
  - It is **null** when the track is missing. Never render that as 0.
- `directionWithheldReason` and `directionWithheldText`: set for every numeric profile under 20 personal games, listed or not, and for unknown or zero history. When set, `gapSignLabel` is `"Direction withheld: insufficient personal history"`. `gapSign` keeps the raw evidence sign for audit, so do not use it as the displayed direction.

### Other new fields

- Each entry in `tracks[]` gets `role: "headline" | "supporting"`. `fantasy_points` is the headline; G+A and Game Score are supporting.
- New snapshot metadata:
  - `headline: { track, scoring, label, supportingTracks, listOrder, combinedIndexNote }`;
  - `lists: { topN: 25, positionGroups: ["F","D"], minPersonalGames: 20, minPersonalGamesProvisional: true, windowGames: 5 }`.
- New `counts`: `withheldInsufficientPersonalHistory`, `withheldShortWindow`, `withheldHeadlineConflict`, `withheldHeadlineUnavailable`, `directionWithheld`, and `byPosition: { F: { BL, SH }, D: { BL, SH } }`.
- `limits`: the list-rule sentence is rewritten, and two lines are added (headline vs supporting tracks; FHFH Standard as the default league scoring).

## 2. Counts

**Pinned dry-run-v4 source** (2026-10-26, 725 profiles). These were computed by running the v3 mapper; they are also the expectations in the opt-in packaging test.

- Listed: BL 228 (F 140, D 88) and SH 138 (F 98, D 40).
- Withheld: 359 in total. Of those, the new gate withheld 117 for no personal history, 53 for insufficient history, 21 for a short window and 26 for a headline conflict (0 unavailable). The frozen rule alone listed 360 BL and 223 SH.
- `directionWithheld` 199; `zeroShotListed` 0.

**Current snapshot 2026-10-28** (`2026-10-28.arm-a-canonical-repaired.v2.json`, 729 profiles). This is a read-only simulation from the saved display JSON (`python3 -I`), because the source Profiles (pin `0ea21a45…`) are not on this disk. Confirm it when repackaging.

- Listed: BL **169** (F 103, D 66) and SH **112** (F 82, D 30), out of the 448 the frozen rule lists.
- Withheld from the list: 84 no personal history, 39 insufficient history, 15 short window, 29 headline conflict, 0 unknown history.
- Total withheld: 448 (281 not listed by the frozen rule plus 167 gated). `directionWithheld` 163.
- Top 3 per group (FHFH points observed vs expected):

| Side | Group | Top 3 |
|---|---|---|
| BL | F | Granlund 2.1 vs 16.4, Connor 6.9 vs 18.0, Byfield 2.4 vs 12.2 |
| BL | D | Makar 8.8 vs 17.9, Fowler 1.6 vs 8.6, Severson 1.9 vs 8.9 |
| SH | F | Zegras 29.8 vs 14.5, Roslovic 24.6 vs 9.5, Kyrou 25.8 vs 13.2 |
| SH | D | S. Jones 22.2 vs 11.7, Evans 17.0 vs 9.0, Chychrun 18.3 vs 11.1 |

## 3. Repackaging (Codex lease)

1. Re-run `buildDisplaySnapshot` at the mapper-v3 commit on the same saved Profiles that produced `2026-10-28.arm-a-canonical-repaired.v2.json`, without recomputing any score. Write a new file and leave the old one as it is.
2. Check the counts against section 2. Then diff the new snapshot against the old one, profile by profile. Only these may change:
   - `score`: `list`, `rank`, `reason`, `reasonText` and `gapSignLabel`, plus the new score fields;
   - `tracks[].role`;
   - `counts`, `limits`, `mapperVersion`, and the new `headline` and `lists` metadata.

   `score.value`, `normalizedGap`, `tracks` values, `evidence` and `context` must be byte-identical.
3. Re-point `CURRENT_SNAPSHOT_PATH`, re-pin `CURRENT_SNAPSHOT_SHA256` in `researchSnapshot.server.ts`, and update the counts in `BuyLowSellHighPreview.test.tsx` and `researchSnapshot*.test.ts`.
4. Player Cards: re-pin `RETAINED_BLSH_SHA256` (and the sidecar and box pins bound to it) only after review. The mapper parity test already shows that cards carry the same `list`, `rank`, `positionRank`, `positionTopN`, `headline`, `gapSignLabel`, `directionWithheldReason` and `reason` as the preview.

## 4. Parser changes in `researchSnapshot.ts` (current-snapshot validator)

- Accept `mapperVersion === "blsh-display-profile-v3"` for the new file, and require the new fields when it is v3.
- For each listed profile, require:
  - `evidence.reference.personalGames >= lists.minPersonalGames` and `evidence.window.games >= lists.windowGames`;
  - `score.headline` non-null with `list === "BL" ? headline.gap > 0 : headline.gap < 0`;
  - `positionRank` a positive integer, with `position` "F" or "D";
  - `positionTopN === (positionRank <= lists.topN)`.
- For each withheld profile: `positionRank === null` and `positionTopN === false`.
- Ranks:
  - `positionRank` must be contiguous from 1 within each (side, position);
  - `rank` must be non-increasing in the directed headline gap (BL: `gap`; SH: `−gap`);
  - `positionRank` order must agree with `rank` order.
- Headline: exactly one track has `role === "headline"`, and it is `fantasy_points`. `headline` must match that track (`observed`; `expected === supportConditioned`; `referenceAtCurrentTOI`; `gap`), or be null exactly when there is no such track or the profile is unavailable.
- Direction: `directionWithheldReason !== null` exactly when `gapSignLabel === "Direction withheld: insufficient personal history"`, and it is null for unavailable scores.
- Counts: each new `withheld*` count equals the number of profiles carrying that `score.reason`; `directionWithheld` equals the profiles with a direction reason; and `byPosition[pos][side]` equals the listed counts.
- Helpers:
  - extend `currentResearchLists` (or add a sibling) to return `{ F: { BL, SH }, D: { BL, SH } }`, each sorted by `positionRank`, plus `withheld`;
  - a `top(side, pos)` view is `rows.filter(p => p.score.positionTopN)`.

## 5. UI spec (`web/components/buyLowSellHigh/*`, `web/pages/buy-low-sell-high/preview.tsx`)

**Layout.**
- A position switch (F / D, default F) sits above the two lists. Buy-low and Sell-high sit side by side on desktop and stacked on mobile, each showing **the top 25 for the selected position** (`positionTopN`), sorted by `positionRank`.
- Each list ends with a one-click control: a button `Show full buy-low list (N forwards)`, where N comes from `counts.byPosition`. It expands the same table to every row for that side and position, in `positionRank` order, and changes to `Show top 25`.
  - It needs `aria-expanded` and `aria-controls`, and must not navigate away.
  - Keep the state in the URL query (`?pos=D&full=BL`) so a full list can be linked.
  - When a group has 25 or fewer rows, show "All N shown" instead of the button.

**Row columns.**
- `#positionRank` (with the overall `#rank` in muted text);
- player, team;
- **FHFH Standard points**: observed vs expected, and the gap with a sign (headline, emphasised);
- G+A observed vs expected (supporting);
- Game Score observed vs expected (supporting);
- coverage tier.

The combined index (`score.value`) may appear only as a muted supporting column labelled "Combined index (supporting; not a validated headline)". It must never be the first or largest number. Any missing track or `headline === null` renders "Unavailable", never 0 or a blank.

**Headings and notes.**
- List heading: "Buy-low research candidates · Forwards · ordered by FHFH Standard points gap".
- Under the lists, use `headline.listOrder`, `headline.combinedIndexNote`, and the `lists` constants. Wording: "At least 20 personal games (provisional), a 5-game window, and an FHFH Standard gap in the list's direction".

**Withheld section.** Keep it inspectable as it is now, with a filter by reason, including the four new reasons with their `reasonText`. Insufficient-history rows show `gapSignLabel` ("Direction withheld: insufficient personal history") and never a buy/sell word. The zero-history and unknown-history reasons keep their separate texts.

**Player detail** (`BlshPlayerDetail.tsx`):
- Lead with a headline block: "FHFH Standard points: observed X vs expected Y (gap ±Z)".
- Show the G+A and Game Score tracks under "Supporting tracks".
- Show `directionWithheldText` when it is set.
- Show the list placement as "Buy-low #positionRank of N forwards (overall #rank)".

**Player Cards** (`retainedBlsh.ts` / `analysisEvidence.ts`, not mine): `retainedBlshEvidence` derives `direction` from `gapSign`. When `profile.score.directionWithheldReason !== null`, it should report the direction as withheld or unknown rather than positive or negative. `analysisEvidence` already uses `gapSignLabel`, which carries the withheld wording.

## 6. Other lanes

The trade lane's `web/components/blshTrade/fixtureEvidence.ts` (commit `a00151c3c`) builds `DisplayProfile` fixtures and now fails `npm run typecheck` (2 errors, lines 33 and 41). It needs these fields:
- on `score`: `positionRank` (for example `spec.rank`), `positionTopN`, `headline` (from the FP fixture track, or null), `directionWithheldReason: null` and `directionWithheldText: null`;
- on each track: `role` (`"headline"` for the FP track, otherwise `"supporting"`).

That file is not in this lane's lease.
