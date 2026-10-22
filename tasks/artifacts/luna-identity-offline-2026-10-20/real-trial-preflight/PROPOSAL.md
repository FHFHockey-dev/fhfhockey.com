# One real S06 identity request: sealed preflight, no dispatch

This preparation uses the user's existing small-test authorization under the **same $0.52 total cap**. It requests no new allowance or general rollout approval. No provider/account API, key loader, production query, model request, ledger write, application change or deployment was performed. Official public documentation was read.

## Concrete real case for TJ

Retained source: @JasonGregor, original ID `2104971594632454155`, published `2026-09-29T16:28:31.000Z`, received `2026-09-29T17:00:52.374726+00:00`. The unmodified source is already local in `web/lib/sources/fixtures/iftttComparisonObservations.json` (S06):

> Podkolzin will take RNH’s spot on the first unit powerplay… via Babcock.

| Exact occurrence | UTF-16 span | Candidate lead already in local code | Established canonical ID |
| --- | --- | --- | --- |
| Podkolzin | [0, 9) | Vasily Podkolzin | Unknown |
| RNH | [20, 23) | Ryan Nugent-Hopkins | Unknown |

The candidate names come from `tweetInterpretation.test.ts:319`. Its IDs **3 and 4 are synthetic and must never be used as NHL IDs**. Those unit-fixture names and test alias do not establish canonical IDs. TJ has already identified Podkolzin as Vasily Podkolzin and RNH as Ryan Nugent Hopkins in the conversation. OWNER-GRADING.json now retains that statement as owner-supplied development evidence; no repeat name grading is requested. Canonical NHL IDs and membership remain unverified, and no permanent alias is learned.

This is a previously exposed development example, not an untouched holdout. No source-time team, position, game, actual replacement slot, completed lineup change or independent source authentication is invented. The source's “will take” wording remains literal. The trial returns identity proposals only.

## Verified interface and cost envelope

The exact model is `gpt-6-luna` via `POST https://api.openai.com/v1/responses`. Existing local receipts include 11 Responses replies returning that identifier on October 19; the public model documentation currently lists Responses support. That establishes historical access and public support, not a fresh authenticated account probe.

The existing `comparison-sequential-pilot-2026-10-19/pilot.py::post_once` already seals request bytes, uses certifi with certificate/hostname verification, disables proxy/redirect/retry behavior, bounds replies and redacts response metadata. Its enforced `reasoning: {effort: "none"}`, `max_output_tokens: 1024`, default tier, no tools and `store: false` are retained; no override or credential setup is proposed. The upstream identity response schema needs to be bound to the existing proposal validator. The retained downstream Decisions adapter is not changed or repurposed.

Current public sources opened during preparation:

- [Model and long-context multipliers](https://developers.openai.com/api/docs/models/gpt-6-luna)
- [Standard pricing](https://developers.openai.com/api/docs/pricing)
- [Explicit prompt-cache control](https://developers.openai.com/api/docs/guides/prompt-caching)
- [Responses parameters and output limit](https://developers.openai.com/api/reference/python/resources/beta/subresources/responses/methods/create)

Standard input/output rates are $0.10/$0.50 per million tokens. The model context window is 1,050,000 tokens. The reserve applies the long-input/output multipliers (2×/1.5×) and a 10% regional envelope to the entire full-context bound, with 1,024 generated tokens including non-visible output. `prompt_cache_options: {mode: "explicit", ttl: "30m"}` with **zero explicit breakpoints** disables cache reads/writes according to the official guide, avoiding cache-write pricing in this envelope.

```
(1,050,000 × $0.20 + 1,024 × $0.75) / 1,000,000 × 1.10
= $0.231844800 maximum reservation for one request

$0.262177193 existing charged-or-reserved exposure
+0.231844800 new one-request ceiling
=0.494021993 maximum aggregate exposure

$0.520000000 cap − $0.494021993 = $0.025978007 remaining
```

This is a deliberately loose **published-tariff ceiling**, not an expected invoice or a token estimate. It uses the full context window rather than a byte heuristic, an assumed tokenizer or the earlier unverified 922k input figure. Local tiktoken 0.9.0 has no `gpt-6-luna` model mapping and is not used as proof. Standard/default ordinary direct-account billing assumptions from the existing permitted test path remain applicable; unexpected usage/billing metadata causes a hold, never a retry.

Only **one** request is proposed. There is no paid widening, Decisions verification, token-counter probe, calibration judge, tool call, fan-out or automatic retry. The small real case can be incomplete; this does not qualify a release or show fewer alias emails.

## Existing aggregate pattern, preserved block

Active ledger: `tasks/ifttt-integration-2026-10-16/comparison-retry-execution-2026-10-19/aggregate-budget.sqlite`.

Pinned baseline SHA-256: `52d4848b5a9eb1a91b3ddfd9928625951fe2da81814669d41bdbd08a261c9b5c`. It was opened only in SQLite `mode=ro`; its hash is unchanged. The original `lindgren-0` reservation stays **$0.254394800**, its state stays uncertain and the original `unknown billed outcome` block stays set. No new competing budget ledger is created.

The concrete continuation follows the existing `comparison-verifier-continuation-2026-10-19/verifier.py::VerifierLedger` pattern: preserve baseline attempts/block/cap/reconciliation history; bind only the new scope ID and exact reviewed wire hash; transactionally reserve against settled charges plus **every** outstanding reservation. At execution time this would use BEGIN IMMEDIATE on the same aggregate and record the single sent attempt before HTTP. A failed or uncertain request retains its entire new reservation and stops. It never clears or settles the old attempt by inference from dashboard aggregates.

No transaction or authorization row is executed in this preparation. The proposed attempt ID is `identity-s06-shadow-v1-0`, the exact per-call reserve is 231,844,800 nano USD and the cap is 520,000,000 nano USD. CONTINUATION-POLICY.json pins these invariants. Any ledger drift must be reconciled read-only and the baseline re-sealed before admission.

## Essential data still needed

No approved dated real directory was found in the inspected trial inputs. The Lindgren pilot has one externally ungraded identity row, and other inspected fixture directories use synthetic IDs. Neither is promoted to a canonical source.

The smallest useful data delivery is an **existing bounded export**, or authorization for one read-only export from the already configured identity database, for these two occurrence families:

- At most 20 canonical candidates matching surname Podkolzin, surname Nugent-Hopkins, or an already verified alias RNH (include every conflict, not only the anticipated answer).
- Required: canonical NHL namespace/ID, full name/last name, any registry-to-NHL link and verification provenance, export time/hash and declared partial completeness.
- Existing verified aliases and scope/validity provenance may be included; undated/unit-test aliases cannot be converted into historical global aliases.
- Source-time membership/position may remain **unknown** if not established. They are not required to invent or assert a team for this lexical identity trial. If supplied, use existing dated roster intervals for September 29, not today's roster label.

Known repository read surfaces are `players` (id/fullName/lastName/position), verified `fhfh_player_identities` and `fhfh_player_identity_aliases`, plus `lineup_player_name_aliases` for scoped alias leads and `rosters` for existing interval evidence. Bound related alias/membership rows to the selected IDs and at most 100 rows total; flag truncation and stop rather than silently discarding conflicts. No NHL/provider refresh, ingestion, full-database pull, secret export or writes are necessary. No such query has been run.

TJ's already supplied occurrence names are retained outside model input; bind them to canonical IDs only after the approved export. Run current candidate retrieval against the approved neutral directory **before spending**. If a labeled correct ID is missing from its allowed shortlist, report that retrieval failure and stop; never insert an answer into candidates using gold labels. In particular, an unverified RNH alias may expose a real retrieval limitation instead of justifying a paid call with missing candidates.

## Seal and review status

SEALED-PREFLIGHT-MANIFEST.json hashes the source/grading packet, parameters, pricing/cost record, continuation policy and relevant existing runtime/transport files. The preflight seal is complete and implementer consistency checks passed. It is not represented as an accepted independent review.

**The final wire request cannot honestly be sealed yet:** approved canonical candidate IDs/directory are missing; TJ's separate occurrence-name labels are already supplied. Its wire/directory hashes are null, dispatch remains false, and no runnable spending-state writer is added. Once those specific data arrive, bind the actual request/schema/directory/runtime hashes and have the parent review the concrete one-request continuation. This is a data-specific review under the existing cap, not another broad spending-approval request. Account access should not be probed separately; a future permitted real request either succeeds or is retained under the one-call failure policy.

The bounded read-only export approval is pending: do not query. Remaining essentials are the approved identity export/canonical binding, followed by final request/admission review. TJ's names and the existing spending intent require no repeat approval. No other implementation or synthetic benchmark is needed for this preparation.

## Exact export scope (approval pending; no query run)

| Table | Exact known columns | Scope |
| --- | --- | --- |
| `players` | `id, fullName, lastName, position` | Canonical NHL candidate rows matched by Podkolzin or Nugent-Hopkins surname/name; include conflicts. |
| `fhfh_player_identities` | `id, nhl_player_id, canonical_name, last_name, canonical_position, verification_status` | Verified registry rows linked to selected NHL IDs or matching those names; registry IDs remain separate. |
| `fhfh_player_identity_aliases` | `id, fhfh_player_id, alias, verification_status` | Verified aliases for selected registry IDs, plus verified RNH matches used to discover conflicts. |
| `lineup_player_name_aliases` | `alias, player_id, team_id` | Scoped alias rows for selected NHL IDs or RNH matches; no historical verification/date is invented. |
| `rosters` | `playerId, teamId, seasonId, created_at, ended_at, is_current` | Selected NHL IDs, season 20262027; assess intervals at 2026-09-29T16:28:31Z. Current flags alone are not historical proof. |

Limit the joined/deduplicated canonical candidate set to 20; all registry-alias, lineup-alias and membership rows together to 100. No private league/account tables or columns. At a cap, mark possible truncation and stop; no hidden cap+1 read, pagination or broader lookup is authorized. Include export time and hash as local receipt metadata. Source-time positions/team and alias validity remain unknown where existing evidence is insufficient.

## Reservation versus expected usage

The $0.231844800 reservation assumes every input token in the 1.05M context is billable at long-context rates, even though this two-occurrence source and bounded directory should be far smaller. It is reserved exposure, not an estimated charge. For illustration only, 10,000 input tokens and all 1,024 output tokens at short standard rates plus the 10% envelope would cost $0.001663200; that is not a certified input bound or a new reservation.

A tighter reservation can preserve model and source meaning if the exact final input, instructions, schema and framing are all bounded by supported model-specific token accounting. The current local tokenizer has no gpt-6-luna mapping, and no authenticated token-count call is permitted here. Thus no smaller certified input ceiling is asserted now. Character/4 estimates, previous request averages or counting only tweet text are insufficient. The existing full-context reservation already fits the cap, so obtaining a tighter count is optional rather than another trial blocker.
