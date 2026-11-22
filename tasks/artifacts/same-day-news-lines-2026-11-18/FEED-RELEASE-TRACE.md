# Historical feed release trace

November 19, 2026. Exact readback from the FHFH production database found **77 individually addressed posts** in failed foreign-key audits. Every one still has a failed intake receipt. The underlying source snapshots survived for all 77. Readback found no forecast child of the constraint’s type at any of their 77 exact retained source keys.

The November shipping checklist’s 153 observations have no individual identifiers, incident time bounds, grouping rule, or originating query in the retained checklist text. It is possible to identify these 77 failed request targets independently. Their overlap with the stated 153 remains unknown, so subtracting 77 from 153 would give an unsupported outstanding count. [Shipping source crosswalk, row 201](../../shipping-master-2026-11-18/SOURCE-CROSSWALK.md)

## Addressable foreign-key failures

| Processor and constraint | Failed audits | Individually addressed posts | Other audit attempts | Exact-key disposition on Nov 19 |
| --- | ---: | ---: | ---: | --- |
| Generic goalie | 190 | 27 | 163 | 27 failed receipts, 27 accepted game-bound parents, 0 goalie children |
| Generic lineup | 313 | 45 | 268 | 45 failed receipts, 45 accepted game-bound parents, 0 lineup children |
| CCC goalie | 23 | 3 | 20 | 3 failed receipts, 3 accepted game-bound CCC rows, 0 generic parents, 0 forecast children |
| CCC lineup | 16 | 2 | 14 | 2 failed receipts, 2 accepted game-bound CCC rows, 0 generic parents, 0 forecast children |
| **Total** | **542** | **77** | **465** | **77 distinct post IDs** |

The first named failure was September 26, the last October 4. Earlier bounded counts covered September 19 through October 6 inclusive UTC. This readback reproduced all 542 in the narrower September 26–October 4 window. It extracted the explicit numeric `tweetId` from each retained failure’s request and restricted the constraint to the two exact names in the prior receipt. None carried an explicit event ID or capture key in the request. The historical route code at local commit `26f04ef88f` restricts its event query to that tweet ID when supplied. Untargeted batch attempts may include retries. [Retained audit counts and constraint names](READ-ONLY-EVIDENCE.json)

For each generic target, the original source key and tweet ID identify the failed queue receipt and the observed, NHL-accepted source snapshot. Its current stored capture key is the exact lookup in the forecast table named by the failing constraint. For each CCC target, the archived CCC tweet ID identifies its accepted snapshot and queue receipt. All five had zero generic source parents by tweet ID, zero generic parents equal to the CCC capture key, and zero goalie or lineup children carrying that key. Both historical forecast constraints reference the generic parent table. The audits do not record the rejected value submitted to the FK. Consequently the table below establishes present linkage at the **stored source key**. It cannot identify a different rejected insertion value from the error text, or establish what a differently keyed report about the same player/game contains. [Forecast schema](../../../supabase/migrations/20260802163747_add_player_forecast_foundation.sql)

Across the full September 19–October 6 receipt window, all 594 CCC and 1,267 generic receipts had an exact ingest job. At readback 10 CCC receipts and 100 generic receipts were failed, while 10 CCC jobs and 102 generic jobs were failed. Neither FK name appeared in any of these 1,861 receipt or linked job payloads. The job and receipt populations therefore add no exact membership rule for the historical 153.

## CCC timeout

The audit recorded on October 4 at 02:07:21.895466 UTC was the `cccmiddleton` batch request for **October 3**, with `currentDayOnly=true` and `limit=5`. Its retained response records a start at 02:07:09.227, end at 02:07:21.882 and 12,655 ms elapsed. The response contains the abort error and timing only, and the request has no tweet or event ID. Zero CCC receipts in the inspected window were received during those 12.655 seconds. Zero retain a last-update timestamp inside that interval. Earlier pending events remain possible. The 02:08:09.955756 run loaded zero events. The goalie FK error at 02:09:13.731220 was a separate request. No identified post can be assigned either recovery or loss from that timeout. [Audit readback](READ-ONLY-EVIDENCE.json)

The October 4 operator briefing covers the timeout window and supplies no matching CCC event or child key. The October 5 briefings contain later, separately dated source requests. The previously cited November 9 and November 18 briefings concern their own later windows. The inspected briefings supply no original 153-member manifest. No tokenized links were opened. [Oct 4 briefing](https://mail.google.com/mail/u/0/#all/1a107a15c2ac384d) · [Oct 5 morning](https://mail.google.com/mail/u/0/#all/1a10c2768c37f68f) · [Oct 5 afternoon](https://mail.google.com/mail/u/0/#all/1a10debeb388e203) · [Nov 9](https://mail.google.com/mail/u/0/#all/1a1c06673e4e4044) · [Nov 18](https://mail.google.com/mail/u/0/#all/1a1eebf5eef83f39)

## Exact retained keys

Every row below had one individually addressed failure, a failed route-specific receipt, and an observed, game-bound source snapshot. The source key selects the generic queue account or the CCC route. The constraint column names the missing forecast child type. Timestamps and IDs are metadata only. The five read-only SQL transactions used indexed audit times, queue arrival intervals, ingest job keys, post IDs and capture keys. No application request, replay, or data mutation was performed.

| Failing audit UTC | Source key | Constraint | Requested tweet ID | Source snapshot capture key |
| --- | --- | --- | --- | --- |
| 2026-09-26 15:13:33.204207 | gamedaynewsnhl | lineup | `2103865031339209166` | `gamedaynewsnhl:2026-09-26:4:2026010057:2103865031339209166:no-quoted-tweet:injury:accepted` |
| 2026-09-26 15:15:41.269912 | gamedaylines | lineup | `2103865112079614015` | `gamedaylines:2026-09-26:16:2026010058:2103865112079614015:no-quoted-tweet:practice_lines:accepted` |
| 2026-09-26 15:58:50.045124 | gamedaynewsnhl | lineup | `2103875538498494896` | `gamedaynewsnhl:2026-09-26:17:2026010061:2103875538498494896:no-quoted-tweet:injury:accepted` |
| 2026-09-26 16:14:14.738035 | ccc | goalie | `2103878503502692695` | `2026-09-26:1:2026010062:2103878503502692695:no-quoted-tweet:goalie_start:accepted` |
| 2026-09-26 16:54:45.572292 | ccc | lineup | `2103890489208606907` | `2026-09-26:16:2026010058:2103890489208606907:no-quoted-tweet:goalie_start:accepted` |
| 2026-09-26 17:08:32.359862 | gamedaynewsnhl | lineup | `2103893670134964698` | `gamedaynewsnhl:2026-09-26:55:2026010056:2103893670134964698:no-quoted-tweet:injury:accepted` |
| 2026-09-26 17:10:29.69406 | gamedaylines | lineup | `2103893890046529884` | `gamedaylines:2026-09-26:19:2026010058:2103893890046529884:no-quoted-tweet:lineup:accepted` |
| 2026-09-27 00:13:30.949284 | gamedaynewsnhl | lineup | `2104000286625046601` | `gamedaynewsnhl:2026-09-26:19:2026010058:2104000286625046601:no-quoted-tweet:injury:accepted` |
| 2026-09-27 02:00:37.09975 | gamedaylines | lineup | `2104026202361221394` | `gamedaylines:2026-09-26:54:2026010063:2104026202361221394:no-quoted-tweet:lineup:accepted` |
| 2026-09-29 15:27:41.18436 | gamedaygoalies | goalie | `2104955729492746276` | `gamedaygoalies:2026-09-29:6:2026020003:2104955729492746276:no-quoted-tweet:goalie_start:accepted` |
| 2026-09-29 18:57:36.955733 | gamedaygoalies | goalie | `2105006919736062113` | `gamedaygoalies:2026-09-29:12:2026020001:2105006919736062113:no-quoted-tweet:goalie_start:accepted` |
| 2026-09-29 20:40:48.935203 | gamedaylines | lineup | `2105033993959960713` | `gamedaylines:2026-09-29:13:2026020001:2105033993959960713:no-quoted-tweet:lineup:accepted` |
| 2026-09-29 20:40:51.05305 | gamedaylines | lineup | `2105034043142353150` | `gamedaylines:2026-09-29:12:2026020001:2105034043142353150:no-quoted-tweet:lineup:accepted` |
| 2026-09-29 22:50:47.634685 | gamedaylines | lineup | `2105065746829332633` | `gamedaylines:2026-09-29:8:2026020002:2105065746829332633:no-quoted-tweet:lineup:accepted` |
| 2026-09-29 23:19:28.488082 | ccc | lineup | `2105073059585802244` | `2026-09-29:8:2026020002:2105073059585802244:no-quoted-tweet:lineup:accepted` |
| 2026-09-30 02:20:27.368261 | gamedaylines | lineup | `2105118565255012517` | `gamedaylines:2026-09-29:54:2026020005:2105118565255012517:no-quoted-tweet:lineup:accepted` |
| 2026-09-30 02:20:29.478428 | gamedaylines | lineup | `2105119056982647090` | `gamedaylines:2026-09-29:16:2026020005:2105119056982647090:no-quoted-tweet:lineup:accepted` |
| 2026-09-30 16:37:41.469702 | gamedaygoalies | goalie | `2105336203209740607` | `gamedaygoalies:2026-09-30:4:2026020006:2105336203209740607:no-quoted-tweet:goalie_start:accepted` |
| 2026-09-30 19:22:15.14866 | gamedaygoalies | goalie | `2105376823538553185` | `gamedaygoalies:2026-09-30:10:2026020008:2105376823538553185:no-quoted-tweet:goalie_start:accepted` |
| 2026-09-30 23:00:59.577305 | gamedaylines | lineup | `2105432545181814840` | `gamedaylines:2026-09-30:4:2026020006:2105432545181814840:no-quoted-tweet:lineup:accepted` |
| 2026-09-30 23:08:32.9487 | gamedaynewsnhl | lineup | `2105434518731767962` | `gamedaynewsnhl:2026-09-30:10:2026020008:2105434518731767962:no-quoted-tweet:injury:accepted` |
| 2026-09-30 23:17:42.601098 | gamedaygoalies | lineup | `2105434836500680857` | `gamedaygoalies:2026-09-30:2:2026020008:2105434836500680857:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-01 02:00:57.734633 | gamedaylines | lineup | `2105476593967894778` | `gamedaylines:2026-09-30:26:2026020007:2105476593967894778:no-quoted-tweet:practice_lines:accepted` |
| 2026-10-01 02:00:59.160982 | gamedaylines | lineup | `2105476662435700924` | `gamedaylines:2026-09-30:21:2026020007:2105476662435700924:no-quoted-tweet:lineup:accepted` |
| 2026-10-01 14:17:44.327586 | gamedaygoalies | goalie | `2105661893075775594` | `gamedaygoalies:2026-10-01:18:2026020012:2105661893075775594:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-01 15:17:19.540756 | gamedaygoalies | goalie | `2105677981725176043` | `gamedaygoalies:2026-10-01:1:2026020009:2105677981725176043:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-01 15:18:47.717926 | gamedaynewsnhl | lineup | `2105677563263648037` | `gamedaynewsnhl:2026-10-01:29:2026020011:2105677563263648037:no-quoted-tweet:injury:accepted` |
| 2026-10-01 15:39:41.679331 | ccc | goalie | `2105682952919408641` | `2026-10-01:7:2026020011:2105682952919408641:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-01 17:17:42.023687 | gamedaygoalies | goalie | `2105707862475358442` | `gamedaygoalies:2026-10-01:4:2026020009:2105707862475358442:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-01 17:50:27.21847 | gamedaylines | lineup | `2105716220863607238` | `gamedaylines:2026-10-01:20:2026020014:2105716220863607238:no-quoted-tweet:lineup:accepted` |
| 2026-10-01 18:12:38.419436 | gamedaygoalies | goalie | `2105720555399794884` | `gamedaygoalies:2026-10-01:23:2026020015:2105720555399794884:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-01 18:58:37.719488 | gamedaynewsnhl | lineup | `2105732136569598129` | `gamedaynewsnhl:2026-10-01:20:2026020014:2105732136569598129:no-quoted-tweet:other:accepted` |
| 2026-10-01 20:37:23.276049 | gamedaygoalies | goalie | `2105757714790179099` | `gamedaygoalies:2026-10-01:4:2026020009:2105757714790179099:no-quoted-tweet:lineup:accepted` |
| 2026-10-01 22:40:41.526253 | gamedaylines | lineup | `2105788740782424500` | `gamedaylines:2026-10-01:4:2026020009:2105788740782424500:no-quoted-tweet:lineup:accepted` |
| 2026-10-01 22:45:36.542159 | gamedaylines | lineup | `2105791155669807376` | `gamedaylines:2026-10-01:29:2026020011:2105791155669807376:no-quoted-tweet:lineup:accepted` |
| 2026-10-01 22:50:17.399825 | gamedaylines | lineup | `2105791255737491820` | `gamedaylines:2026-10-01:7:2026020011:2105791255737491820:no-quoted-tweet:lineup:accepted` |
| 2026-10-02 00:55:41.344275 | gamedaylines | lineup | `2105821556807209276` | `gamedaylines:2026-10-01:55:2026020014:2105821556807209276:no-quoted-tweet:injury:accepted` |
| 2026-10-02 01:45:39.180549 | gamedaylines | lineup | `2105835375021408669` | `gamedaylines:2026-10-01:13:2026020016:2105835375021408669:no-quoted-tweet:lineup:accepted` |
| 2026-10-02 02:28:18.840172 | gamedaynewsnhl | lineup | `2105844979855958093` | `gamedaynewsnhl:2026-10-01:28:2026020016:2105844979855958093:no-quoted-tweet:injury:accepted` |
| 2026-10-02 15:50:26.481755 | gamedaylines | lineup | `2106049042744496310` | `gamedaylines:2026-10-02:52:2026020019:2106049042744496310:no-quoted-tweet:lineup:accepted` |
| 2026-10-02 19:53:11.466389 | gamedaynewsnhl | lineup | `2106109464189587773` | `gamedaynewsnhl:2026-10-02:24:2026020021:2106109464189587773:no-quoted-tweet:injury:accepted` |
| 2026-10-02 22:10:08.997864 | gamedaylines | lineup | `2106144199876002014` | `gamedaylines:2026-10-02:3:2026020017:2106144199876002014:no-quoted-tweet:lineup:accepted` |
| 2026-10-02 22:15:20.466949 | gamedaylines | lineup | `2106145378148196402` | `gamedaylines:2026-10-02:17:2026020017:2106145378148196402:no-quoted-tweet:lineup:accepted` |
| 2026-10-02 22:50:24.800211 | gamedaylines | lineup | `2106153758392729785` | `gamedaylines:2026-10-02:12:2026020018:2106153758392729785:no-quoted-tweet:practice_lines:accepted` |
| 2026-10-02 23:45:33.905368 | gamedaylines | lineup | `2106167259790217602` | `gamedaylines:2026-10-02:6:2026020019:2106167259790217602:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 00:50:40.577131 | gamedaylines | lineup | `2106183648278122913` | `gamedaylines:2026-10-02:25:2026020020:2106183648278122913:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 00:50:41.891976 | gamedaylines | lineup | `2106183752665976891` | `gamedaylines:2026-10-02:19:2026020020:2106183752665976891:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 01:40:27.861563 | gamedaylines | lineup | `2106197065705664845` | `gamedaylines:2026-10-02:24:2026020021:2106197065705664845:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 01:40:29.580146 | gamedaylines | lineup | `2106197148618703291` | `gamedaylines:2026-10-02:54:2026020021:2106197148618703291:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 14:32:28.152718 | gamedaygoalies | goalie | `2106390664376123662` | `gamedaygoalies:2026-10-03:10:2026020023:2106390664376123662:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 14:52:19.596043 | gamedaygoalies | goalie | `2106396234885796184` | `gamedaygoalies:2026-10-03:14:2026020024:2106396234885796184:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 15:02:23.860608 | gamedaygoalies | goalie | `2106398280280056180` | `gamedaygoalies:2026-10-03:4:2026020025:2106398280280056180:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 15:32:52.56597 | gamedaygoalies | goalie | `2106406595219300858` | `gamedaygoalies:2026-10-03:4:2026020025:2106406595219300858:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 15:57:36.770076 | gamedaygoalies | goalie | `2106411404651590072` | `gamedaygoalies:2026-10-03:1:2026020029:2106411404651590072:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 16:03:23.984768 | gamedaynewsnhl | goalie | `2106413941052035533` | `gamedaynewsnhl:2026-10-03:30:2026020031:2106413941052035533:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 16:07:39.853269 | gamedaygoalies | goalie | `2106414161848594666` | `gamedaygoalies:2026-10-03:8:2026020026:2106414161848594666:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 16:37:44.459256 | gamedaygoalies | goalie | `2106421525188313572` | `gamedaygoalies:2026-10-03:21:2026020032:2106421525188313572:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 17:57:50.824423 | gamedaygoalies | goalie | `2106442479579148472` | `gamedaygoalies:2026-10-03:23:2026020033:2106442479579148472:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 18:08:28.839362 | gamedaynewsnhl | lineup | `2106445683683459505` | `gamedaynewsnhl:2026-10-03:21:2026020032:2106445683683459505:no-quoted-tweet:injury:accepted` |
| 2026-10-03 18:40:32.104129 | gamedaylines | lineup | `2106452811454296197` | `gamedaylines:2026-10-03:20:2026020033:2106452811454296197:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 19:28:28.55707 | gamedaynewsnhl | lineup | `2106465084059140377` | `gamedaynewsnhl:2026-10-03:20:2026020033:2106465084059140377:no-quoted-tweet:other:accepted` |
| 2026-10-03 21:12:41.12072 | gamedaygoalies | goalie | `2106490815807906240` | `gamedaygoalies:2026-10-03:12:2026020025:2106490815807906240:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 21:12:42.505345 | gamedaygoalies | goalie | `2106491236270121277` | `gamedaygoalies:2026-10-03:15:2026020024:2106491236270121277:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 22:32:30.762597 | gamedaygoalies | goalie | `2106512134821863551` | `gamedaygoalies:2026-10-03:14:2026020024:2106512134821863551:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 22:37:47.76963 | gamedaygoalies | goalie | `2106512631066706329` | `gamedaygoalies:2026-10-03:68:2026020027:2106512631066706329:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 22:38:00.959043 | gamedaygoalies | goalie | `2106512780585255116` | `gamedaygoalies:2026-10-03:5:2026020026:2106512780585255116:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 22:42:14.936085 | gamedaygoalies | goalie | `2106514631309283484` | `gamedaygoalies:2026-10-03:22:2026020028:2106514631309283484:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 22:45:28.393262 | gamedaylines | lineup | `2106513918432801262` | `gamedaylines:2026-10-03:4:2026020025:2106513918432801262:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 22:45:34.117421 | gamedaylines | lineup | `2106514270209069292` | `gamedaylines:2026-10-03:16:2026020022:2106514270209069292:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 22:50:09.155976 | gamedaylines | goalie | `2106515990184141290` | `gamedaylines:2026-10-03:10:2026020023:2106515990184141290:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 23:02:54.38796 | gamedaygoalies | goalie | `2106519700104724514` | `gamedaygoalies:2026-10-03:1:2026020029:2106519700104724514:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-03 23:15:42.742971 | gamedaylines | lineup | `2106521374043017686` | `gamedaylines:2026-10-03:2:2026020029:2106521374043017686:no-quoted-tweet:lineup:accepted` |
| 2026-10-03 23:46:02.547516 | gamedaylines | lineup | `2106529487513063428` | `gamedaylines:2026-10-03:6:2026020031:2106529487513063428:no-quoted-tweet:lineup:accepted` |
| 2026-10-04 01:45:28.931392 | gamedaylines | lineup | `2106559405223469454` | `gamedaylines:2026-10-03:28:2026020034:2106559405223469454:no-quoted-tweet:lineup:accepted` |
| 2026-10-04 01:59:52.842469 | ccc | goalie | `2106563803236470909` | `2026-10-03:68:2026020027:2106563803236470909:no-quoted-tweet:goalie_start:accepted` |
| 2026-10-04 02:01:10.886935 | gamedaylines | lineup | `2106562871866146985` | `gamedaylines:2026-10-03:23:2026020033:2106562871866146985:no-quoted-tweet:lineup:accepted` |
| 2026-10-04 17:00:47.849972 | gamedaylines | goalie | `2106789087659343975` | `gamedaylines:2026-10-04:17:2026020035:2106789087659343975:no-quoted-tweet:lineup:accepted` |

## November 19 feed window

The 08:00 EST operations briefing counted 697 of 718 settled poller starts with a result, an eight-minute maximum gap, and 142/142 eligible sightings queued once across the six accounts. The account read denominator was 699 poller results. An independent time-bounded SQL read found the same 21 unmatched starts. The later stored view had 719 settled starts and 699 distinct response bodies. The two denominators are recorded separately. [November 19 operations briefing](https://mail.google.com/mail/u/0/#all/1a1f3e5bbb6ef1fa)

The following counts cover distinct source posts first seen from Nov 18 13:00:48 to Nov 19 13:00:48 UTC. Each post matched one queue event and had a retained source snapshot. The player, team and game columns count any corresponding snapshot binding. A projection match requires an exact relay or original post ID in report provenance for report dates Nov 16–19. Published News matches use those IDs against the stored card source. Multiple relays can match the same original. A published-card match alone does not verify its HTML.

| Source | Queued / seen | Read rate | Processed / rejected / failed | Accepted snapshots | Player / team / game bound | Matching projection / published News |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CCC | 30/30 | 88.5% | 8 / 18 / 4 | 12 | 13 / 13 / 9 | 12 / 4 |
| DFOFantasy | 40/40 | 86.4% | 31 / 9 / 0 | 31 | 31 / 31 / 13 | 31 / 5 |
| GameDayGoalies | 7/7 | 87.4% | 5 / 2 / 0 | 5 | 6 / 6 / 3 | 5 / 0 |
| GameDayLines | 23/23 | 89.1% | 18 / 5 / 0 | 18 | 18 / 18 / 3 | 18 / 9 |
| GameDayNewsNHL | 31/31 | 86.5% | 14 / 17 / 0 | 14 | 18 / 18 / 3 | 14 / 6 |
| NHL_Rosters | 11/11 | 87.4% | 9 / 2 / 0 | 9 | 8 / 9 / 3 | 9 / 5 |

The poller started jobs 254348, 254351, 254363, 254369, 254372, 254384, 254392, 254395, 254414, 254436, 254445, 254451, 254461, 254467, 254473, 254517, 254822, 254835, 254916, 255022 and 257249 without a retained response in the production briefing’s matching window. Twenty job snapshots said succeeded. Job 254517 retained a running status. These identify gaps in response capture. A per-request provider or transport receipt would be needed to assign a cause or a particular missing post. The six switched accounts have FxTwitter queue evidence for this window. Historical IFTTT post-level samples and downstream source-only outcomes are in [parent acceptance](PARENT-ACCEPTANCE.md).

## November 18 Colorado goalie conflict

Eight CCC batch attempts between 20:46:14.866986 and 21:00:15.353429 UTC failed against the same derived goalie key. The following four receipts had the identical 20:46:09.312151 UTC intake time. Each receipt and its exact ingest job was still failed on November 19 with eight attempts at `projection_storage`. All four had accepted raw source snapshots. Only the Colorado post is linked to the named conflict. The other three were in the exhausted batch.

| CCC tweet ID | Receipt ID | Team | Bound game | Quoted tweet ID |
| --- | --- | ---: | --- | --- |
| `2123155248898572633` | `6e84c1fb-e643-43d7-8a9f-9d4ef43bd6e8` | 8 | 2026020345 | `2123102198401990855` |
| `2123155392364720247` | `474e4e9c-6b18-4db6-984d-c6cb8b4bd0e1` | 68 | Unbound | `2123122964183097611` |
| `2123155518365831188` | `6c8dc7e7-6e76-4557-b9e5-0b8291e265ad` | 21 | 2026020346 | `2123128707800093023` |
| `2123155665040597451` | `5bf765ce-e92a-488f-895b-c8c5787520d1` | 1 | Unbound | `2123083757959700697` |

The original was [Corey Masisak’s post, 2123128707800093023](https://x.com/cmasisak22/status/2123128707800093023), published at 18:58:24.420 UTC. Both sources quote his tentative report that Mackenzie Blackwood looked like the Colorado starter in Utah. Both stored identical primary quoted text, identical enriched quoted text, the same interpretation version, and the same projected goalie event for player `8478406` in game `2026020346`. The persisted projection report selects the earlier DFO relay.

| Retained entity | Exact key |
| --- | --- |
| DFO source, observed 19:00:04.027199 UTC | `dfofantasy:2026-11-18:21:2026020346:2123128977002840404:2123128707800093023:goalie_start:accepted` |
| CCC source, observed 20:46:09.312151 UTC | `2026-11-18:21:2026020346:2123155518365831188:2123128707800093023:goalie_start:accepted` |
| Immutable projection report | `519ebab150555d24755407a167b89a2634832204a4c0ae022aedeb23ab177da2:21:2026-11-16.2` |
| Derived goalie source with one existing forecast observation | `519ebab150555d24755407a167b89a2634832204a4c0ae022aedeb23ab177da2:21:2026-11-16.2:goalie` |

The derived source’s embedded DFO snapshot matched the current retained DFO snapshot in **every JSON field**. The embedded report also matched the independent projection-report record. DFO’s wrapper gave the projected start and goalie stats. The later CCC wrapper said “Avalanche Starting Goalie: Mackenzie Blackwood.” The raw and enriched wrapper text differed, as did relay-specific attribution, URLs, metadata, and timestamps. These are two wrappers of a single original. After the shipped derivation applies its existing timestamp, source and attribution overrides, the conflicting top-level fields are `raw_text` and `enriched_text`. The existing child was already present. The failed CCC job does not establish a second goalie observation or a missing first one.

### Shipped behavior and local correction

At `c6eae4db5` the report key selects the original and the stored report selects the winning relay, but event storage builds the derived row from the current incoming wrapper. A local test loaded that exact shipped storage module with the two retained relay IDs, original ID, selected quote, player, team, game, publication and receipt times, and distinct wrapper wording. The fixture reconstructs the conflict and uses its own fingerprint. The key printed above is the exact production key. In either relay order, the shipped module rejected the second wrapper when a derived parent existed. When the first write was interrupted before parent creation, the shipped module instead stored the second wrapper text with the first relay’s provenance.

The local correction builds the complete event projection from the verified winning source snapshot and its immutable report. Retry order now preserves that source’s wrapper, interpretation, attribution, publication and receipt times. A different interpretation version gets its own derived key and lineage. Cross-relay equivalence requires a verified original and compatible publication time and game. The existing readback still rejects conflicting same-key provenance, interpretation, content, or scope. Three indexed production reads obtained the incident metadata. No four-job recovery, hosted replay or corrective deployment was performed in this trace.

If two **different interpretations** of the same original, team, game and revision contain incompatible starters or opposite explicit availability for one player, both immutable reports remain available for review. The public Lines reader preserves both source records and their game binding, labels the disagreement, and removes actionable events and units. The producer acknowledges the durable disagreement and suppresses the conflicting new claim. A later interpretation revision can supersede the disputed readings. Tests cover different named starters, a ruled-out starter, same-relay reprocessing, opposite availability, compatible wording and offsets, another named backup and a separate skater.

**Previously published forecast children remain a separate consumer limitation.** The local test verifies that a later conflict leaves the first forecast child untouched. No withdrawal or rejection is written to that record. For example, Social Share’s goalie inventory reads accepted observations by game and cutoff without consulting projection-report disagreement, so the first child can remain eligible there. No affected downstream product was exercised against a hosted conflict. The two genuine Colorado inputs agreed on Blackwood and his projected status; their one existing goalie child fits that evidence. [Goalie inventory reader](../../../web/lib/socialShare/modules/shared/goalieInventory.sources.ts)

Local verification passed 166 tests across projection storage, the public projected-lines route, and both producer routes. Full nonincremental TypeScript and scoped ESLint completed successfully. The released-module comparison failed the four known-original controls before the correction.

### Poller gateway cross-check

A read-only Supabase function gateway log search found zero recorded poller responses in the briefing’s 21 unmatched windows (start minus five seconds through start plus 90 seconds). The query used the function request URL as a filter and returned only safe status and timing fields. As a positive control around job 257249’s 10:32 UTC start on Nov 19, the same filter found HTTP 200 at 10:30:17.094 and two HTTP 207 responses at 10:34:18.598 and 10:34:21.987. An identifiable gateway completion exists on each side of the missing interval. There is no retained request identifier joining either later completion to the 10:32 job. The evidence establishes a gap through the gateway response stage and does not identify an individual missed post, upstream timeout, authentication failure or delayed completion.
