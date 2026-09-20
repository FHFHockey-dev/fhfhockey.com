# 06 — Opponent schedule and recent results

Status: planned; source inspection completed, implementation pending. Priority/dependencies: P2; depends on 00 season and team.

## Scope and evidence

NHL club-schedule-season returns games for selected team/season. The UI slices around the first game not FINAL/OFF, including up to five prior games and upcoming entries. Thus the component is recent results plus upcoming schedule.

- [OpponentGamelog.tsx](/Users/tim/Code/fhfhockey.com/web/components/WiGO/OpponentGamelog.tsx)
- [cors-fetch.ts](/Users/tim/Code/fhfhockey.com/web/lib/cors-fetch.ts)

## Distinct implementation plan

1. Verify schedule ordering, unique game IDs, gameType policy, postponed/cancelled games and live states before identifying the next game. Handle preseason, offseason and season completion explicitly.

2. Validate vs/@, W/L, scores, OT/SO and timezone/day boundaries. Next-game highlighting should identify the actual game and remain correct after clock/status changes.

3. Cache by team and season, share across teammates and responsive views, and use a freshness interval appropriate to future versus live games. Do not fetch per player when only team context changes.

## Verification and acceptance

Check a normal week, last game, no future games, postponement, a trade and late UTC starts. Acceptance: accurate recent/upcoming schedule and local times, with loading/error/empty states; no implication that team games guarantee player participation.

Before changing code, read [the audit scope and shared completion standard](README.md). Preserve other components and existing user changes. Live production validation and performance measurements are not implied by this source review.

## Implementation progress — September19,2026

Local schedule ordering/identity, next-game selection, explicit postponed/live state, timezone-safe fallback and team/season caching changes are implemented. Nine component tests cover chronological deduplication, completed season, postponement, away shootout/live results, UTC-midnight local display, invalid timestamps, empty/error states and cache reuse/team switch. Lint and TypeScript pass. A new live NHL response check failed DNS resolution, and the web-tool fallback was unavailable, so source revalidation is still open.
