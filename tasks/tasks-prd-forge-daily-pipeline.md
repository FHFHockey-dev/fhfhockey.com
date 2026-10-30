## Relevant Files

- `web/lib/player-forecasts/nativeDailyPipeline.ts`: pure stage logic (policy selection, participation inputs, outputs, plan assembly, review application).
- `web/lib/player-forecasts/nativeDailyPipeline.test.ts`: focused tests built on the existing fixtures.
- `web/scripts/forge-daily.ts`: stage CLI (`scope`, `capture`, `inputs`, `outputs`, `review`), private outputs, explicit execute flags.
- `web/lib/player-forecasts/nhlSourceCapture.ts`: bounded serial NHL GET collector, a TS port of `tasks/artifacts/forge-rso-completion-2026-10-15/capture-native-sources.py`.

### Notes

Owner: Chef (this session). The dry-run in 4.0 is the gate before any live stage. Live stages follow TJ's 2026-10-17 approval: provider reads, materialize, publish plus one CAS, and ≤5 readback requests.

## Tasks

- [ ] 1.0 Offline core: inputs → outputs (Chef)
  - [ ] 1.1 Policy selection from assembled native observations, per the PRD's rules
  - [ ] 1.2 Participation inputs: the frozen-window history frame from schedule weeks and boxscores, a fresh roster observation, next-20 targets
  - [ ] 1.3 Materialization request (native selection, required parents, participation inputs) bound with `bindNativeCadenceMaterialization`
  - [ ] 1.4 Outputs after closure: producers → bundles per policy; participation receipts; expiry rule; plan with policy rows (approval ref) and pending reviews; `validateNativeBaselinePublication` dry check
  - [ ] 1.5 Review application: decision file → reviewed plan plus cadence command (catalog head filled from a read)
- [ ] 2.0 Capture (depends on 1.2's receipt shapes)
  - [ ] 2.1 Bounded NHL collector (serial, 1 s spacing, 8 s timeout, byte caps, no retries, ledger), excluding reserved IDs
  - [ ] 2.2 Capture plan from scope: club rosters, schedule weeks, history games, goalie summaries, prior boxscores for zero-appearance skaters; reuses retained receipts
- [ ] 3.0 Scope (Yahoo plus Supabase reads)
  - [ ] 3.1 Owned roster and available-player pages via the repo Yahoo client; canonical mapping query; next-20 bindings
  - [ ] 3.2 Retained adapter that builds the Oct 16 scope from private files, for the dry-run
- [ ] 4.0 Dry-run acceptance on retained Oct 16 data (zero network): reproduce the reviewed means; report the coverage diff
- [ ] 5.0 Independent reviewer agent pass over the code and the dry-run outputs
- [ ] 6.0 Live run for the first ready date in Oct 20–26: scope → capture → inputs → materialize → outputs → review → publish → readback
