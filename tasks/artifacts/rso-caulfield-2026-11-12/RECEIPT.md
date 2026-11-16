# Judd Caulfield RSO mapping repair

- TJ approved the exact one-row production repair through Scout; parent relayed approval before execution.
- Preflight: DRM completion handback confirmed; latest Claude note retains separately approved operations only. Database probe returned zero other active client sessions and zero lock waits. Transaction retained 3-second statement and 1-second lock limits.
- Executed guarded `REPAIR.sql` once. It inserted exactly one verified Yahoo mapping and checked the RSO view inside the transaction. Committed at 2026-11-12 23:39:03 UTC.
- Fresh post-commit readback: `477.p.31129` → canonical `7531`, NHL `8481538`, name `Judd Caulfield`, context `yahoo:game:477:season:2026`, season `20262027`, verified. The production `yahoo_nhl_player_map_read` exposes the exact pair.
- Local regression: both resolver paths select 7531 from these values; missing/conflicting/wrong-season mappings stay rejected. 30 Yahoo tests and scoped lint passed before execution; focused Judd regression passed after readback.
- No application release, roster changes, aliases, bulk jobs, provider refresh calls, or unrelated data writes. Authenticated third-party roster UI was not accessed. That user should use Refresh provider to obtain a new snapshot.
