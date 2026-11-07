## Relevant Files

- `tasks/TASKS/prd-roster-autopsy.md` — governing PRD, read-only; this list implements the [bounded slice](roster-diagnosis-brief.md).
- `web/components/RosterAutopsy/RosterAutopsy.tsx` and `RosterAutopsy.module.scss` — existing page hierarchy and focus targets.
- `web/components/RosterAutopsy/RosterAutopsy.test.tsx` — extend existing interaction coverage.
- `web/lib/rosterAutopsy/manual.ts` and `manual.test.ts` — existing structural result/workspace, read-only reuse and regression checks.
- `web/lib/rosterAutopsy/diagnosis.ts` and `diagnosis.test.ts` — proposed derived finding/action ordering with independent expected cases.

### Notes

- Task-rule structure retained; saved in the exclusively granted L5 namespace rather than writing an ungranted root task list. No duplicate governing PRD.
- Chef accepted the structural-first stage and granted the five exact application files to L5. Implementation/check status below is local only; Chef retains final integration/acceptance. Numeric grade/impact work remains ungranted.
- Roster UI and diagnosis logic can proceed independently after task 1's shape is accepted; their integration depends on both. L4 integration is a later dependency, not a prerequisite for structural diagnosis.

## Tasks

- [x] 1.0 Accept structural diagnosis stage and obtain exact path custody.
  - [x] 1.1 Confirm this stage improves the manual foundation without claiming complete quality diagnosis; accept existing name/route for now.
  - [x] 1.2 Pin current `analyzeRoster` output and existing storage protections; agree finding shape (kind, basis, affected positions/slots, reasons and local focus action) without altering workspace v1.
- [x] 2.0 Derive truthful findings and priorities (depends on 1).
  - [x] 2.1 Use existing coverage and simultaneous assignment results; distinguish covered, shortage, flex congestion, reserve exclusion and unknown inputs. Counts never become player quality or tradable surplus.
  - [x] 2.2 Order review, confirmed gaps and congestion deterministically; cover one C/LW for two slots, complete coverage, flex-only/no-slot, reserve and incomplete cases with independently expected findings.
- [x] 3.0 Put diagnosis first on the existing page (depends on 1; integrate after 2).
  - [x] 3.1 Render Strengths, Weaknesses and Next actions with structural basis and clear empty/partial states; retain roster and setup controls.
  - [x] 3.2 Make actions focus existing sections; retain phone navigation, input edits, manual RSO import and principal/conflict isolation. Extend existing component tests.
- [x] 4.0 Verify and hand off the bounded local candidate (depends on 2–3).
  - [x] 4.1 Run focused diagnosis plus existing Autopsy tests from `web/`; run affected lint/types when warranted. Perform local synthetic desktop/phone/keyboard flow, without provider reads.
    - Passed: 26 tests, scoped TypeScript, four-file ESLint, component/Sass fixture compilation. After the worker platform launch failure, Chef ran the inspected harness in Chef's approved runtime: 30 synthetic component assertions passed; desktop/390 screenshots visually reviewed by Chef. Full Next shell/provider parity remains unverified. See [implementation receipt](IMPLEMENTATION.md).
  - [x] 4.2 Chef reviews actual diff and limitations; record source identity and checks. No build/deploy or whole-feature completion claim.
- [ ] 5.0 Add quality and impact only after their actual dependencies close (separate later grant).
  - [ ] 5.1 Approve timestamped public universe/scoring/eligibility and PRD grade method; preserve unknowns and historical-versus-forecast distinction.
  - [ ] 5.2 Bind accepted L4 value/impact outputs with exact versions and missingness; add quality/league-relative findings only with the required evidence. No local VOR, acceptance or forecast model.
