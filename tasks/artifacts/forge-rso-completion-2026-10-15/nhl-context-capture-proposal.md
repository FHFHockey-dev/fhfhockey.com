# NHL context capture proposal

Status: the owner-approved original 24-request run stopped after three attempts: two historical responses succeeded; the first future response was retained and quarantined on an overbroad descriptor predicate. Twenty-one URLs were never attempted. This revised proposal prepares a NEW continuation approval; no continuation execution or quarantine admission has occurred. This is source capture and schedule metadata validation, not forecast evaluation, modeled participation admission, or publication.

The active NEW allocation is `/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/nhl-context-continuation-allocation-v1.json`, version `forge-rso-nhl-context-continuation-v1`, SHA256 `5afc96bcbaf9ca3ee0e5a460dbcc342cfb6dfa4777d439995af6e37a2a189e98`. It permits only the 21 unattempted GETs: eight weekly schedules from October 23 through December 11, plus the 13 roster URLs below. It also explicitly proposes offline original-hash reuse of the two successful historical bodies and metadata-only pregame revalidation/admission of the retained October 16 body. That third body remains quarantined until a new human approval covers this exact reuse and the remaining whole-body requests. No successful or stopped URL is requested again.

The original allocation remains immutable at `nhl-context-allocation-v1.json`, SHA256 `a0353b4b25b285a85e29d99e17e6958a5d60f74dbb8e6c4628a09c458a36bd88`; its exhausted run is not a retry authorization.

## Original full scope and whole-body exposure

The original full scope had exactly 24 serial HTTPS GETs. The continuation has exactly 21 new serial HTTPS GETs plus three explicit offline original-source reuses, with no redirects or retries, credentials, database access, or application endpoint calls. Origin is exclusively `https://api-web.nhle.com` and query strings are forbidden.

Two historical `/v1/schedule/DATE` requests use `2026-09-29` and `2026-10-06`. Each must return exactly seven daily entries, covering September 29 through October 12 together, including explicit empty dates. These are all-team weekly bodies: they may contain historical score, result, and other outcome fields for all clubs and players present, not only the 19 selected players or 13 clubs. Those fields are acquired and retained as exposure even though this collector performs no outcome evaluation. No historical October 13–25 body is requested. Reserved raw archives are neither reused nor reopened.

Nine future `/v1/schedule/DATE` requests use `2026-10-16`, `2026-10-23`, `2026-10-30`, `2026-11-06`, `2026-11-13`, `2026-11-20`, `2026-11-27`, `2026-12-04`, and `2026-12-11`. Their exact returned daily coverage must run October 16 through December 17. All games must remain pregame, with future start clocks and no score or recognized outcome fields. In particular October 16–25 coverage authorizes pregame schedule metadata only, never protected outcomes. Capture must occur while these games remain pregame; a later execution requires renewed scope review.

Thirteen roster requests use `/v1/roster/ABBREVIATION/20262027`:

| Canonical club ID | Metadata-bound abbreviation |
| --- | --- |
| 4 | PHI |
| 8 | MTL |
| 9 | OTT |
| 10 | TOR |
| 14 | TBL |
| 15 | WSH |
| 16 | CHI |
| 17 | DET |
| 22 | EDM |
| 25 | DAL |
| 26 | LAK |
| 30 | MIN |
| 54 | VGK |

Roster bodies include every returned player and field, including other players and personal roster metadata, not just the 19 matched NHL IDs. Exact season URLs avoid the locally documented `/current` redirect and its additional request. The arrays must be `forwards`, `defensemen`, and `goalies` with unique positive player IDs. Optional declared club/season fields must match their endpoint binding.

A response's full contents cannot be guaranteed before acquisition. Unexpected dates or protected outcome fields may therefore already have been received when validation rejects them. Such bytes remain private, hash-bound exposure evidence; the collector stops immediately, marks the failure for review, and makes no subsequent request. Filtering after receipt does not retroactively authorize protected exposure. The approving owner must assess this whole-body risk explicitly; the collector does not claim an absolute pre-acquisition exclusion guarantee.

## Existing contract reuse and limits

`web/lib/rosterScheduleData/source.ts:105` (`fetchBoundedNhlSchedule`) and `web/lib/NHL/server/scheduleDaily.ts` establish weekly `gameWeek` day/game arrays and explicit requested-date coverage. The app reader ignores extra returned dates; this collector rejects them because the whole body is retained. `web/lib/rosterScheduleData/types.ts` supplies canonical game/season/type and team ID/abbreviation fields. `web/lib/sources/nhlRosterPreview.ts` supplies the three roster arrays and season route; `web/scripts/audit-forecast-population-local.ts` documents the possible current-to-season redirect. No external probe was used to verify these contracts.

The approved `loaded-planning-evidence.json.snapshot.players` directory and `native-assembly-scope-v2.json.roster` bind all 19 canonical/NHL/current-club identities. The former also supplies the full consistent 32-club ID/abbreviation directory for validating opponents. Both original metadata files are referenced by exact path and hash in the allocation and rechecked only during approved execution. These are metadata inputs, not source outcome archives. No abbreviation was guessed.

The collector reuses hashing, exclusive private writes, safe failure types, and subprocess deadline mechanics from `capture-native-sources.py`, without changing that collector. The new route allowlist is enforced in both controller and child. Child lifetimes bound DNS, TLS, headers, and body reads. Certificate and hostname verification remain enabled, using the existing OS CA fallback if needed.

Original bounds were 24 attempts and 240 seconds/24 MiB. Continuation bounds are 21 new attempts, concurrency one, one second between requests, eight seconds per request, 210 seconds total including offline reuse work, strictly below 1 MiB per original body, and 21 MiB of new source bytes. Reused body bytes remain separate retained evidence; they are not new network exposure. The remaining total time is recomputed after the durable acquisition-intent fsync, before incrementing the attempt counter or launching the child. Exhaustion there makes zero requests and leaves the attempt uncounted. First HTTP, transport, budget, freshness, parsing, or scope failure stops the run. HTTP Date must be within 120 seconds of capture and any Age header must be finite and between zero and 60 seconds. These strict freshness checks may withhold otherwise useful cached responses; no cache-busting or automatic retry is permitted.

An exclusive new output directory uses mode 0700 and files use 0600. Whole original bytes, capture clocks, byte hashes, safe transport diagnostics, decoded receipt packets, and an fsynced exposure ledger are retained privately. The ledger records original source URLs, approval/allocation/collector hashes, intent before acquisition, retained bytes before decoding, failures, and unattempted counts. The original source bytes and source clocks are not normalized or replaced. No raw credentials exist in this workflow.

## Limits of the resulting evidence

Historical complete daily schedules can establish a finite club opportunity frame only for September 29–October 12. They do not establish completeness through the present cutoff or a 60-day frame. Regular-season filtering and eligibility/outcome labeling belong to a separately reviewed downstream adapter. Pregame future pages support a bounded schedule through December 17; the number of supported upcoming games for each club remains unverified until actual capture. A missing twentieth game remains missing.

Season roster responses are capture-time season-roster evidence. HTTP freshness does not prove historical membership or an effective eligibility interval. Missing selected players are reported as absent in the selected roster response, with eligibility unknown. No historical nonappearance, injury, participation probability, dressing status, or lineup confirmation is inferred. The source capture cannot by itself satisfy the modeled participation contracts.

## Offline diagnosis and schema-family review

The stopped original response is `nhl-context-capture-v1/03-future.json`, 88,928 bytes, SHA256 `c729aa34afaf0250c9124133880a4bf122b68420a95039bec08d92e1b95e0245`, originally captured at `2026-10-16T04:56:51.195262Z`. The original whole-body validator failed because it treated the presence of `periodDescriptor` as an outcome. Metadata-only diagnosis showed exactly October 16–22 coverage, 47 FUT/PRE records, future clocks, and no score/winner/gameOutcome field-presence failures. All 47 carry the same three-key pregame placeholder: integer `number: 1`, `periodType: REG`, integer `maxRegulationPeriods: 3`. Only that exact optional placeholder is now accepted. Different keys, types, numbers, or period types still fail, as do all previous started/nonpregame/score/winner/gameOutcome/date checks. No outcome values were inspected and no quarantined-body reuse/admission was performed during preparation.

The remaining schema family was reviewed offline before proposing further source reads:

- The two permitted successful historical pages expose coherent optional weekly and daily `numberOfGames` declarations, plus harmless boundary dates and daily `dayAbbrev`/`datePromo` metadata. These declarations are now checked against actual arrays when present, never used to invent omitted games. Exact seven-day coverage and all-empty weeks remain supported.
- The local bounded reader explicitly permits absent or null gameDate, binding it to the enclosing validated day. Both now pass; a conflicting explicit date still fails. Optional venue/broadcast/provider and boundary metadata does not alter scope or completeness. Valid startTimeUTC remains mandatory, especially for the protected future-game check.
- Local roster readers establish forwards/defensemen/goalies and player `id`, including localized name objects and nullable optional player fields. Synthetic fixtures cover absence or exact matching of optional declared club/season metadata, with mismatches, missing arrays, and duplicate player IDs rejected. These tests exercise the known repository contract; they do not claim an actual new roster response was observed.

Remaining unverified variants are explicit: no fresh roster response has yet been acquired; alternative period placeholders, missing/null start clocks, numeric-string season metadata, unexpected week spans, incomplete/contradictory game-count declarations, and source cache Age beyond the budget remain fail-closed. This review does not waive first-failure stopping or authorize another live attempt to discover unsupported fields.

## Verification and approval boundary

Fourteen synthetic tests passed using mocked transport only. They cover exact allowlists, protected-date spillover, empty-day completeness, future outcome rejection, game/club identity, roster missingness, original-byte/hash retention, serial bounds, first-failure quarantine, exact approval/hash gates, changed metadata, private/exclusive outputs, redirects, byte ceilings, and the total deadline, including a durable intent fsync that consumes the remaining budget before launch. Continuation plan mode was exercised and reported 21 planned requests and zero source requests. This worker performed no source requests or credential reads. The owner executed the earlier three-attempt run described above. No continuation, model evaluation, or application change was performed.

```sh
python3 tasks/artifacts/forge-rso-completion-2026-10-15/capture-nhl-context.test.py
python3 tasks/artifacts/forge-rso-completion-2026-10-15/capture-nhl-context.py --allocation /Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/nhl-context-continuation-allocation-v1.json
```

Before a continuation may launch any child, it checks the exact prior exposure-ledger hash, each retained body hash and original capture clock, and the original successful/quarantined status. It rechecks the future retained page at its original clock and the continuation clock, so already-started games still block reuse. It emits separate `reusedReceipts` preserving original bytes/hashes/clocks and a distinct revalidation timestamp; those clocks are never relabeled as a fresh HTTP observation. Any reuse failure records a stopped result with zero new attempts and 21 unattempted URLs. Plan mode never opens retained sources or the prior ledger.

Execution additionally requires `--execute-approved-sha256` matching the reviewed allocation bytes, a genuine `--approval-ref`, and `--out` naming a new exclusive private directory. No execution command is run or preauthorized by this proposal.

Source SHA256 pins:

- `capture-nhl-context.py`: `863c29491e00264f15b0be2e16e359a01e68ee4a751e672dbe6767aaee696c61`
- `capture-nhl-context.test.py`: `107b66b0d43a9d5a389bec60da8d9ee37477c73f6499170a3a388f105edddc5a`
- Reused unchanged `capture-native-sources.py`: `d019774b2ca47fd17b571d009450d608a264f3e7f70af86fc86d9260711b56c5`
