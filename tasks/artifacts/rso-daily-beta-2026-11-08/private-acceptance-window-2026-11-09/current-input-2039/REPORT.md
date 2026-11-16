# Current private input and Best Fit diagnosis — November 9

The supplied current download is usable for saved-input review after a small local schema repair. Best Fit's missing net points remain a separate forecast-coverage hold. Nothing in this packet grants current forecast use, authenticated acceptance or release approval.

## Observed behavior and cause

The existing deployed RSO tab was inspected without navigation, reload, clicks or provider calls. Individual game projections were numeric, while weekly projected points and Best Fit NetPts were blank. The page reported that best-projected-points planning needs projections for the whole lineup. Schedule-based results remained available.

The saved input has two active roster players without forecasts for seven player-games. Two inactive reserve players lack six further player-games. Its forecast evidence explicitly reports **18 FORGE runs withheld because they cannot prove exclusion of third-party fantasy projections**, and **343 players left without a proven line because a newer unproven run may contain their team's line**. The export does not contain the excluded runs or their individual proof-failure details, so the particular upstream failure cannot be resolved from this file alone.

`candidatePlanMetrics.ts` only supplies NetPts when both the baseline and changed plan have comparison-eligible, finite projected totals. An unknown roster baseline therefore withholds every candidate's net points even when many individual projections exist. This is consistent with the observed page and saved coverage gaps; no rendering failure was established.

The earlier fixes are already present: `107673704` ungated Yahoo acquisition-timing inference, and `eff1b377a` added labelled conservative zeroes when no FORGE line exists. This input has known same-day timing. The zero fallback deliberately excludes cases where a newer unproven run might contain a line; treating that unknown as zero would defeat the current safeguard. The existing regression for this boundary passes. No admission, registry, forecast number or comparison policy was changed.

## Supplied file and currentness

- Local download: `rso-planning-evidence (4).json`, 12,045,345 bytes. SHA-256 `124984ee2f1f59916c6233566cd896826a91359980bc657531c55f04702db1de`.
- Exported November 9 at 20:39:43.620 UTC; reader check and snapshot 20:39:22.393 UTC; provider snapshot 20:39:12.425 UTC. Local modification time agrees with the download. The Library attachment was not independently retrieved or byte-compared.
- 1,065 players, 19 roster entries, 96 game sides, 2,011 forecasts from five declared bridge runs. Issuance timestamps are November 5 and 7. None was expired at the final 21:00 UTC inspection, and no checked identity/clock/manifest mismatch was found. This does not prove current source authenticity or quality.
- The original file remained byte-identical and outside the repository. Only counts, clocks, hashes and generic findings are retained here. No private player, league, team or account identifiers were copied into this packet.
- This expanded loaded-input export is not the original HTTP body or a restorable backup. It omits response-only bridge proofs and cannot recreate runtime forecast authority. All 2,011 serialized bridge rows remained unauthorized in the offline process.

## Local repair and verification

The original strict schema rejected both snapshot copies: 106 forecast explanations longer than 200 characters, four longer source-evidence explanations, and the existing optional `matchupWeeks` payload. These are distinct saved-input validation defects; the worker's Best Fit evaluation does not parse through this schema, so this repair is not a fix for the deployed NetPts hold.

The three-file local candidate:

- `web/lib/in-season/workspaceSchema.ts`: allow bounded human explanations up to 1,000 characters for forecast and source-evidence notes, preserving exact reserve labels; accept up to 60 strictly validated matchup-week rows.
- `web/lib/in-season/workspaceSchema.test.ts`: round-trip every actual built-in reserve explanation, preserve nulls and denied uses, retain matchup weeks, and reject oversized notes/identifiers and malformed weeks.
- `web/lib/rosterScheduleOptimizer/planningTypes.ts`: declare the optional snapshot matchup weeks using the existing `PlanningData` field type.

The new two tests failed before the repair. Final checks: **54 schema tests passed**, the existing unproven-run safeguard test passed (**1 executed, 91 filtered out**), whole-web TypeScript check passed, scoped ESLint passed for all three files, and diff whitespace check passed. The initial TypeScript failure identified the paired snapshot type omission and was corrected. No build, broad application suite or new browser test was required for this schema-only repair.

The current private file then passed strict snapshot/provider/intent/override parsing. Rules, roster, locks, realized inputs, opponent, forecasts, evidence and matchup weeks were semantically preserved. The first inspector used JSON key order for equality and produced misleading false flags; the final inspector uses deep equality. Both receipts remain distinct.

Two bounded baseline evaluations used the actual league slots and unchanged manager input: legal schedule-only planning reproduced **53 active games and 3 bench games**. Replaying serialized forecasts did not grant forecast authority or projected totals. This is saved-input consistency, not a current authenticated acceptance pass. Unsupported league-rule count was zero; missing forecasts remain unknown rather than being classified as unsupported rules.

See [RESULT.json](RESULT.json), [inspection-final.json](inspection-final.json), [CHECK-FINAL.json](CHECK-FINAL.json), [SOURCE-PINS.json](SOURCE-PINS.json) and [schema-repair.patch](schema-repair.patch). The candidate remains uncommitted and unreleased in the canonical `octoberBranch` checkout. Earlier test receipts stay bound to their original source trees. The earlier standalone saved-response preflight retains its old pins and intentionally rejects source drift; use this packet's current inspector for this expanded export, and qualify fresh pins before using that older preflight on the changed tree.

## Smallest remaining acceptance steps

1. **Forecast/runtime owner:** provide existing retained admission evidence for the 18 withheld runs: original run identity/date/code or producer-closure identity, original proof inputs or receipt references, and the rejection reason. Also provide the original served response and source-selection/capture receipt if retained; for the bridge this includes response-only `bridgeForecasts.runs`, `rows` and `proofs`. This requests saved evidence, not a new production query, generation or registry change. If it was not retained, say so before proposing a bounded new operation. Native forecast qualification remains separate.
2. **TJ, in an agreed offline/local manual context:** confirm the actual league slots, scoring, acquisition timing/limits and time zone; choose one move and any protected/excluded player. Inspect the proposed full-plan/drop-loss effect, undo it, then reopen the local workspace and confirm the selected intent and protections survive. Record only pass/fail or a private saved result. The current capture has zero selected steps, protections or exclusions, so it cannot close this continuity check. No move has been selected on TJ's behalf.
3. **Yahoo path:** reuse this saved provider snapshot for the bounded input comparison. Actual authenticated refresh and post-refresh preservation remain untested. Existing refresh preferences are absent from this export and must remain unchanged. A new connected load/reload or normal Yahoo reader may refresh and persist OAuth credentials, acquire refresh leases or update reauthentication state. It needs separate specific authorization covering those effects and bounded requests before execution.

No new input is required to finish the completed local schema repair. Restoring real Best Fit points requires qualified whole-roster coverage, not a client-side zero substitution. Publishing this candidate or repairing the upstream runs remains a separate approval and owner decision.

## Coordination and bounds

Exact claims and before hashes are in [SCHEMA-CUSTODY.json](SCHEMA-CUSTODY.json); old matching Claude leases were released and the three files were clean at claim time. Append-only mailbox entries `CODEX-RSO-CURRENT-INPUT-20261109-05` and its type completion recorded the claim, forecast-owner requirement and release hold. No new owner acknowledgement was inferred. Claude, BLSH, Rankings and BEAST changes were preserved.

This continuation initiated no Yahoo, provider, database, auth, production-repair, remote-build, deployment or push operation. It did not change refresh preferences, lineup choices, live flags or credentials. No owned server or verification process remains after the recorded checks.
