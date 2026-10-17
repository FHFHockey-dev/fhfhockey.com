# Proposed Yahoo status → `knownConflict` policy (for TJ's approval)

**Status: proposed, not applied.** The universe stage emits the evidence, each player's classification and a proposed `knownConflict` map. Its `knownConflicts` field is `null` (`withheld_pending_policy_approval`) until you approve this exact policy object:

- `PROPOSED_YAHOO_KNOWN_CONFLICT_POLICY` in `web/lib/player-forecasts/yahooUniverse.ts`
- version `yahoo-status-known-conflict-policy-v1`
- **policy hash `9a50f265d169817dd24fef6b6f5154deafe47a4104cd6880d28549f7775e8a66`** (pinned by a test)

Approving it means: "apply this hash in the daily run, under the standing approval." Changing any value changes the hash and needs a new approval.

## What `knownConflict` does

`knownConflict = true` withholds a player's per-game participation receipts for the day, with the reason `known_current_roster_conflict` (`targetRosterObservation.ts`). RSO and Start Chart then see unknown expected value for that player, not zero. `null` leaves the roster-observation method unchanged. The method assumes roster continuation and ignores injuries. Nothing in this policy ever produces `false`.

## Rules, in order

1. **Evidence.** The input is the original Yahoo player payload from today's roster or available-player page, using the same shape and hash as the 2026-10-16 Fiala evidence. Evidence is built only for players with a non-empty `status`, `status_full` or `injury_note` field.
2. **Provenance gate.** `classifyCurrentRosterInjuryEvidence` must not fail on identity, season, clock (≤ 24 h, not expired), content hash, original-payload or `player_key` binding. If it does, the result is `null`.
3. **Contradiction.** If the classifier finds `healthy`, `available`, `active`, `no injury`, `not injured` or `cleared to play`, the result is `null`. This also covers `NA` ("Not Active").
4. **Status code decides.** The classifier's own injury verdict is diagnostic only:

| Yahoo `status` | Proposed `knownConflict` | Why |
|---|---|---|
| `IR`, `IR-LT`, `IR-NR` | `true` | Explicit injured-reserve status from the provider |
| `O` (Out) | `true` | Explicit "out". The classifier alone would say unknown: "Upper Body" does not match its regex |
| `SUSP` | `true` | Explicit unavailability that is not an injury. **Decision for you** |
| `DTD`, `GTD` | `null` | Most day-to-day players play. Kept unknown even when the note says "Concussion", which the classifier alone would call injury-supported |
| `NA` | `null` | Minors or not active. The official NHL club roster capture (`listed`) is the authority for membership |
| any other code | `null`, listed under `injury.review` | Never guess an unfamiliar code |
| no status fields | `null` | Absence of a status is never "healthy" |

5. **Roster slot is ignored.** A manager placing a player in IR or IR+ is manager intent, not evidence. Yahoo's IR/IR+ eligibility already follows from the status. "IR+" in the brief's example is a slot, not a status code.

## Replay on the retained 2026-10-16 originals (offline test)

Tested in `yahooUniverse.test.ts` (private fixtures, skipped on a clean clone):
- 69 players resolved (19 owned, 50 candidates).
- Fiala's evidence is rebuilt byte-for-byte: the same `sourceId`, content hash and clocks.
- 14 players carry a status:

| Outcome | Owned | Candidates | Total |
|---|---|---|---|
| Proposed `true` (IR / IR-LT / O) | 4 | 8 | 12 |
| `null`, DTD | 1 | 1 | 2 |
| `null`, no status fields | 14 | 41 | 55 |

**Why only Fiala was flagged on 2026-10-16.** That reconciliation ran at about 04:43Z. At that point Fiala was the only player with a retained exact mapping, so his was the only evidence built. The 69-row mapping read finished at 04:56Z. The single flag was a coverage gap, not a policy outcome. With full mapping, the same Yahoo payloads carry 12 explicit IR/IR-LT/O statuses.

## Knock-on decision: the null-participation gate

The v1 run stops above `--max-null-participation 100`. The Oct 16 baseline was 100 null of 1,260 receipts, including Fiala's 20 conflict-withheld receipts. On the Oct 16 data:
- this policy would add 11 more withheld players, about 220 receipts at a 20-game horizon
- one of the 11 is a goalie, so his start receipts are withheld as well

That would trip the gate even when nothing is wrong. The proposal is to approve together with the policy a gate that counts **only null receipts for reasons other than `known_current_roster_conflict`** (ceiling unchanged at 100). Conflict-withheld receipts are reported separately by player in the review.

## Decisions for you

1. Approve the policy hash as is, or change any row. `SUSP → true` and `NA → null` are the two judgment calls. `O → true` goes beyond what the classifier says.
2. Approve the null-gate change above, which is a gate definition change.
3. Once approved, fresh daily evidence replaces the carried Fiala `true`. If his status clears, his conflict clears. If the Yahoo read fails that day, nothing is passed and the v1 carry rule applies. See INTEGRATION-NOTES.md.
