# FORGE Dashboard Fantasy Workflow Integration

## Scope

This artifact closes task-list phase `5.0` for the refreshed FORGE dashboard:

- `5.2` Integrate ownership trend visuals and recent-change context beyond Top Adds
- `5.3` Reuse ownership API / ownership UI primitives where they fit
- `5.4` Add weekly streaming context to Top Player Adds
- `5.5` Make the `Tonight` / `This Week` toggle materially useful
- `5.6` Validate the slate / adds / goalie workflow as one fantasy decision surface

## Ownership Beyond Top Adds

Ownership context is no longer isolated to the Top Adds rail.

- `SustainabilityCard.tsx` now fetches Yahoo ownership context for visible player IDs and applies the default `25% - 50%` discovery band.
- `HotColdCard.tsx` uses the same ownership context contract and shows both current ownership and 5-day ownership change.
- Both player-insight cards stay text-first, with compact ownership sparkline treatment reserved for the lead rows only so non-opportunity cards do not turn into another adds rail.

## Reused Ownership Surfaces

The dashboard reuses the existing ownership stack selectively instead of importing an entire legacy presentation wholesale.

- `web/pages/api/v1/transactions/ownership-trends.ts` remains the primary trend feed.
- `web/pages/api/v1/transactions/ownership-snapshots.ts` supplies lightweight current-ownership filtering for player insight rows.
- `web/components/TransactionTrends/OwnershipSparkline.tsx` is the reusable visual primitive used by Top Adds and selected dashboard insight rows.
- `web/lib/dashboard/playerOwnership.ts` becomes the dashboard-owned adapter that merges snapshot and trend context into one playerId-keyed contract.

The design choice is intentional:

- reuse the ownership data and sparkline primitive
- avoid reusing the full transaction leaderboard UI where it would overpower the dashboard hierarchy

## Weekly Streaming Context

Weekly add context is now real, not placeholder copy.

- `TopAddsRail.tsx` uses `useSchedule.ts`
- `topAddsScheduleContext.ts` converts the weekly schedule grid into team-level context:
  - games remaining
  - off-nights remaining
  - summary label
- each add candidate receives schedule context when `This Week` mode is active

## Tonight vs This Week Behavior

The add-mode toggle changes ranking logic in a manager-usable way.

### Tonight

- projection request uses `horizon=1`
- ranking score is driven by:
  - recent trend strength
  - low-ownership bias
  - projection support
  - uncertainty penalty

### This Week

- projection request uses `horizon=5`
- the same core ranking remains in place
- weekly schedule context adds:
  - games remaining weight
  - off-night weight

The result is:

- `Tonight` behaves like a near-term opportunity board
- `This Week` behaves like a streaming-aware add board

## Workflow Validation

The dashboard now reads as a coherent fantasy workflow:

1. `Tonight's Slate` establishes matchup context
2. `Top Player Adds` converts that context into actionable adds
3. `Player Insight Core` answers whether those signals are trustworthy or only short-term
4. `Goalie and Risk` closes the loop for slate management

Navigation and drill-ins reinforce that flow instead of breaking it:

- opportunity cards route to `/forge/player/[playerId]`
- sustainability / momentum cards route to `/trends/player/[playerId]`
- team context routes to `/forge/team/[teamId]`
- slate context routes to `/start-chart`

## Verification Surface

The workflow and ownership/streaming integrations are covered by:

- `web/__tests__/pages/forge/dashboard.test.tsx`
- `web/lib/dashboard/topAddsRanking.test.ts`
- `web/lib/dashboard/topAddsScheduleContext.test.ts`
- `web/lib/dashboard/playerOwnership.test.ts`
