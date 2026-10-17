# Bounded PP source read proposal — prepared, NOT executed

Purpose: obtain authentic source claims about PP1/PP2 for the existing nineteen owned players, using the existing deterministic complete-unit interpreter. No ingestion route, database, model call, forecast generation, publication or evaluation is included.

Allocation: `/Users/tim/Documents/FHFH-private/forge-rso-completion-20261016-v1/pp-source-allocation-v2.json`.
SHA-256: `640654847645f65464e29c843c8fcb13efd9289ff807d3ece268b6df0f47c1cd`.
`proposal-pins.json` binds collector, parser, approved metadata and reused transport helper bytes. Root source-scope review found no blocker. Its requested execution-accounting fix is applied: recompute the deadline after durable intent, and count an attempt only immediately before transport; an expired current URL remains unattempted. Final approval of this exact revised allocation remains required before execution.

## Exact request budget

Phase one: one GET each, in this fixed order:

`https://www.gamedaytweets.com/lines?team=PHI`
`https://www.gamedaytweets.com/lines?team=MTL`
`https://www.gamedaytweets.com/lines?team=OTT`
`https://www.gamedaytweets.com/lines?team=TOR`
`https://www.gamedaytweets.com/lines?team=TBL`
`https://www.gamedaytweets.com/lines?team=WSH`
`https://www.gamedaytweets.com/lines?team=CHI`
`https://www.gamedaytweets.com/lines?team=DET`
`https://www.gamedaytweets.com/lines?team=EDM`
`https://www.gamedaytweets.com/lines?team=DAL`
`https://www.gamedaytweets.com/lines?team=LAK`
`https://www.gamedaytweets.com/lines?team=MIN`
`https://www.gamedaytweets.com/lines?team=VGK`

No pagination. Maximum thirteen requests, 1 MiB per body, 13 MiB aggregate, eight seconds wall clock per transport (including DNS/TLS), 150 seconds overall when optional phase disabled. Requests are serial. No retries or redirects; any capture/parse failure stops the run. Bodies reaching the byte ceiling are retained as incomplete and rejected. Original HTTP Date/Age are retained separately from real capture time.

This allocation also proposes an optional phase of at most thirteen public oEmbed GETs, one per club, after all thirteen pages succeed. Select only the first exact non-GameDayLines original status URL actually cited in a dated explicit PP1/PP2 block mentioning an owned player. No t.co expansion, arbitrary URL, wrapper enrichment, quote recursion or X API calls. The fixed template is `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=ENCODED_ORIGINAL`, where ORIGINAL must exactly match `https://(www.)?(twitter.com|x.com)/AUTHOR/status/DIGITS`. Returned oEmbed HTML must refer to the same status ID. Total including both phases: at most 26 requests, 26 MiB, 300 seconds, still eight seconds/request and serial. Selected URLs are recorded in private parse receipts before requests. Missing/unavailable oEmbed is not permission for any fallback.

## Exposure and interpretation

Whole first-page HTML and optional whole oEmbed JSON may include other players, incidental game/news facts and links. They remain exclusively private. No protected outcome/evaluation archives, private pilots, candidate outcome extraction or linked article/outcome requests are included. Only source HTML/JSON is read; embedded scripts/images/links are not executed or fetched.

The approved `loaded-planning-evidence.json` directory contains 1,065 entries; 1,007 have usable canonical/NHL/club identity metadata. The 58 unresolved entries are excluded. This is metadata-only reuse; only the nineteen owned canonical identities may be emitted as role claims. Other unit members are resolved only to validate complete five-player context. Missing or ambiguous members withhold the unit. Names, club metadata and directory receipt clocks do not prove a historical roster or health.

`parseGameDayTweetsLinesPage` identifies feed records; `parseTweetOEmbedHtml` preserves original paragraph line breaks; `interpretTweetUnits` supplies complete units with explicit PP numbers and original evidence spans. These are pure local parsers, without a model call or parser/publishing feature-flag mutation. Only complete, explicitly labeled, ungrouped PP1/PP2 units emit owned-player claims. Source context (game/practice/unknown) remains labeled. An unmentioned player has no negative assertion.

The original publication label is retained. A date-only label becomes `sourcePublicationDay` with `publicationPrecision=day`, while exact `publishedAt` remains null. Real capture time is separate. No exact source time, fresh expiry, game binding, legal eligibility, future confirmation or current role is manufactured. Multiple/stale/conflicting claims are diagnostic and require subsequent source qualification; this collector never admits them to a forecast. Optional oEmbed may improve original text but cannot invent precision absent from its original body.

## Prepared artifacts and verification

- `capture-pp-sources.py`: default plan mode performs no network. Execution requires exact allocation SHA, an approval reference, and a new exclusive `pp-source-capture-*` output directory directly under the fixed private root. Mode 0700 directory / 0600 original files; physical partial bytes count toward the same budget. Reuses `capture-native-sources.py` exclusive writes and subprocess wall-clock guard; host-specific transport is narrowly adapted for the two public source hosts.
- `extract-pp-claims.ts`: offline-only complete-unit extraction; private parse inputs/outputs, no app code changes.
- `capture-pp-sources.test.py`: eight synthetic controller/transport tests passed: thirteen pages, optional exact citations, failed partial/no retry, total deadline including slow durable-intent logging with zero attempts/GETs, allowlists, redirect denial, body ceiling.
- Extractor `--self-test`: seven synthetic parser cases passed, covering complete PP1, owned-only output, day precision, missing/future date, scoring-only exclusion, incomplete/unresolved units, optional original PP2.

No provider request, database query or collector execution has occurred. Root source-scope review completed; its accounting correction passed the focused regression. Final execution approval is pending. Current reachability, freshness and genuine nineteen-player coverage remain unknown.
