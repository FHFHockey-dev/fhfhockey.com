# Complete API route inventory

Source snapshot: 357 files under `web/pages/api/**`, including `.js`; local source only. Every file is represented once below. SHA-256, imports, and module edges are in `source-inventory.json`. Reviewed effect sites are deduplicated in `effect-sites.json`; the route-to-site relation is in `route-classifications.json`. No source bodies or generic literal/credential values are retained.

`WRITE` denotes a reachable database/storage mutation candidate; `RPC_NAMED_DISPATCH` records a fixed non-reader RPC dispatch; `RPC_DYNAMIC_EFFECT_UNKNOWN` is an unresolved computed RPC name, not proof of a write. `HTTP`/`PROVIDER_SDK` includes internal HTTP and external provider calls; Supabase auth/database transport is represented by auth/read/write instead of provider HTTP. `READ_RPC` includes specifically reviewed readers. `READ/LOCAL_OR_INERT` has no mutation/provider-call site in the reviewed handler/helper closure. Branches and injected dependencies are conservative; site presence does not mean every request executes it. `A!` identifies the confirmed outer-audit authorization-order issue. Method literals are handler observations, not all enforcement guarantees; `*` means no explicit route method check found. Operational wrapper contract methods take precedence over legacy inner method literals.

Factory dispatch was expanded for mock-draft, IFTTT, operational routes, and forecast editor wrappers. Fixed `adp` and `access` actions are pruned explicitly. Local Map/Set/cache deletion and crypto hash update are excluded from database writes. Public Start Chart/FORGE/RSO reader RPCs were checked against local SQL bodies; no hosted schema parity is claimed. Read-only import closure alone was never treated as proof of an active write.

For all rows with user bearer, guard implementation is `web/lib/api/requireApiUser.ts:20-43`; for admin/cron, `web/utils/adminOnlyMiddleware.ts:15-63` and `:66-130`. Public audit writes occur after rejected requests at `web/lib/cron/withCronJobAudit.ts:262,367-369`; this is independent of guarded business work.

| # | Route source (prefix `web/pages/api/`) | Method literals | Guard / authorization | Effects / dispatch | Evidence / note |
| --- | --- | --- | --- | --- | --- |
| 1 | `Averages/[playerId].ts` | * | public | HTTP | handler source; E0263 |
| 2 | `CareerAverages/[playerId].ts` | * | public | HTTP | handler source; E0263 |
| 3 | `SustainabilityStats/[playerId].ts` | * | public | HTTP,WRITE | handler source; E0003,E0521,E0263 |
| 4 | `Teams/[teamAbbreviation].ts` | * | public | HTTP | handler source; E0263 |
| 5 | `Teams/nst-team-stats.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:557; E0012,E0003,E0377,E0378,E0379 |
| 6 | `ThreeYearAverages/[playerId].ts` | * | public | HTTP | handler source; E0263 |
| 7 | `cors/index.ts` | GET | public | HTTP | handler source; E0004 |
| 8 | `createComment.ts` | POST | public | WRITE_SANITY | handler source; E0380; Intentional anonymous comment submission; field validation only in source. |
| 9 | `fetch_team_table.ts` | GET | public | HTTP | handler source; E0263 |
| 10 | `healthz.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 11 | `internal/cron-auth-check.ts` | * | nonempty cron secret bearer | READ/LOCAL_OR_INERT | handler source |
| 12 | `internal/espn-sync.ts` | GET | nonempty cron secret bearer | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | handler source; E0113,E0116,E0106,E0114,E0115,E0117,E0118,E0119 |
| 13 | `internal/fantrax-sync.ts` | GET | nonempty cron secret bearer | HTTP,READ_RPC,WRITE | handler source; E0145,E0124,E0151,E0146,E0147,E0148,E0149,E0150,E0152,E0153 |
| 14 | `internal/forecast-calendar.ts` | GET | nonempty cron secret bearer | READ_RPC,WRITE | handler source; E0264,E0322 |
| 15 | `internal/patreon-reconcile.ts` | GET | admin role OR cron; loopback development exception | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | adminOnly:6; E0160,E0178,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 16 | `internal/starter-board.ts` | GET | nonempty cron secret bearer | HTTP,RPC_NAMED_DISPATCH | lib/sources/lineSourceIftttReceiver:5; E0327,E0381,E0315,E0316 |
| 17 | `internal/sustainability/health.ts` | GET | admin role OR cron; loopback development exception | READ/LOCAL_OR_INERT | adminOnly:28 |
| 18 | `internal/sync-yahoo-players-to-sheet.ts` | * | nonempty cron secret bearer; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,PROVIDER_SDK,WRITE | handler source; E0012,E0100,E0101,E0102,E0103,E0104 |
| 19 | `internal/yahoo-live-draft.ts` | GET | nonempty cron secret bearer | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | handler source; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0230,E0231,E0222,E0221,E0235,E0217,E0218,E0249,E0250,E0251,E0254,E0252,E0253,E0255,E0237,E0223,E0224,E0225,E0220,E0226 |
| 20 | `team-ratings.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 21 | `toi.ts` | * | public | HTTP,WRITE | handler source; E0003,E0521 |
| 22 | `underlying-stats/landing.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 23 | `underlying-stats/team-ratings.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 24 | `v1/account/draft-pro/access-codes/redeem.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:12; E0382 |
| 25 | `v1/account/draft-pro/checkout.ts` | POST | user bearer/getUser | HTTP,PROVIDER_SDK,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:24; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0183,E0184,E0185,E0191,E0192,E0186,E0187,E0188,E0189,E0190 |
| 26 | `v1/account/draft-pro/checkout/verify.ts` | POST | user bearer/getUser | HTTP,PROVIDER_SDK,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:24; E0383,E0191,E0192,E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 27 | `v1/account/draft-pro/drafts/[id].ts` | GET,PUT,DELETE | user bearer/getUser | HTTP,READ_RPC,RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | requireApiUser:19; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0036,E0034,E0035,E0020,E0019,E0021,E0022,E0023,E0037,E0038 |
| 28 | `v1/account/draft-pro/drafts/[id]/imports/[importId].ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:10; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0032 |
| 29 | `v1/account/draft-pro/drafts/index.ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:16; E0033,E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0034,E0035,E0020,E0019,E0021,E0022,E0023 |
| 30 | `v1/account/draft-pro/index.ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:12; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 31 | `v1/account/draft-pro/private-imports.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:14; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0020,E0019,E0021,E0022,E0023,E0025,E0026 |
| 32 | `v1/account/draft-pro/private-imports/[uploadId]/chunks/[ordinal].ts` | PUT | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:12; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0024,E0027 |
| 33 | `v1/account/draft-pro/private-imports/[uploadId]/stage.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:10; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0024,E0028,E0029,E0030 |
| 34 | `v1/account/draft-pro/refund-requests.ts` | POST | user bearer/getUser | PROVIDER_SDK,WRITE | requireApiUser:14; E0015,E0013,E0016,E0014 |
| 35 | `v1/account/draft-pro/reports/[id].ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:12; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 36 | `v1/account/draft-pro/reports/index.ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:19; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0036,E0031,E0384 |
| 37 | `v1/account/draft-pro/scenarios/[id].ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:10; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 38 | `v1/account/draft-pro/scenarios/index.ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:17; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0031,E0385 |
| 39 | `v1/account/espn/apply-settings.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:13; E0121 |
| 40 | `v1/account/espn/connections/[accountId].ts` | PATCH,DELETE | user bearer/getUser | HTTP,RPC_NAMED_DISPATCH,WRITE | requireApiUser:31; E0122,E0120,E0106,E0114,E0115 |
| 41 | `v1/account/espn/connections/[accountId]/leagues/[leagueId].ts` | DELETE | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:26; E0123 |
| 42 | `v1/account/espn/connections/[accountId]/leagues/index.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:27; E0113,E0106,E0114,E0115 |
| 43 | `v1/account/espn/connections/index.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:13 |
| 44 | `v1/account/espn/draft-sessions/[sessionId]/index.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:28 |
| 45 | `v1/account/espn/draft-sessions/[sessionId]/poll.ts` | POST | user bearer/getUser | HTTP,RPC_NAMED_DISPATCH,WRITE | requireApiUser:28; E0108,E0106,E0109,E0110,E0111 |
| 46 | `v1/account/espn/draft-sessions/[sessionId]/stop.ts` | POST | user bearer/getUser | WRITE | requireApiUser:28; E0112 |
| 47 | `v1/account/espn/draft-sessions/index.ts` | GET,POST | user bearer/getUser | HTTP,RPC_NAMED_DISPATCH,WRITE | requireApiUser:16; E0107,E0108,E0106,E0109,E0110,E0111 |
| 48 | `v1/account/espn/import.ts` | GET,POST | user bearer/getUser | WRITE | requireApiUser:21; E0142,E0143,E0132,E0133,E0134,E0135,E0136,E0137,E0138,E0139,E0140,E0141 |
| 49 | `v1/account/espn/link.ts` | POST | user bearer/getUser | HTTP,RPC_NAMED_DISPATCH,WRITE | requireApiUser:13; E0106,E0114,E0115 |
| 50 | `v1/account/espn/refresh.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:13; E0113,E0116,E0106,E0114,E0115,E0117,E0118,E0119 |
| 51 | `v1/account/fantrax/apply-settings.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:12; E0155 |
| 52 | `v1/account/fantrax/connections/[accountId].ts` | PATCH,DELETE | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:30; E0156,E0154,E0145,E0124,E0144 |
| 53 | `v1/account/fantrax/connections/index.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:12 |
| 54 | `v1/account/fantrax/discover.ts` | POST | user bearer/getUser | HTTP,READ_RPC | requireApiUser:15; E0145,E0124 |
| 55 | `v1/account/fantrax/draft-sessions/[sessionId]/index.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:13 |
| 56 | `v1/account/fantrax/draft-sessions/[sessionId]/poll.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:13; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0127,E0128,E0124,E0125,E0129,E0130 |
| 57 | `v1/account/fantrax/draft-sessions/[sessionId]/stop.ts` | POST | user bearer/getUser | WRITE | requireApiUser:13; E0131 |
| 58 | `v1/account/fantrax/draft-sessions/index.ts` | GET,POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:13; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0145,E0124,E0125,E0126 |
| 59 | `v1/account/fantrax/import.ts` | GET,POST | user bearer/getUser | WRITE | requireApiUser:21; E0142,E0143,E0132,E0133,E0134,E0135,E0136,E0137,E0138,E0139,E0140,E0141 |
| 60 | `v1/account/fantrax/link.ts` | POST | user bearer/getUser | HTTP,RPC_NAMED_DISPATCH | requireApiUser:12; E0124,E0144 |
| 61 | `v1/account/fantrax/player-data.ts` | GET | user bearer/getUser | HTTP | requireApiUser:57; E0124 |
| 62 | `v1/account/fantrax/refresh.ts` | POST | user bearer/getUser | HTTP,READ_RPC,WRITE | requireApiUser:12; E0145,E0124,E0151,E0146,E0147,E0148,E0149,E0150,E0152,E0153 |
| 63 | `v1/account/patreon/callback.ts` | GET | signed expiring state; no browser/session binding (F4) | HTTP,RPC_NAMED_DISPATCH,WRITE | handler source; E0157,E0160,E0159,E0161,E0162,E0168,E0163,E0164,E0165,E0166,E0167,E0170,E0169,E0171,E0172 |
| 64 | `v1/account/patreon/connect.ts` | POST | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:17 |
| 65 | `v1/account/patreon/disconnect.ts` | POST | user bearer/getUser | WRITE | requireApiUser:14; E0176,E0177 |
| 66 | `v1/account/patreon/index.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:15 |
| 67 | `v1/account/patreon/refresh.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:15; E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 68 | `v1/account/yahoo/callback.ts` | GET | single-use state + browser cookie binding + PKCE transaction | HTTP,PROVIDER_SDK,RPC_NAMED_DISPATCH,WRITE | handler source; E0233,E0234,E0386,E0387,E0197,E0200,E0198,E0199,E0201,E0202,E0203,E0204,E0205,E0206,E0207,E0208,E0209,E0210,E0211,E0212 |
| 69 | `v1/account/yahoo/connect.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:16; E0232 |
| 70 | `v1/account/yahoo/disconnect.ts` | POST | user bearer/getUser | WRITE | requireApiUser:18; E0388,E0389 |
| 71 | `v1/account/yahoo/draft-sessions/[sessionId]/index.ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:26; requireYahooLiveDraftServerAccess:32; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0221 |
| 72 | `v1/account/yahoo/draft-sessions/[sessionId]/poll.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:26; requireYahooLiveDraftServerAccess:32; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0228,E0221 |
| 73 | `v1/account/yahoo/draft-sessions/[sessionId]/stop.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH,WRITE | requireApiUser:20; E0229,E0219,E0221 |
| 74 | `v1/account/yahoo/draft-sessions/index.ts` | GET,POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:30; requireYahooLiveDraftServerAccess:37; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0249,E0250,E0251,E0254,E0252,E0253,E0255,E0237,E0215,E0216,E0219,E0227,E0221 |
| 75 | `v1/account/yahoo/pickup.ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:12; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0249,E0250,E0251,E0254,E0252,E0253,E0255,E0237 |
| 76 | `v1/account/yahoo/refresh.ts` | POST | user bearer/getUser | PROVIDER_SDK,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:19; E0197,E0200,E0198,E0199,E0201,E0202,E0203,E0204,E0205,E0206,E0207,E0208,E0209,E0210,E0211,E0212,E0239,E0240,E0241,E0238,E0242,E0243,E0244 |
| 77 | `v1/account/yahoo/starter-board.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:14; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0249,E0250,E0251,E0254,E0252,E0253,E0255,E0237,E0292,E0003 |
| 78 | `v1/account/yahoo/team-roster.ts` | POST | user bearer/getUser | PROVIDER_SDK,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:19; E0246,E0247,E0245,E0248 |
| 79 | `v1/contextual-rankings.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 80 | `v1/contextual-rankings/available-filters.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 81 | `v1/contextual-rankings/comparison.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 82 | `v1/contextual-rankings/deployment-tiers.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 83 | `v1/contextual-rankings/goalies.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 84 | `v1/contextual-rankings/matrix.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 85 | `v1/contextual-rankings/metadata.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 86 | `v1/contextual-rankings/snapshot.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 87 | `v1/contextual-rankings/splits.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 88 | `v1/contextual-rankings/teams.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 89 | `v1/contextual-rankings/trending.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 90 | `v1/contextual-rankings/war.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 91 | `v1/db/audit-nhl-ppt-replay-coverage.ts` | GET | public | HTTP | handler source; E0293 |
| 92 | `v1/db/audit-nhl-xg-backfill.ts` | GET | outer admin/cron; method bound before audit | HTTP,WRITE | withOperationalRouteAuth:96; E0012,E0003 |
| 93 | `v1/db/auto-news-feed-items.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:433; E0012,E0449,E0390,E0391,E0393,E0394,E0395,E0396,E0397,E0398,E0392 |
| 94 | `v1/db/backfill-goalie-underlying-season.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:288; E0012,E0368 |
| 95 | `v1/db/backfill-player-underlying-season.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:288; E0012,E0369 |
| 96 | `v1/db/backfill-team-underlying-season.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:292; E0012,E0371 |
| 97 | `v1/db/build-projection-derived-v2.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,RPC_NAMED_DISPATCH,WRITE | adminOnly:554; E0012,E0289 |
| 98 | `v1/db/calculate-wigo-stats.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:1318; E0012,E0003,E0399,E0400,E0401,E0402 |
| 99 | `v1/db/catch-up-goalie-underlying.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:206; E0012,E0003,E0368 |
| 100 | `v1/db/catch-up-player-underlying.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:206; E0012,E0003,E0369 |
| 101 | `v1/db/catch-up-team-underlying.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:204; E0012,E0003,E0371 |
| 102 | `v1/db/check-missing-goalie-data.ts` | POST | outer admin/cron; method bound before audit | HTTP,WRITE | withOperationalRouteAuth:488; E0012,E0613,E0614,E0006,E0007,E0263,E0403 |
| 103 | `v1/db/cron-report.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,PROVIDER_SDK,WRITE | adminOnly:2421; E0012,E0404 |
| 104 | `v1/db/cron/update-roster-optimizer-schedule-daily.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:123; E0012,E0003 |
| 105 | `v1/db/cron/update-stats-cron.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | adminOnly:75; E0012,E0003,E0405,E0082,E0006,E0007,E0008,E0521,E0010,E0009 |
| 106 | `v1/db/draft-ranker-health.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,RPC_NAMED_DISPATCH,WRITE | adminOnly:148; E0012,E0041,E0042,E0039 |
| 107 | `v1/db/drain-starter-board.ts` | POST | admin role OR cron; loopback development exception | RPC_NAMED_DISPATCH,WRITE | adminOnly:5; E0304,E0305,E0297,E0299,E0298,E0301,E0306,E0307,E0308,E0309,E0310,E0311,E0312,E0313,E0314,E0300,E0302,E0290,E0291,E0317,E0316 |
| 108 | `v1/db/ingest-projection-inputs.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:852; E0012,E0296,E0293,E0295,E0294 |
| 109 | `v1/db/manual-refresh-yahoo-token.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,PROVIDER_SDK,WRITE | adminOnly:79; E0012,E0213,E0406 |
| 110 | `v1/db/news-feed-items.ts` | GET,POST | admin role OR cron; loopback development exception | WRITE | adminOnly:218; E0407,E0408,E0409,E0410,E0411 |
| 111 | `v1/db/player-name-aliases.ts` | GET,POST | scoped signed review token OR admin/cron | HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:322; verifyPlayerAliasReviewToken:341; E0336,E0412,E0413,E0414,E0337,E0338,E0415,E0416,E0417,E0418,E0419 |
| 112 | `v1/db/powerPlayTimeFrame.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:12; E0012,E0003,E0420,E0421 |
| 113 | `v1/db/refresh-draft-ranker-community.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,RPC_NAMED_DISPATCH,WRITE | adminOnly:154; E0012,E0039 |
| 114 | `v1/db/refresh-draft-ranker-discovery.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,RPC_NAMED_DISPATCH,WRITE | adminOnly:125; E0012,E0040 |
| 115 | `v1/db/refresh-roster-optimizer-schedule.ts` | * | outer admin/cron; method bound before audit | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | withOperationalRouteAuth:120; withOperationalRouteAuth:123; E0012,E0422,E0003,E0323,E0423 |
| 116 | `v1/db/register-nhl-xg-model.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:132; E0012,E0373,E0374,E0375 |
| 117 | `v1/db/replay-player-aliases.ts` | POST,GET | admin role OR cron; loopback development exception | HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:11; E0424,E0425,E0426,E0427,E0428,E0339,E0340,E0341,E0342,E0343,E0332 |
| 118 | `v1/db/run-fetch-wgo-data.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:59; E0012 |
| 119 | `v1/db/run-projection-accuracy.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,RPC_NAMED_DISPATCH,WRITE | adminOnly:2458; E0012,E0429,E0432,E0433,E0434,E0430,E0431 |
| 120 | `v1/db/run-projection-v2.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,RPC_NAMED_DISPATCH,WRITE | adminOnly:1647; E0012,E0304,E0305,E0297,E0299,E0298,E0301,E0306,E0307,E0308,E0309,E0310,E0311,E0312,E0313,E0314,E0300,E0302,E0290,E0291 |
| 121 | `v1/db/run-rolling-forge-pipeline.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:1200; E0012,E0296,E0003,E0457,E0458,E0567,E0568,E0569,E0522,E0523,E0324,E0263,E0511,E0507,E0508,E0509,E0510,E0512,E0011,E0006,E0007,E0581,E0582,E0583,E0584,E0585,E0586,E0587,E0002,E0001,E0465,E0466,E0524,E0293,E0295,E0294,E0303,E0441,E0289,E0459,E0461,E0460,E0304,E0305,E0297,E0299,E0298,E0301,E0306,E0307,E0308,E0309,E0310,E0311,E0312,E0313,E0314,E0300,E0302,E0290,E0291,E0429,E0432,E0433,E0434,E0430,E0431 |
| 122 | `v1/db/send-player-name-alias-review.ts` | POST | admin role OR cron; loopback development exception | PROVIDER_SDK,RPC_NAMED_DISPATCH,WRITE | adminOnly:30; E0435,E0436,E0437,E0438,E0439,E0440 |
| 123 | `v1/db/shift-charts.ts` | POST | admin role OR cron; loopback development exception | HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:1413; E0003,E0303,E0441 |
| 124 | `v1/db/skaterArray.ts` | GET | public | READ/LOCAL_OR_INERT | handler source; Inert compatibility/quarantine response; no database/provider work. |
| 125 | `v1/db/starter-board-release.ts` | POST | admin role OR cron; loopback development exception | READ_RPC,RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | adminOnly:16; E0442,E0443,E0444,E0445,E0446,E0447 |
| 126 | `v1/db/sustainability/rebuild-baselines.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:441; E0012,E0448 |
| 127 | `v1/db/sweep-gamecenter-normalization.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:446; E0012,E0371,E0369 |
| 128 | `v1/db/tweet-pattern-review.ts` | GET,POST | admin role OR cron; loopback development exception | HTTP,WRITE | adminOnly:1069; E0334,E0449,E0450,E0451,E0452 |
| 129 | `v1/db/update-PbP.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:195; E0012,E0296,E0293,E0295,E0294 |
| 130 | `v1/db/update-drafted-prospects.ts` | * | admin role OR cron; loopback development exception | HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:8; E0453,E0336,E0337,E0338,E0454,E0455 |
| 131 | `v1/db/update-entity-metric-rankings.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:246; E0012,E0318 |
| 132 | `v1/db/update-game-goal-projections/index.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:137; E0012,E0613,E0614,E0006,E0007,E0099,E0456 |
| 133 | `v1/db/update-games.ts` | POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:124; E0012,E0003,E0457,E0458 |
| 134 | `v1/db/update-goalie-projections-v2.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:390; E0012,E0459,E0006,E0007,E0461,E0460 |
| 135 | `v1/db/update-goalie-starter-mixtures.ts` | GET,POST | outer admin/cron; method bound before audit | WRITE | withOperationalRouteAuth:221; E0012,E0462 |
| 136 | `v1/db/update-goalie-underlying-stats.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:292; E0012,E0003,E0368 |
| 137 | `v1/db/update-goalie-underlying-summaries.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:321; E0012,E0003,E0368 |
| 138 | `v1/db/update-last-7-14-30.ts` | * | outer admin/cron; method bound before audit | HTTP,WRITE | withOperationalRouteAuth:337; E0012,E0003,E0463,E0006,E0007,E0464 |
| 139 | `v1/db/update-line-combinations/[id].ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:17; E0012,E0002,E0006,E0007,E0001,E0465,E0466 |
| 140 | `v1/db/update-line-combinations/index.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:158; E0012,E0002,E0006,E0007,E0001,E0465,E0466,E0003 |
| 141 | `v1/db/update-line-sources.ts` | POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,READ_RPC,RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | adminOnly:321; E0012,E0344,E0345,E0003,E0352,E0353,E0334,E0351,E0333,E0348,E0350,E0346,E0347,E0349,E0354,E0467,E0468,E0469,E0470,E0471,E0282,E0283,E0278,E0279,E0284,E0285,E0286,E0281,E0280,E0472,E0330,E0356,E0357,E0355,E0256,E0257,E0258,E0259,E0260,E0331,E0332,E0473 |
| 142 | `v1/db/update-lines-ccc.ts` | POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,READ_RPC,RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | adminOnly:198; E0012,E0344,E0345,E0003,E0352,E0353,E0334,E0351,E0333,E0348,E0350,E0346,E0347,E0349,E0354,E0474,E0475,E0476,E0477,E0478,E0356,E0357,E0355,E0282,E0283,E0278,E0279,E0284,E0285,E0286,E0281,E0280,E0331,E0332,E0479 |
| 143 | `v1/db/update-lineup-deployment-tallies.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:25; E0012,E0003,E0480 |
| 144 | `v1/db/update-lineup-source-provenance.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:141; E0012,E0003,E0481,E0335,E0482,E0483 |
| 145 | `v1/db/update-market-prices.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:181; E0012,E0003,E0484,E0006,E0007,E0485,E0486,E0487 |
| 146 | `v1/db/update-nhl-edge-stats.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:1103; E0012,E0003,E0490,E0491,E0492,E0488,E0489 |
| 147 | `v1/db/update-nhl-edge-teams.ts` | POST | public | READ/LOCAL_OR_INERT | handler source; Inert compatibility/quarantine response; no database/provider work. |
| 148 | `v1/db/update-nhl-play-by-play.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:10; E0012,E0003 |
| 149 | `v1/db/update-nhl-ppt-replay-tracking.ts` | GET,POST | outer admin/cron; method bound before audit | HTTP,WRITE | withOperationalRouteAuth:282; E0012,E0293,E0005,E0493,E0494,E0495 |
| 150 | `v1/db/update-nhl-shift-charts.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:10; E0012,E0003 |
| 151 | `v1/db/update-nhl-xg-adjusted-impact.ts` | GET,POST | outer admin/cron; method bound before audit | WRITE | withOperationalRouteAuth:481; E0012,E0496 |
| 152 | `v1/db/update-nhl-xg-aggregates.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | adminOnly:555; E0012,E0372,E0497 |
| 153 | `v1/db/update-nhl-xg-created-xg.ts` | GET,POST | outer admin/cron; method bound before audit | WRITE | withOperationalRouteAuth:321; E0012,E0498 |
| 154 | `v1/db/update-nhl-xg-qot-qoc.ts` | GET,POST | outer admin/cron; method bound before audit | WRITE | withOperationalRouteAuth:349; E0012,E0499 |
| 155 | `v1/db/update-nhl-xg-rebound-control.ts` | GET,POST | outer admin/cron; method bound before audit | WRITE | withOperationalRouteAuth:340; E0012,E0500 |
| 156 | `v1/db/update-nhl-xg-shot-assists.ts` | GET,POST | outer admin/cron; method bound before audit | WRITE | withOperationalRouteAuth:313; E0012,E0501 |
| 157 | `v1/db/update-nhl-xg-shot-features.ts` | GET,POST | outer admin/cron; method bound before audit | HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | withOperationalRouteAuth:551; E0012,E0372,E0003,E0376 |
| 158 | `v1/db/update-nhl-xg-shot-predictions.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | adminOnly:591; E0012,E0372,E0003,E0502 |
| 159 | `v1/db/update-nhl-xg-transitions.ts` | GET,POST | outer admin/cron; method bound before audit | WRITE | withOperationalRouteAuth:344; E0012,E0503 |
| 160 | `v1/db/update-nhl-xg-travel-fatigue.ts` | GET,POST | outer admin/cron; method bound before audit | WRITE | withOperationalRouteAuth:179; E0012,E0504 |
| 161 | `v1/db/update-nhlscraper-contracts.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:176; E0012,E0505 |
| 162 | `v1/db/update-nst-current-season.ts` | GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:772; E0012,E0613,E0614,E0006,E0007,E0263,E0287,E0506 |
| 163 | `v1/db/update-nst-gamelog.ts` | GET,POST | admin role OR cron; loopback development exception | HTTP,WRITE | adminOnly:2994; E0263,E0511,E0507,E0508,E0509,E0510,E0512 |
| 164 | `v1/db/update-nst-goalies.ts` | GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:886; E0012,E0613,E0614,E0006,E0007,E0263,E0513 |
| 165 | `v1/db/update-nst-last-ten.ts` | POST | outer admin/cron; method bound before audit | HTTP,WRITE | withOperationalRouteAuth:968; E0012,E0613,E0614,E0006,E0007,E0263,E0514 |
| 166 | `v1/db/update-nst-player-reports.ts` | POST,GET | outer admin/cron; method bound before audit | HTTP,WRITE | withOperationalRouteAuth:829; E0012,E0613,E0614,E0006,E0007,E0263,E0515 |
| 167 | `v1/db/update-nst-team-daily.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:933; E0012,E0613,E0614,E0006,E0007,E0263,E0516 |
| 168 | `v1/db/update-player-impact-ratings.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:298; E0012,E0517 |
| 169 | `v1/db/update-player-statuses.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:134; E0012,E0326,E0518,E0519,E0520 |
| 170 | `v1/db/update-player-trend-metrics.ts` | POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:52; E0012,E0613,E0614,E0006,E0007,E0610 |
| 171 | `v1/db/update-player-underlying-stats.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:344; E0012,E0003,E0369,E0371 |
| 172 | `v1/db/update-player-underlying-summaries.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:406; E0012,E0003,E0369 |
| 173 | `v1/db/update-player/[playerId].ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:7; E0012,E0003,E0521 |
| 174 | `v1/db/update-players.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:8; E0012,E0003,E0522,E0523,E0324 |
| 175 | `v1/db/update-power-play-combinations/[gameId].ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:59; E0012,E0002,E0006,E0007,E0001,E0524 |
| 176 | `v1/db/update-power-play-combinations/index.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:60; E0012,E0002,E0006,E0007,E0001,E0524 |
| 177 | `v1/db/update-power-rankings.ts` | POST,GET | public | READ/LOCAL_OR_INERT | handler source; Inert compatibility/quarantine response; no database/provider work. |
| 178 | `v1/db/update-rolling-games.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:39; E0012 |
| 179 | `v1/db/update-rolling-player-averages.ts` | HEAD,GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:1101; E0012 |
| 180 | `v1/db/update-roster-optimizer-schedule.ts` | * | outer admin/cron; method bound before audit | HTTP,WRITE | withOperationalRouteAuth:606; withOperationalRouteAuth:619; E0012,E0003 |
| 181 | `v1/db/update-season-stats.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:1101; E0012,E0003,E0082,E0006,E0007,E0008,E0521,E0010 |
| 182 | `v1/db/update-seasons.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:6; E0012,E0003,E0525 |
| 183 | `v1/db/update-shifts.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:15; E0012,E0003,E0303,E0441 |
| 184 | `v1/db/update-skater-composite-ratings.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:174; E0012,E0319 |
| 185 | `v1/db/update-sko-stats.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:1844; E0012,E0003,E0527,E0006,E0007,E0528,E0529,E0530,E0531,E0532,E0533,E0534,E0535,E0536,E0537,E0538,E0539,E0540,E0541,E0542,E0526,E0543,E0544,E0545,E0546,E0547,E0548,E0549,E0550,E0551,E0552,E0553,E0554,E0555,E0556,E0557,E0558 |
| 186 | `v1/db/update-standings-details/index.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:23; E0012,E0003,E0559,E0560 |
| 187 | `v1/db/update-stats/[gameId].ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:200; E0012,E0003,E0082,E0006,E0007,E0008,E0521,E0010 |
| 188 | `v1/db/update-team-ctpi-daily.ts` | GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:342; E0012,E0613,E0614,E0006,E0007,E0561 |
| 189 | `v1/db/update-team-power-ratings-new.ts` | POST,GET | public | READ/LOCAL_OR_INERT | handler source; Inert compatibility/quarantine response; no database/provider work. |
| 190 | `v1/db/update-team-power-ratings.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:403; E0012,E0613,E0614,E0006,E0007,E0562 |
| 191 | `v1/db/update-team-sos.ts` | GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:343; E0012,E0613,E0614,E0006,E0007,E0563,E0564 |
| 192 | `v1/db/update-team-unit-toi.ts` | GET,POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:120; E0012,E0320 |
| 193 | `v1/db/update-team-yearly-summary.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:113; E0012,E0565,E0006,E0007,E0566 |
| 194 | `v1/db/update-teams.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:133; E0012,E0003,E0567,E0568,E0569 |
| 195 | `v1/db/update-wgo-averages.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:1178; E0012,E0570 |
| 196 | `v1/db/update-wgo-goalie-totals.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:270; E0012,E0003,E0011,E0006,E0007,E0571 |
| 197 | `v1/db/update-wgo-goalies.ts` | * | admin role OR cron; loopback development exception | HTTP,WRITE | adminOnly:1654; E0577,E0006,E0007,E0578,E0579,E0573,E0572,E0011,E0574,E0575,E0576,E0580 |
| 198 | `v1/db/update-wgo-skaters.ts` | * | admin role OR cron; loopback development exception | HTTP,WRITE | adminOnly:2229; E0011,E0006,E0007,E0581,E0582,E0583,E0003,E0584,E0585 |
| 199 | `v1/db/update-wgo-totals.ts` | * | admin role OR cron; loopback development exception | HTTP,WRITE | adminOnly:855; E0011,E0006,E0007,E0586,E0003,E0587 |
| 200 | `v1/db/update-yahoo-players.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:468; E0012,E0214,E0588,E0589,E0236 |
| 201 | `v1/db/update-yahoo-weeks.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:114; E0012,E0214,E0590 |
| 202 | `v1/db/upsert-csv.ts` | POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,RPC_NAMED_DISPATCH,WRITE | adminOnly:298; E0012,E0591,E0592 |
| 203 | `v1/debug/rolling-player-metrics.ts` | HEAD,GET | admin role OR cron; loopback development exception | WRITE | adminOnly:126; E0321 |
| 204 | `v1/discord/send-message/line-combo/[gameId].ts` | * | admin role OR cron; loopback development exception | HTTP | adminOnly:8; E0593 |
| 205 | `v1/draft-pro/dust.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:95; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 206 | `v1/draft-pro/export.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:14; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 207 | `v1/draft-pro/fantrax-player-data.ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:52; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0124 |
| 208 | `v1/draft-pro/recommendations.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:19; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 209 | `v1/draft-ranker/community.ts` | GET | optional user bearer; public aggregate branch | READ/LOCAL_OR_INERT | client.auth.getUser:28 |
| 210 | `v1/draft-ranker/discovery.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:43 |
| 211 | `v1/draft-ranker/entries.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:38 |
| 212 | `v1/draft-ranker/export.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:56 |
| 213 | `v1/draft-ranker/index.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:40 |
| 214 | `v1/draft-ranker/initialize.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:38; E0049 |
| 215 | `v1/draft-ranker/pairwise/consent.ts` | GET,POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:42; E0051 |
| 216 | `v1/draft-ranker/pairwise/queue.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:38; E0052 |
| 217 | `v1/draft-ranker/pairwise/respond.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:39; E0053 |
| 218 | `v1/draft-ranker/placement.ts` | GET,POST | user bearer/getUser | RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH | requireApiUser:48; E0046,E0047,E0048 |
| 219 | `v1/draft-ranker/players/request-addition.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:38; E0044 |
| 220 | `v1/draft-ranker/players/search.ts` | GET | user bearer/getUser | READ_RPC | requireApiUser:42; E0043 |
| 221 | `v1/draft-ranker/reorder.ts` | POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:38; E0050 |
| 222 | `v1/draft-ranker/watchlist.ts` | GET,POST | user bearer/getUser | RPC_NAMED_DISPATCH | requireApiUser:48; E0045 |
| 223 | `v1/fantasy-projections/players.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 224 | `v1/fantasy-projections/players/[fhfhPlayerId].ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 225 | `v1/fantasy-projections/releases.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 226 | `v1/fantasy-projections/teams.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 227 | `v1/forge/accuracy.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 228 | `v1/forge/forecasts.ts` | GET | public | READ_RPC | handler source; E0322 |
| 229 | `v1/forge/goalies.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 230 | `v1/forge/players.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 231 | `v1/forge/roster-events.ts` | GET,POST,PATCH,DELETE | public GET; admin/cron mutation branch | WRITE | adminOnly:65; E0594,E0595,E0596 |
| 232 | `v1/game-predictions/accountability.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 233 | `v1/game-predictions/accuracy-loop.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:164; E0012,E0085,E0086,E0087,E0088,E0083,E0084 |
| 234 | `v1/game-predictions/backfill-feature-snapshots.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:92; E0012,E0094 |
| 235 | `v1/game-predictions/backtest-ablation.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:139; E0012,E0085,E0086,E0087,E0088,E0083,E0084 |
| 236 | `v1/game-predictions/backtest.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:107; E0012,E0085,E0086,E0087,E0088 |
| 237 | `v1/game-predictions/debug.ts` | * | admin role OR cron; loopback development exception | READ/LOCAL_OR_INERT | adminOnly:47 |
| 238 | `v1/game-predictions/debug/[predictionId].ts` | * | admin role OR cron; loopback development exception | READ/LOCAL_OR_INERT | adminOnly:47 |
| 239 | `v1/game-predictions/espn-odds.ts` | GET | public | HTTP | handler source; E0089 |
| 240 | `v1/game-predictions/feature-signal-analysis.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:107; E0012 |
| 241 | `v1/game-predictions/forecast.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:97; E0012,E0095,E0094,E0097,E0098,E0288 |
| 242 | `v1/game-predictions/generate.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:52; E0012,E0095,E0094,E0097,E0098,E0288 |
| 243 | `v1/game-predictions/health.ts` | * | admin role OR cron; loopback development exception | READ/LOCAL_OR_INERT | adminOnly:33 |
| 244 | `v1/game-predictions/import-market-odds.ts` | POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:165; E0012,E0091,E0090 |
| 245 | `v1/game-predictions/ingest-espn-odds.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:130; E0012,E0089,E0092,E0090 |
| 246 | `v1/game-predictions/latest.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 247 | `v1/game-predictions/promote-model-version.ts` | POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | adminOnly:103; E0012,E0096 |
| 248 | `v1/game-predictions/score.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:64; E0012,E0095,E0093 |
| 249 | `v1/game/[id]/boxscore/index.ts` | * | public | HTTP | handler source; E0003 |
| 250 | `v1/game/[id]/right-rail/index.ts` | * | public | HTTP | handler source; E0003 |
| 251 | `v1/games/index.js` | * | public | HTTP | handler source; E0597 |
| 252 | `v1/homepage/pulse.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 253 | `v1/homepage/visitors.ts` | GET | public | HTTP | handler source; E0105 |
| 254 | `v1/lines/projected.ts` | GET | public | HTTP | handler source; E0003 |
| 255 | `v1/ml/create-materialized-view.ts` | POST | public | READ/LOCAL_OR_INERT | handler source; Inert compatibility/quarantine response; no database/provider work. |
| 256 | `v1/ml/get-predictions-sko.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 257 | `v1/ml/update-predictions-sko.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | adminOnly:706; E0012,E0261,E0003,E0598 |
| 258 | `v1/mock-draft/access.ts` | POST | factory user bearer/getUser (feature/capability gates) | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | lib/mockDraft/api:1; E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175; Access resolution may synchronize owner grants/Patreon; no session-register action. |
| 259 | `v1/mock-draft/adp.ts` | GET | public aggregate RPC (feature gated) | READ_RPC | lib/mockDraft/api:1; Fixed adp action returns before user-access/mutation branches; mock_draft_adp is stable SQL SELECT. |
| 260 | `v1/mock-draft/sessions/[id]/contributions.ts` | DELETE | factory user bearer/getUser (feature/capability gates) | HTTP,READ_RPC,RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | lib/mockDraft/api:1; E0262,E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 261 | `v1/mock-draft/sessions/[id]/events.ts` | POST | factory user bearer/getUser (feature/capability gates) | HTTP,READ_RPC,RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | lib/mockDraft/api:1; E0262,E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 262 | `v1/mock-draft/sessions/index.ts` | POST | factory user bearer/getUser (feature/capability gates) | HTTP,READ_RPC,RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | lib/mockDraft/api:1; E0262,E0017,E0018,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 263 | `v1/player-forecasts/accountability.ts` | GET | admin/cron + forecast runtime boundary | READ/LOCAL_OR_INERT | playerForecastAdminOnly:7 |
| 264 | `v1/player-forecasts/admin/season-draft.ts` | POST | verified user + sole editor allowlist + admin + runtime boundary | RPC_NAMED_DISPATCH,WRITE | utils/playerForecastSeasonEditorOnlyMiddleware:5; E0054,E0055 |
| 265 | `v1/player-forecasts/admin/season-editor.ts` | GET | verified user + sole editor allowlist + admin + runtime boundary | READ/LOCAL_OR_INERT | utils/playerForecastSeasonEditorOnlyMiddleware:5 |
| 266 | `v1/player-forecasts/admin/season-overrides.ts` | POST | verified user + sole editor allowlist + admin + runtime boundary | WRITE | utils/playerForecastSeasonEditorOnlyMiddleware:5; E0056 |
| 267 | `v1/player-forecasts/admin/season-player-pool.ts` | GET | verified user + sole editor allowlist + admin + runtime boundary | HTTP,READ_RPC,RPC_NAMED_DISPATCH | utils/playerForecastSeasonEditorOnlyMiddleware:13; E0063,E0003,E0064 |
| 268 | `v1/player-forecasts/admin/season-publish.ts` | POST | verified user + sole editor allowlist + admin + runtime boundary | RPC_NAMED_DISPATCH | utils/playerForecastSeasonEditorOnlyMiddleware:5; E0060 |
| 269 | `v1/player-forecasts/admin/season-rerun.ts` | POST | verified user + sole editor allowlist + admin + runtime boundary | RPC_NAMED_DISPATCH | utils/playerForecastSeasonEditorOnlyMiddleware:5; E0057 |
| 270 | `v1/player-forecasts/admin/season-rollback.ts` | POST | verified user + sole editor allowlist + admin + runtime boundary | RPC_NAMED_DISPATCH | utils/playerForecastSeasonEditorOnlyMiddleware:5; E0062 |
| 271 | `v1/player-forecasts/admin/season-roster-conflicts.ts` | POST | verified user + sole editor allowlist + admin + runtime boundary | HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | utils/playerForecastSeasonEditorOnlyMiddleware:6; E0058,E0066,E0067,E0081,E0068,E0069,E0070,E0071,E0072,E0073 |
| 272 | `v1/player-forecasts/admin/season-validate.ts` | POST | verified user + sole editor allowlist + admin + runtime boundary | WRITE | utils/playerForecastSeasonEditorOnlyMiddleware:5; E0059 |
| 273 | `v1/player-forecasts/conflicts.ts` | GET,POST | scoped signed review token OR admin/cron; runtime boundary | RPC_NAMED_DISPATCH,WRITE | createClientWithToken().auth.getUser:23; playerForecastAdminOnly:148; verifyPlayerForecastReviewToken:167; E0599,E0600 |
| 274 | `v1/player-forecasts/dashboard.ts` | GET | admin/cron + forecast runtime boundary | READ/LOCAL_OR_INERT | playerForecastAdminOnly:17 |
| 275 | `v1/player-forecasts/history.ts` | GET | admin/cron + forecast runtime boundary | READ/LOCAL_OR_INERT | playerForecastAdminOnly:12 |
| 276 | `v1/player-forecasts/jobs/daily.ts` | GET,POST | admin/cron + forecast runtime boundary | RPC_NAMED_DISPATCH,WRITE | playerForecastAdminOnly:7; E0265,E0266 |
| 277 | `v1/player-forecasts/jobs/drain.ts` | GET,POST | admin/cron + forecast runtime boundary | HTTP,RPC_NAMED_DISPATCH,WRITE | playerForecastAdminOnly:11; E0271,E0274,E0275,E0267,E0268,E0269,E0270,E0272 |
| 278 | `v1/player-forecasts/jobs/retry.ts` | POST | admin/cron + forecast runtime boundary | WRITE | playerForecastAdminOnly:5; E0601 |
| 279 | `v1/player-forecasts/jobs/season-daily.ts` | GET,POST | admin/cron + forecast runtime boundary | RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | playerForecastAdminOnly:15; E0065,E0080,E0079,E0076,E0077,E0074,E0059,E0075,E0061,E0078 |
| 280 | `v1/player-forecasts/jobs/season-drain.ts` | GET,POST | admin/cron + forecast runtime boundary | RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | playerForecastAdminOnly:12; E0065,E0079,E0076,E0077,E0074,E0059,E0075,E0061,E0078 |
| 281 | `v1/player-forecasts/jobs/season-roster.ts` | GET,POST | admin/cron + forecast runtime boundary | HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,RPC_NAMED_DISPATCH,WRITE | playerForecastAdminOnly:12; E0066,E0067,E0081,E0068,E0069,E0070,E0071,E0072,E0073 |
| 282 | `v1/player-forecasts/jobs/season-settlement.ts` | GET,POST | admin/cron + forecast runtime boundary | RPC_DYNAMIC_EFFECT_UNKNOWN | playerForecastAdminOnly:10; E0065 |
| 283 | `v1/player-forecasts/jobs/settle.ts` | GET,POST | admin/cron + forecast runtime boundary | WRITE | playerForecastAdminOnly:6; E0276,E0277 |
| 284 | `v1/player-forecasts/latest.ts` | GET | admin/cron + forecast runtime boundary | READ/LOCAL_OR_INERT | playerForecastAdminOnly:12 |
| 285 | `v1/player-forecasts/readiness.ts` | GET | admin role OR cron; loopback development exception | HTTP | adminOnly:6; E0273 |
| 286 | `v1/player-forecasts/rest-of-season.ts` | GET | admin/cron + forecast runtime boundary | READ/LOCAL_OR_INERT | playerForecastAdminOnly:16 |
| 287 | `v1/player-forecasts/season-readiness.ts` | GET | admin/cron + forecast runtime boundary | RPC_DYNAMIC_EFFECT_UNKNOWN | playerForecastAdminOnly:7; E0065 |
| 288 | `v1/player-forecasts/send-conflict-review.ts` | POST | admin/cron + forecast runtime boundary | PROVIDER_SDK | playerForecastAdminOnly:23; E0602 |
| 289 | `v1/player/[id]/game-log/[season]/[type]/index.ts` | * | public | HTTP | handler source; E0003 |
| 290 | `v1/player/[id]/index.ts` | * | public | HTTP,WRITE | handler source; E0003,E0521 |
| 291 | `v1/player/[id]/percentile-rank.ts` | * | public | HTTP,READ_RPC,WRITE | handler source; E0003,E0521,E0603 |
| 292 | `v1/player/index.ts` | * | public | HTTP | handler source; E0003 |
| 293 | `v1/projections.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 294 | `v1/projections/goalies.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 295 | `v1/projections/players.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 296 | `v1/projections/teams.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 297 | `v1/rankings.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 298 | `v1/roster-schedule-optimizer/access.ts` | GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:8; E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175 |
| 299 | `v1/roster-schedule-optimizer/data.ts` | GET | public | READ_RPC | handler source; E0322 |
| 300 | `v1/roster-schedule-optimizer/diagnostic-context.ts` | GET | user bearer/getUser | READ/LOCAL_OR_INERT | requireApiUser:33; db.auth.admin.getUserById:37; Authenticated diagnostic reads; hash.update is not a database write. |
| 301 | `v1/roster-schedule-optimizer/diagnostic.ts` | GET | development + loopback peer/local host | READ/LOCAL_OR_INERT | handler source |
| 302 | `v1/roster-schedule-optimizer/eligibility.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 303 | `v1/roster-schedule-optimizer/provider.ts` | POST | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | requireApiUser:12; E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0249,E0250,E0251,E0254,E0252,E0253,E0255,E0237,E0322 |
| 304 | `v1/roster-schedule-optimizer/schedule.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 305 | `v1/roster-schedule-optimizer/workspace.ts` | PUT,GET | user bearer/getUser | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | db.auth.admin.getUserById:26; requireApiUser:118; E0604,E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0605,E0606 |
| 306 | `v1/runs/[runId].ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 307 | `v1/runs/latest.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 308 | `v1/schedule/[startDate].ts` | * | public | HTTP | handler source; E0003 |
| 309 | `v1/schedule/date/[date].ts` | * | public | HTTP | handler source; E0003 |
| 310 | `v1/season.ts` | GET | public | HTTP | handler source; E0003 |
| 311 | `v1/social-share/[format].ts` | GET | public | HTTP | handler source; E0003 |
| 312 | `v1/sources/ifttt/DFOFantasy-tweet.ts` | * | factory shared receiver secret (constant-time); intake policy | HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | lib/sources/lineSourceIftttReceiver:1; E0325,E0328,E0329,E0327 |
| 313 | `v1/sources/ifttt/NHL-Rosters-tweet.ts` | * | factory shared receiver secret (constant-time); intake policy | HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | lib/sources/lineSourceIftttReceiver:1; E0325,E0328,E0329,E0327 |
| 314 | `v1/sources/ifttt/ccc-tweet.ts` | * | factory shared receiver secret (constant-time); intake policy | HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | lib/sources/lineSourceIftttReceiver:1; E0325,E0328,E0329,E0327 |
| 315 | `v1/sources/ifttt/gamedaygoalies-tweet.ts` | * | factory shared receiver secret (constant-time); intake policy | HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | lib/sources/lineSourceIftttReceiver:1; E0325,E0328,E0329,E0327 |
| 316 | `v1/sources/ifttt/gamedaylines-tweet.ts` | * | factory shared receiver secret (constant-time); intake policy | HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | lib/sources/lineSourceIftttReceiver:1; E0325,E0328,E0329,E0327 |
| 317 | `v1/sources/ifttt/gamedaynewsnhl-tweet.ts` | * | factory shared receiver secret (constant-time); intake policy | HTTP,RPC_DYNAMIC_EFFECT_UNKNOWN,WRITE | lib/sources/lineSourceIftttReceiver:1; E0325,E0328,E0329,E0327 |
| 318 | `v1/splits/index.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 319 | `v1/start-chart.ts` | GET,POST | public | READ_RPC | handler source; E0322,E0292,E0607,E0608 |
| 320 | `v1/sustainability/coverage-audit.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 321 | `v1/sustainability/entity-bands.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 322 | `v1/sustainability/entity-history.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 323 | `v1/sustainability/entity-options.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 324 | `v1/sustainability/entity-scores.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 325 | `v1/sustainability/leaderboard.ts` | GET | public aggregate; admin/cron components branch | READ/LOCAL_OR_INERT | adminOnly:124; handleAuthorizedComponents:138 |
| 326 | `v1/sustainability/player/[playerId].ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 327 | `v1/sustainability/process-recompute-queue.ts` | POST | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,RPC_NAMED_DISPATCH,WRITE | adminOnly:175; E0012,E0365,E0364,E0613,E0614,E0006,E0007,E0609,E0362,E0363,E0367,E0366,E0358,E0360,E0361 |
| 328 | `v1/sustainability/rebuild-priors.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:147; E0012,E0613,E0614,E0006,E0007,E0362,E0363 |
| 329 | `v1/sustainability/rebuild-score.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:316; E0012,E0613,E0614,E0006,E0007,E0366,E0358 |
| 330 | `v1/sustainability/rebuild-trend-bands.ts` | POST,GET | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,WRITE | adminOnly:299; E0012,E0360,E0361 |
| 331 | `v1/sustainability/rebuild-window-z.ts` | * | admin role OR cron; loopback development exception; A! unauthenticated audit insert (F2) | AUDIT_WRITE_PUBLIC,HTTP,WRITE | adminOnly:152; E0012,E0613,E0614,E0006,E0007,E0367 |
| 332 | `v1/sustainability/recompute.ts` | POST | admin role OR cron; loopback development exception | WRITE | adminOnly:74; E0359 |
| 333 | `v1/sustainability/trend-bands.ts` | GET,POST | public reads; admin/cron recompute branch | WRITE | adminOnly:134; handleAuthorizedRecompute:142; E0360 |
| 334 | `v1/sustainability/trends.ts` | * | public | READ/LOCAL_OR_INERT | handler source |
| 335 | `v1/sustainability/upcoming/[playerId].ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 336 | `v1/team/[seasonId]/index.ts` | * | public | HTTP | handler source; E0003 |
| 337 | `v1/transactions/ownership-snapshots.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 338 | `v1/transactions/ownership-trends.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 339 | `v1/trends/goalie-power.ts` | GET | public | HTTP | handler source; E0613,E0614,E0006,E0007 |
| 340 | `v1/trends/player-trends.ts` | POST,GET | public GET; constant-time cron bearer POST | HTTP,WRITE | handler source; E0613,E0614,E0006,E0007,E0610 |
| 341 | `v1/trends/skater-power.ts` | GET | public | HTTP | handler source; E0613,E0614,E0006,E0007 |
| 342 | `v1/trends/team-ctpi.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 343 | `v1/trends/team-power.ts` | GET | public | HTTP | handler source; E0613,E0614,E0006,E0007 |
| 344 | `v1/trends/team-sos.ts` | GET | public | HTTP | handler source; E0613,E0614,E0006,E0007 |
| 345 | `v1/underlying-stats/goalies.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 346 | `v1/underlying-stats/goalies/[playerId].ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 347 | `v1/underlying-stats/goalies/[playerId]/chart.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 348 | `v1/underlying-stats/players.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 349 | `v1/underlying-stats/players/[playerId].ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 350 | `v1/underlying-stats/players/[playerId]/chart.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 351 | `v1/underlying-stats/route-status.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 352 | `v1/underlying-stats/teams.ts` | GET | public | HTTP | handler source; E0370 |
| 353 | `v1/underlying-stats/xg.ts` | GET | public | READ/LOCAL_OR_INERT | handler source |
| 354 | `v1/webhooks/on-new-line-combo.ts` | * | admin role OR cron; loopback development exception | HTTP,WRITE | adminOnly:25; E0611,E0612 |
| 355 | `v1/webhooks/patreon.ts` | POST | raw-body Patreon HMAC signature | HTTP,READ_RPC,RPC_NAMED_DISPATCH,WRITE | verifyPatreonWebhookSignature:35; E0160,E0174,E0168,E0173,E0158,E0163,E0159,E0164,E0165,E0166,E0167,E0170,E0169,E0175,E0179,E0180,E0181,E0182 |
| 356 | `v1/webhooks/stripe.ts` | POST | raw-body Stripe signature | PROVIDER_SDK,RPC_NAMED_DISPATCH | handler source; E0193,E0191,E0192,E0194,E0195,E0196 |
| 357 | `v1/xg/operations.ts` | * | admin role OR cron; loopback development exception | READ/LOCAL_OR_INERT | adminOnly:176 |
