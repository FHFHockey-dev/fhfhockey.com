# Game Grid preview fixtures

All data here is synthetic and served by an isolated Vite server on 127.0.0.1:3112. The server blocks Supabase and NHL clients, and the specs abort every non-local request.

- **Default (`/`):** 24 synthetic teams ("Fixture Team NN"). This is the original fixture and its meaning is unchanged.
- **`/?teams=32`:** 32 teams replaying a real 2025-03-17 NHL week's matchups (`real-week-32.ts`; the source and its validation are noted there) on the fixture's synthetic week. It adds `postponed` and `stale` schedule states.
- **`/?details=1`:** the standalone TeamDetails preview states.
