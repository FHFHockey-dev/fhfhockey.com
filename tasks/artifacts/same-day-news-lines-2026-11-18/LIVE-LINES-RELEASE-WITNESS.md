# Lines release witness, November 19, 2026

**Three-context acceptance remains open.** At 19:23 UTC the 33 scheduled games examined had 68 stored claim revisions, zero in-game revisions of any kind, and zero carried selections among 132 latest PP decisions. Seventeen team entries had reached a frozen or corrected state. All seventeen contained zero selected units. The cohort includes games scheduled later on November 19.

## Anaheim’s consecutive games

| Evidence | Calgary at Anaheim, November 15 | Anaheim at St. Louis, November 17 |
| --- | --- | --- |
| Team and game | ANA 24, 2026020328 | ANA 24, 2026020339 |
| Following scheduled ANA game | 2026020339 | 2026020356 |
| Original pregame lineup | Eight accepted pregame claim revisions from Zach Cavanagh. Stored original publication time 2026-11-16 00:37:13 UTC. | Zero stored claim revisions. |
| Latest frozen entry | Revision 2, cutoff 2026-11-16 01:32:13.658 UTC, zero units. | Revision 2, cutoff 2026-11-18 03:45:16.175 UTC, zero units. |
| Frozen entry ID | `552f93be822d4faf5137c582d027030e64dfeae5b142f080f935f59e2d0f3910` | `c5e754581c21c754a4273c461343536e3cb62056786f16f87f7a37c27d49ff10` |
| Stored entry selector | `2026-10-02.2` | `2026-10-02.2` |
| PP1 and PP2 | Both latest decisions are revision 1 with reason “No applicable PP evidence”, no designation and no origin game. | Both latest decisions are revision 1 with the same reason, no designation and no origin game. |

The Anaheim original is an authentic pregame source. Its historical freeze and the following game provide a negative control for the PP path. A positive witness still requires a populated entering lineup, a naturally accepted post-cutoff PP change for that game, and the originating game and unit displayed on the following game. [Original post](https://x.com/ZachCav/status/2122126809533923555) · [Previously retained raw and serving evidence](READ-ONLY-EVIDENCE.json) · [Acceptance record and historical freeze diagnosis](PARENT-ACCEPTANCE.md)

## Normal reader

The team component requests the following exact-game GETs for the two Anaheim selections. These are prospective read-only URLs for the release owner. No application request was made in this discovery.

```text
https://fhfhockey.com/api/v1/lines/projected?view=game&teamId=24&gameId=2026020328
https://fhfhockey.com/api/v1/lines/projected?view=game&teamId=24&gameId=2026020339
```

The last recorded production team GET, on November 18, returned HTTP 200 in legacy mode with one report and zero unit sets. That serving observation and the historical entry selector are separate facts. The November 19 SQL reads establish the stored data only. A positive manager-visible witness additionally requires a serving configuration that exposes snapshot entry, in-game observations and carried PP units. The exact-game GET performs no database writes. The snapshot reader may consult NHL state if the stored observation is stale. [Earlier team GET](READ-ONLY-EVIDENCE.json) · [Component](../../../web/components/LineCombinations/ProjectedLineups.tsx) · [Route](../../../web/pages/api/v1/lines/projected.ts) · [Reader](../../../web/lib/lines/service.ts)

## Read scope

Three sequential production SELECTs consumed three of the five authorized query attempts. Application requests and production mutations were both zero.

1. Read schedule IDs between 2026020320 and 2026020390 restricted to November 15–19, inclusive. The matching 33 games covered 2026020326–2026020358. Used the team/game claim index and game/team/unit/revision PP index to count phase, acceptance and latest designation for both sides of each game. All 68 revisions were outside the in-game phase. All 132 latest decisions lacked a carried designation.
2. Read the latest entry revision by game and team for the same schedule. Counted stored frozen/corrected entries and positive unit counts. Seventeen matched the state filter, zero had units, and the populated-entry sample was empty.
3. Read exact game/team entry, claim and PP rows for Anaheim 0328 and 0339. Verified consecutive game ordering from the bounded schedule ID range 2026020320–2026020420. The table above transcribes the projected rows.

The previous November 18 receipt also found zero accepted in-game claims and zero carried selections for the earlier regular-season ID ranges through 2026020355. No public read, state change or simulated source was used to fill the remaining three-context proof. [Previous receipt](READ-ONLY-EVIDENCE.json)

## Anaheim exact-game response after release

The release owner supplied the public CGY–ANA response for game 2026020328. It contained five reports and zero complete unit sets. Two records from interpretation `2026-11-06.1` assigned Anaheim and Sunday’s game to injury exits. Bo Horvat’s report (`72878a3ccb14…`) and Logan Stanley’s report (`ab60867ee60e…`) both explicitly name Anaheim as the opponent in **Saturday’s** game. Neither included an event, a unit or an original URL. Both had reported certainty. The erroneous manager-facing claim was the team and game label. [Captured game and five report rows](ANA-RELEASE-REPORTS.json)

The local corrective candidate retains both source texts and clocks, clears their subject and game IDs and shows “Subject team unverified” and “No verified game for this report.” Producer review also rejects a proposed assignment when that team is the named opponent, the weekday differs, or the named opponent contradicts the two scheduled teams. The applicable scope is a standalone dated injury exit. Independently scoped current reports remain eligible.

Replaying the exact response preserved the Anaheim club post, Zach Cavanagh’s seven warm-up units and the prospective Ian Moore report against Calgary. Separate producer controls retained a matching weekday and opponent, removed the wrong game while preserving a roster-supported subject and retained the literal source in rejected rows. The saved four-forward-line/three-defense-pair report contains an incomplete forward unit, so no complete set was added. No new production request accompanied this corrective work.

## First live pregame snapshot after enablement

At 20:26:50 UTC on November 19 the public default team reader selected DAL at VGK, game `2026020358`. Vegas revision 2, `cb6367dc7275e733c09d6f13ece3ece23fa561607d997a238d382615e5ffe4fc`, was an expected lineup. Its source reported one forward line (Brett Howden, Jack Eichel, Mark Stone) and two defense pairs (Brayden McNabb with Shea Theodore, Jeremy Lauzon with Rasmus Andersson). The original was published at 19:01:28 UTC. The public response had zero in-game observations and two empty PP selections. The released React component rendered the game selector, expected-game heading, all seven names, the original author link and publication clock from that exact response in an isolated DOM. [Public default reader](https://fhfhockey.com/api/v1/lines/projected?view=game&teamId=54) · [Original SinBinVegas report](https://x.com/SinBinVegas/status/2123491866368999913)

The initial storage check covered the November 19 slate (12 games, first start 00:00 UTC November 20). Vegas plays Dallas at 03:00 UTC November 20 and next plays game `2026020369` at 00:00 UTC November 22. Earlier games remain eligible if their evidence arrives. This chat owns the first genuine chain with a populated entering lineup, its separately timestamped in-game PP change, and the following scheduled game showing the same accepted unit and source as carried. The parent is open.

## Ottawa–Philadelphia, period one

NHL Gamecenter and the official on-ice report agree on complete 5-on-4 personnel for game `2026020348`. At 16:43 elapsed Ottawa went from Pinto, Stützle, Halliday, Batherson and Sanderson at the stoppage (event 21) to Cozens, Greig, Giroux, Spence and Chabot at the faceoff (event 398). Event 408 at 17:39 also shows the latter five. On Philadelphia’s second power play, Dvorak, Konecny, Foerster, Tippett and Bonk were on together at 18:13 and 18:25 (events 421 and 422). NHL supplies the on-ice personnel and game clock. The records supply no PP1 or PP2 designation or claim that the coach changed a future default. [Official event report](https://www.nhl.com/scores/htmlreports/20262027/PL020348.HTM) · [Saved game and consumer receipt](OTT-PHI-2026020348-LIVE-PP.json)

The public Ottawa reader at 00:42:23 UTC and again at 00:44:11 UTC returned the same four entering units from SunGarrioch’s 23:42 UTC post, zero updates and empty PP1 and PP2. The latest NHL game clock read 00:00 remaining in period one at 00:44:13 UTC. Both teams had zero stored in-game or PP claims in both checks. The original four units and source survived the refresh, but the read-time freeze cutoff and entry ID changed with the request time. Storage still held an expected revision. At 00:43:16 UTC Ottawa’s immediately following game, LAK at OTT `2026020366`, had two empty PP slots. The released component rendered the entering lineup, source time and empty PP labels from these two public responses. This establishes a real on-ice change and an open producer-to-reader gap. This chat retains the first accepted numbered change, stable entering lineup and next-game carry verification.

## Local repair and readback

The official on-ice report stopped before the Lines reader, which read NHL game state and tweet claims. A separate read-time freeze used the request’s NHL check time when the actual start was unknown. Both failure modes reproduced offline using the November 19 receipt.

Local candidate `5babd77c191b0043e96411d6ebeacd10d722619e` verified all seven receipt events. The complete retained 98-play response and HTML report yielded 13 corroborated events (eight Ottawa, five Philadelphia). Replaying both full Ottawa API responses through the candidate reader and renderer showed the same four pregame units under revision `2c07dc826365` with the same source, a null cutoff, and the original-unrecorded label. The retained NHL five-skater changes appeared in the updates sidebar, with event links and elapsed game clocks. Next game 0366 had zero official observations and two empty PP decisions. In a separate isolated store the writer froze an entry and reconciled it again after a later accepted in-game report. The complete original entry survived the next read.

A synthetic, qualified PP1 in game 2026010001 carried to 2026010002 with the same players, original post and timestamp. A newer qualified next-game report replaced it in the public reader and component. Parent acceptance still requires the equivalent real numbered report and next-game readback after release. [Local before/after readback](OTT-PHI-2026020348-LOCAL-READBACK.json)

## Production verification of the Ottawa repair

At 2026-11-20T01:26:21.465Z and 2026-11-20T01:27:22.960Z, the production game page and its automatic refresh rendered all seven retained events with the verified five player IDs and names, NHL links, game clocks and “Observed power play · unit not specified.” The refreshed sidebar had 9 Ottawa events and 7 Philadelphia events. Ottawa’s four pregame units, source and complete unit-content hash stayed identical. Revision `2c07dc8263654167d026a3b9d3d7b96133bd428a66e8d1e97fe5d5630a337ef8` and its null cutoff stayed identical across the two API responses. The page explicitly said the original was unrecorded. Both clubs’ PP1 and PP2 slots were empty. [Production browser and API receipt](OTT-PHI-2026020348-PRODUCTION-READBACK.json)
