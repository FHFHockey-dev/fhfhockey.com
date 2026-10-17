# Retained RSO evidence and remaining owner gates

This inventory reads retained artifacts only. No live capture, browser/account access, application test rerun, database write or production request was performed. The waiver pair remains frozen. The release coordinator owns combined compilation. Findings below are limited to the inspected RSO handoffs and their named artifact directories.

## Evidence that can be reused

| Artifact | Actual scope and provenance | Acceptance limit |
| --- | --- | --- |
| `tasks/artifacts/rso-consumer-checkpoint-2026-10-13/success-readback/database-readback.json` | Observed `2026-10-14T00:13:45.301191+00:00`; 114 team-side rows, 57 games, padded October 11–19. SHA-256 `d3583831257f8923eb4bebccfeb139c87a9330fd2f228145ff31e2c45ba6f90d`. Prior accepted replay covered October 12–18 in America/Chicago, 50 games/100 team cells. | Historical schedule packet; reuse its accepted normalizer evidence. Its then-current freshness cannot establish current freshness or the owner's intended horizon. |
| `/Users/tim/Documents/Codex/2026-10-12/rso-conditional-lineup-baseline/SELECTION.json` | Historical manual value-blind scenario, October 13; 15 selected skaters and 12 games; original capture observed October 11 at `20:44:17.754Z`. SHA-256 `ed8c5e5c3c3c42afd4088beb35415eaa581a632979289f668eb2e549b745887a`, matching its retained receipt. Context October 11–24, America/Chicago. | Partial selected roster/rules scenario, assuming appearances; zero forecasts at historical snapshot. Does not establish a complete current roster, candidate availability or qualified start/sit advice. |
| `tasks/rso-goal-handoff.md` | October 10 provider observation: 19 rows, six dual-eligible players, two IR+ rows; Yahoo league `477.l.125593`, team `477.l.125593.t.10`; historical October 12–18 America/New_York context. | Zero planned adds/protections. Referenced `/tmp/rso-consolidated-observations-20261010/provider/` and `provider-identity/` directories are now absent. No complete raw provider body was retained by that handoff. |
| `/Users/tim/Documents/Codex/2026-10-11/plan-fhfh-roster-schedule-optimizer-owner/outputs/rso-7-3-acceptance-proposal-20261011.json` and adjacent preflight, preservation-terminal and refresh-cost receipts | Existing detailed preservation and bounded account-test proposal, reused below. | A proposal and blocked historical preflight are not execution authorization or completed account acceptance. |

The full historical workspace and baseline receipt referenced under `/tmp/fhfh-rso-dedicated-baseline-01a12db8-v1/` are also absent. No raw account/browser capture or model/experiment source was opened. Existing synthetic UI receipts establish fixture behavior only. No suitable complete current roster/rules/eligibility/candidate/schedule packet was established in this bounded search.

## Minimal missing export checklist

Do not recreate the historical schedule or selected scenario. For any future owner-selected current acceptance case, retain only these missing facts in a sanitized packet:

1. Owner-confirmed season, league/team, exact horizon and timezone, and observation/source timestamps. The historical New York and Chicago horizons above are distinct cases; neither is silently adopted as current.
2. Complete roster membership, player identity mappings, league-specific eligibility, selected slots, reserves, locks and editability; authoritative rules plus explicitly labeled manager supplements.
3. Only the named acquisition candidates needed for one meaningful nonzero itinerary: ownership/free-agent/waiver state, effective availability time, acquisition timing/cost, remaining allowance/reset, drop restrictions and capacity. Include goalie progress/counting rules if the case depends on them.
4. Schedule coverage and revisions for that exact horizon, referencing the retained packet only when its historical scope is intentionally selected.
5. For account-save acceptance, an existing normal app-authenticated workspace GET response body plus nonsecret principal/context/time provenance. Exclude tokens, cookies, authorization headers and unrelated account data. A projected payload alone does not establish original row/version ownership.

Qualified forecast packets remain a separate forecast-owner gate. Missing points evidence must remain unknown; it is not filled with schedule counts or historical conditional values.

## Owner-only proposal; not authorized for execution

The smallest first account step, if no suitable response is already retained, is **one** normal app-authenticated GET to `/api/v1/roster-schedule-optimizer/workspace?provider=yahoo&seasonId=S&leagueId=L&teamId=T&startDate=D0&endDate=D1`, with owner-confirmed scope. This is a proposed one-GET/zero-workspace-row-write preflight, no retry, no preservation allocation and no local restore. Do not extract credentials or substitute an anonymous/cookie-only request. Null original row blocks account-save acceptance; an error is unknown, not absence. No insert/delete workaround.

Only after that preflight and separate approval: use an existing original row, verified principal, excluded competing writers, exact four local-key baseline/Undo state, and downloaded checksum-bound sealed backup in the same uninterrupted preservation process. Freeze the precise current operation order before approving its full budget. The retained minimal save/restore slice permits at most **two protected workspace-row PUT attempts**: one own test save V→V+1 and one CAS restoration of the original payload using the last own acknowledged V+1→V+2. Restoring identical payload still increments version. No ordinary PUT, adoption of another writer's version, insert or delete.

For continuity, predeclare one meaningful nonzero plan P1 and one undoable edit P2; observe one bounded refresh and Undo P2→P1 while current provider facts remain authoritative. A provider refresh has multiple resources, pagination and auth side effects: the retained cost inventory must be reconciled with the chosen operation before separate approval; “one refresh” is not a request bound. Preserve original absence/value of all four local keys. Stop on any uncertain acknowledgement, outside writer, missing baseline or lost preservation process; do not blindly restore.

A held preservation-journal reopen displays the original backup in read-only recovery. It **does not** close ordinary nonzero reopen acceptance. Normal handback can trigger autosave/readers/provider effects and needs its own bounded scope, or the result remains restored-but-held and incomplete. Second-device conflicts require a separate preservation/authorization slice; they are not covered by the two-PUT proposal.

No new account work is requested by release coordination. Keep these as owner gates alongside A1–A11 in `ACCEPTANCE.md`; assemble the local release without claiming these gates passed.
