# 2026-11-06 claude — position-aware player names

## Scope
1. Position tie-break when a name fits 2+ players on the tweet's team (line→F, pair→D, net→G).
2. Team + position-group (F/D/G) scoped aliases in `lineup_player_name_aliases`; alias tool allows a surname alias unique within its team (+group).

## Where
octoberBranch, canonical checkout, uncommitted (nothing committed by this lane).
- lib/sources/playerIdentity.ts: `resolvePlayerIdentity(..., role)`, `breakIdentityTieByRole`, `positionSlotRole`, `roleAliases`.
- lib/sources/tweetInterpretation.ts: row role into resolveRowIdentity (incl. goalie); unheaded rows try both ES roles and keep the one every name fits (fixes first D pair dropped after forward lines).
- lib/sources/lineupSourceIngestion.ts, linesCccIngestion.ts: role threaded through canonicalize/role checks/id mapping; roster-linked scanner keeps raw text for same-span namesakes.
- lib/sources/tweetPlayerEvents.ts: ambiguous name tied to "in net/starts in net/gets the start" resolves as the G.
- lib/sources/playerNameAliases.ts, lineSourceProcessing.ts: position_group aliases → roleAliases; alias reads use select("*") (migration-order safe).
- pages/api/v1/db/player-name-aliases.ts: positionGroup body param; surname alias allowed when unique within team (+group); group must match player position.
- pages/api/v1/db/replay-player-aliases.ts: replay resolves with the row's recorded situation.
- supabase/migrations/20261106204707_lineup_player_name_alias_position_group.sql (APPLIED to production 2026-11-06 with TJ approval; ledger version 20261106204707).

## State / checks
- Vitest lib/sources + alias API + replay: 1392 passed.
- typecheck: exit 0 (pre-test-edit run); second run + lint pending.
- Regression runner (interpretation path): 4 labels, 0 fixed, 0 broken — key too small; all 4 differ only in slots, none has a shared name.

## Next
Migration applied. Remaining: TJ review/commit; optional UI control for positionGroup.

## Gotchas
- Interpretation path inherits the previous row's role for unheaded rows; a blank line resets it — that's why the audit's DFO tweets (no blank line) dropped pair 1.
- No UI control for positionGroup yet (API only).

- Code committed in d80b8e5f6 (2026-11-06, TJ pop-up). The migration file stays uncommitted: it goes in with its authority row (order 114) in the X-timeline chef's migration-authority.json. Retire this diary after that.
