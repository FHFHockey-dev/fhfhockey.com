# TJ decisions (direct pop-ups, 2026-10-26)

- **D1 Availability: keep the full discovery scan** (about 58 pages). Step 1, two-tier availability, is NOT approved.
- **D2 Cadence: split.** Every 5 min: today roster plus league_rosters only (~2 reads). Because D1 keeps the full scan, the full discovery scan runs at most every 15 min, or immediately when league_rosters show an ownership change. Settings, scoreboard and the weekly counter refresh every 30 min or on manual refresh. Add a cross-tab guard: only one visible tab per principal and league runs upkeep. Target ≈ 12×2 + 4×64 + 2×2 ≈ 280 reads/hour (from ~768).
- **D3 Settings:** 6 h per-league in-memory server cache, bypassed by manual refresh. No new table.
- **D4 Past-day lineups:** a private service-role-only table keyed by (user, team, date), holding player keys and slots only, purged at season end. The migration file and RLS are written and reviewed offline; **applying the migration needs separate approval.**
- **D5 Goalie confirmations:** per-(user, team, date) cache within the existing 2-min expiresAt, shared with the snapshot's today read; skipped when no rostered goalie plays today. Yahoo stays the source.
- **D6 Add timing: RSO adopts Start Chart's weekly_deadline inference** as its default acquisitionTiming. It's labelled as inferred from Yahoo's weekly deadline and stays overridable by the manager. RSO's "unknown, manager confirms" becomes the fallback when weekly_deadline is absent or ambiguous.
- **D7 Rollout:** behind a server flag, then one single-tab real-account compare window (≤80 reads; counts and agreement only), then on by default.
- **D8 Identity:** move RSO, confirmations and Start Chart to verified fhfh_player_external_identities (plan step 0), after an offline comparison of both resolvers.
