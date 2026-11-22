# November 18 Rankings source readback

The **November 17 cutoff has complete observed game and skater coverage for November 15–17**, the gap since the last verified November 14 publication. Its dated rolling producer finished **November 18 at 10:20:32.519368 UTC**. At 16:03 UTC the database still held November 14 as its only complete publication in the checked November 14–18 range. The release candidate's stricter admission also requires a shared rolling/support write revision, which none of the 648 gap appearances has. [Retained November 14 publication](../../rankings-acceptance-2026-11-14/first-marked-publish/PACKET.md) · [Candidate admission contract](source-gates.md)

## Independent NHL schedule

One public NHL weekly schedule GET, observed at **16:01:49 UTC**, returned the following results. Date refers to the NHL hockey date. No postponed or canceled games appeared in this aperture. All listed games were regular-season and had schedule state OK. [Official NHL schedule](https://api-web.nhle.com/v1/schedule/2026-11-15)

| Hockey date | Final games | Future games |
| --- | --- | --- |
| Nov 15 | `2026020326`–`2026020330` (5) | — |
| Nov 16 | `2026020331`–`2026020332` (2) | — |
| Nov 17 | `2026020333`–`2026020343` (11) | — |
| Nov 18 | — | `2026020344` BOS–DET and `2026020345` MTL–NJD at Nov 19 00:30 UTC. `2026020346` COL–UTA at Nov 19 03:00 UTC. |

The schedule response SHA-256 was `1b38e07d7053c5e9200ea88ea527853dd20149884e711a8953979aa57a8191bf`. Archived final official NHL boxscores supplied the played skater identities. Each of the 18 completed games had four official forward/defense roster arrays. No public boxscore GETs were needed.

## Hosted source and publication state

One Supabase SQL request in a read-only transaction, with a five-second statement limit and a one-second lock limit, returned at **2026-11-18 16:03:31.528847 UTC**. It joined the 21 official game IDs to the stored calendar and exact boxscore heads, compared positive-TOI skater/game IDs bidirectionally to WGO, and checked the required NST raw 5v5 fields, exact 5v5 rolling and count-support keys, producer timestamps, and the limited publication marker scope.

| Hockey date | Final boxscores | Official played/WGO keys | Required NST 5v5 inputs covered | Matching rolling and support keys | Shared rolling/support revisions | Rolling stage complete (UTC) |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Nov 15 | 5/5 | 180/180 | 180 | 180 | 0 | Nov 16 10:16:44.121115 |
| Nov 16 | 2/2 | 72/72 | 72 | 72 | 0 | Nov 17 10:16:19.917698 |
| Nov 17 | 11/11 | 396/396 | 396 | 396 | 0 | Nov 18 10:20:32.519368 |
| Nov 18 | 0/3, all future | 0 | 0 | 0 | 0 | No dated run yet |

There were zero official-to-WGO missing keys, zero WGO extras against final boxscore keys and zero WGO rows for game/day keys outside the official slate in this scope. Every observed 5v5 rolling and support row matched its WGO game ID and current window-support version. All three upstream skater stages completed. November 17's dated run had an initial NST failure at **10:05:37.446555 UTC** on November 18. The same stage later recorded a clean scoped NST terminal receipt at **10:11:14.576856 UTC**, WGO success at **10:11:52.541376 UTC**, and upstream completion at **10:11:52.575284 UTC**. The latest November 17 rolling row was written at **10:20:32.315628 UTC**. The downstream FORGE report did not establish any of those source facts.

The database returned five complete November 14 publication markers, each certifying 775 skaters. Each of the four Rankings windows held 13,175 reported written rows and the composites marker held 775, completed November 15 at **20:36:13.679 UTC**. There was no newer marker in the checked range and the candidate readiness RPC was absent. The last separately retained user-facing observation remains the November 18 11:52 UTC Master Page readback of November 14 for default and EDM. This read did not run either Rankings builder or exercise an application reader.

## Ownership and next observation

- **Games/raw custodian.** Nov 15–17 already have exact dated final boxscores and game IDs in the existing stores. The prospective compact calendar audit still needs one qualifying ordinary hosted observation from the candidate full-season calendar ingester. The Nov 18 slate remains dependent on the actual finals after the scheduled Nov 19 03:00 UTC last puck drop.
- **WGO/NST and rolling custodians.** Every completed gap-game appearance has the checked WGO and NST inputs. The observations give no reason to repeat either provider for those covered dates. If recovering the pre-change gap with strict admission, first reconcile the newest audits and verify one qualifying 5v5/support write revision for each applicable date through the separately approved bounded procedure. November 14 anchors the older population. The readback did not recalculate the successor's full season cohort or its scores. [Recovery contract](source-gates.md#bounded-recovery-after-separate-approval)
- **Rankings and scheduler custodians.** Hosted source jobs already produced the recorded stages while running in the existing infrastructure, so those jobs can continue with the Mac off. The candidate Rankings publication remains dependent on its deployment, migration and separate activation decisions. No laptop process is monitoring or executing a future run from this readback.

This follow-up used one official public HTTP request and one hosted database request. It made zero FHFH application HTTP requests and performed no provider ingests, recomputes, database writes, scheduled attempts, deployments or canaries.
