#!/bin/zsh
# VORP S3 isolation harness (adapted from ../S2/run-isolation-harness.sh). Baseline: S2's commit 9d70700ab (S1 + S2).
# 1. Weekly engine: runs the RSO engine tests (planning, streamingChain, candidatePlanMetrics) with four weekly entry points
#    wrapped. Each call runs the 9d70700ab engine and the working tree twice: plainly (off) and, for "on", after
#    laterImpactFromScenario has evaluated a scenario payload built for that snapshot, on a copy carrying the payload.
# 2. Data side: runs rosterScheduleData/planning.test.ts and forgeDailyBridge.test.ts with loadPlanningData and
#    loadForgeDailyBridgeForecasts wrapped. Each call runs the 9d70700ab loader, the working tree with
#    RSO_LATER_IMPACT_SCENARIO unset (off) and with it "on". Off must be byte-identical (JSON string) to the baseline;
#    on must be byte-identical once the new `laterImpactScenario` field is removed. The test sees the result for its own env.
# Usage: [BASE=<ref, default 9d70700ab>] run-isolation-harness.sh <empty scratch dir>. Offline; writes only to <dir>.
set -eu
S=${1:?scratch dir}
REPO=$(cd "$(dirname "$0")/../../../../.." && pwd); W=$REPO/web; L=$W/lib; R=$L/rosterScheduleOptimizer; D=$L/rosterScheduleData
BASE=${BASE:-9d70700ab}
mkdir -p $S/baseline/rosterScheduleOptimizer $S/baseline/rosterScheduleData $S/rec $S/tests
for f in planning streamingChain candidatePlanMetrics; do
  git -C $REPO show "${BASE}:web/lib/rosterScheduleOptimizer/${f}.ts" > $S/baseline/rosterScheduleOptimizer/$f.ts
  cp $R/$f.test.ts $S/tests/engine-$f.test.ts
done
for f in planning forgeDailyBridge; do
  git -C $REPO show "${BASE}:web/lib/rosterScheduleData/${f}.ts" > $S/baseline/rosterScheduleData/$f.ts
  cp $D/$f.test.ts $S/tests/data-$f.test.ts
done
python3 - "$S" "$L" "$W" <<'EOF'
import sys, re, os
S, L, W = sys.argv[1:4]
def fix(path, origin, local):
    def sub(m):
        spec = m.group(2)
        if not spec.startswith('.'): return m.group(0)
        name = spec[2:] if spec.startswith('./') else None
        if name in local: return m.group(1) + local[name] + m.group(3)
        return m.group(1) + os.path.normpath(os.path.join(origin, spec)) + m.group(3)
    text = re.sub(r'((?:from |import\(|vi\.mock\()")([^"]+)(")', sub, open(path).read())
    open(path, 'w').write(text)
engine = {'planning', 'streamingChain', 'candidatePlanMetrics'}
for f in engine: fix(f'{S}/baseline/rosterScheduleOptimizer/{f}.ts', L + '/rosterScheduleOptimizer', {n: './' + n for n in engine})
for f in engine: fix(f'{S}/tests/engine-{f}.test.ts', L + '/rosterScheduleOptimizer', {n: S + '/rec/' + n for n in engine})
data = {'planning', 'forgeDailyBridge'}
for f in data: fix(f'{S}/baseline/rosterScheduleData/{f}.ts', L + '/rosterScheduleData', {n: './' + n for n in data})
for f in data:
    path = f'{S}/tests/data-{f}.test.ts'
    text = open(path).read()
    # Named loader imports go through the recorder; `import * as planningModule` keeps the live module the route spies on.
    text = text.replace('import { loadPlanningData, normalizePlanningGames, parsePlanningDataQuery, publicPlanningForecasts } from "./planning";',
                        f'import {{ loadPlanningData, normalizePlanningGames, parsePlanningDataQuery, publicPlanningForecasts }} from "{S}/rec/dataPlanning";')
    open(path, 'w').write(text)
    fix(path, L + '/rosterScheduleData', {'forgeDailyBridge': S + '/rec/dataBridge'})
EOF
cat > $S/rec/record.ts <<EOF
import { appendFileSync } from "node:fs";
import { expect } from "vitest";
import { forecastCalendarPolicy } from "$L/player-forecasts/contributions";
import { assembleLaterImpactScenario, laterImpactFromScenario } from "$D/laterImpactInputs";
export function log(row: unknown) { appendFileSync("$S/record.jsonl", JSON.stringify(row) + "\n"); }
export function same(left: unknown, right: unknown) {
  try { expect(JSON.parse(JSON.stringify(left))).toEqual(JSON.parse(JSON.stringify(right))); return true; } catch { return false; }
}
export const testName = () => expect.getState().currentTestName ?? "?";
const addDays = (date: string, days: number) => new Date(Date.parse(date + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
const intent = { revision: 0, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
/** A scenario payload for this snapshot: verified (empty) F schedule, verified membership, no capture. */
export function scenarioFor(snapshot: any): any {
  const { context } = snapshot, first = addDays(context.endDate, 1), last = addDays(context.endDate, 21);
  const verifiedDates: string[] = []; for (let date = first; date <= last && verifiedDates.length < 31; date = addDays(date, 1)) verifiedDates.push(date);
  return assembleLaterImpactScenario({ query: { seasonId: context.seasonId, startDate: context.startDate, endDate: context.endDate },
    players: snapshot.players, weekRows: [{ id: 1, game_key: "g", season: String(Math.floor(context.seasonId / 10000)), week: 1,
      start_date: addDays(context.startDate, -30), end_date: addDays(context.endDate, 60) }], calendarPolicy: forecastCalendarPolicy(21),
    membershipAsOf: context.asOf, rosterRevision: "harness", observation: null }, new Map(),
    { startDate: first, endDate: last, asOf: context.asOf, revision: "0".repeat(64), verifiedDates, games: [], limitations: [] }, context.asOf);
}
/** Scenario on: evaluate later impact for this snapshot, then hand back a copy carrying the payload. */
export function exercise(snapshot: any, given?: any): { snapshot: any; exercised: boolean } {
  if (!snapshot?.context || !snapshot?.players) return { snapshot, exercised: false };
  try {
    const payload = scenarioFor(snapshot);
    const result = laterImpactFromScenario(payload, snapshot, given ?? intent, [], { offlineFixture: true });
    return { snapshot: { ...snapshot, laterImpactScenario: payload }, exercised: result.arms !== null };
  } catch { return { snapshot, exercised: false }; }
}
EOF
cat > $S/rec/planning.ts <<EOF
export * from "$R/planning";
import { evaluatePlan as liveEvaluate, planRoster as live } from "$R/planning";
import { evaluatePlan as oldEvaluate, planRoster as old } from "../baseline/rosterScheduleOptimizer/planning";
import { exercise, log, same, testName } from "./record";
const strip = (r: any) => ({ ...r, search: { ...r.search, elapsedMs: 0 } });
export const planRoster: typeof live = (snapshot, intent, options) => {
  const before = strip(old(snapshot, intent, options)), off = live(snapshot, intent, options);
  const scenario = exercise(snapshot, intent), on = live(scenario.snapshot, intent, options);
  log({ kind: "planRoster", test: testName(), exercised: scenario.exercised, offSame: same(before, strip(off)), onSame: same(before, strip(on)) });
  return off;
};
export const evaluatePlan: typeof liveEvaluate = (snapshot, intent, objective, ...rest) => {
  const before = oldEvaluate(snapshot, intent, objective, ...rest), off = liveEvaluate(snapshot, intent, objective, ...rest);
  const scenario = exercise(snapshot, intent), on = liveEvaluate(scenario.snapshot, intent, objective, ...rest);
  log({ kind: "evaluatePlan", test: testName(), exercised: scenario.exercised, offSame: same(before, off), onSame: same(before, on) });
  return off;
};
EOF
cat > $S/rec/candidatePlanMetrics.ts <<EOF
export * from "$R/candidatePlanMetrics";
import { candidatePlanMetrics as live } from "$R/candidatePlanMetrics";
import { candidatePlanMetrics as old } from "../baseline/rosterScheduleOptimizer/candidatePlanMetrics";
import { exercise, log, same, testName } from "./record";
export const candidatePlanMetrics: typeof live = (snapshot, intent, options) => {
  const before = old(snapshot, intent, options), off = live(snapshot, intent, options);
  const scenario = exercise(snapshot, intent), on = live(scenario.snapshot, intent, options);
  log({ kind: "candidatePlanMetrics", test: testName(), exercised: scenario.exercised, offSame: same(before, off), onSame: same(before, on) });
  return off;
};
EOF
cat > $S/rec/streamingChain.ts <<EOF
export * from "$R/streamingChain";
import { buildStreamingChains as live } from "$R/streamingChain";
import { buildStreamingChains as old } from "../baseline/rosterScheduleOptimizer/streamingChain";
import { exercise, log, same, testName } from "./record";
export const buildStreamingChains: typeof live = (inputs) => {
  const before = old(inputs), off = live(inputs);
  const scenario = exercise((inputs as any).snapshot, (inputs as any).intent);
  const on = live({ ...(inputs as any), snapshot: scenario.snapshot });
  log({ kind: "buildStreamingChains", test: testName(), exercised: scenario.exercised, offSame: same(before, off), onSame: same(before, on) });
  return off;
};
EOF
cat > $S/rec/dataPlanning.ts <<EOF
export * from "$D/planning";
import { loadPlanningData as live } from "$D/planning";
import { loadPlanningData as old } from "../baseline/rosterScheduleData/planning";
import { log, testName } from "./record";
const FLAG = "RSO_LATER_IMPACT_SCENARIO";
type Outcome = { ok: boolean; value: any; error?: unknown; proofs?: unknown };
export const loadPlanningData: typeof live = async (db, query, options = {}) => {
  const own = process.env[FLAG], now = options.now ?? new Date();
  const run = async (flag: string | undefined, load: typeof live): Promise<Outcome> => {
    if (flag === undefined) delete process.env[FLAG]; else process.env[FLAG] = flag;
    const outcome: Outcome = { ok: false, value: null };
    try { outcome.value = await load(db, query, { ...options, now, onBridgeRunProofs: proofs => { outcome.proofs = proofs; } }); outcome.ok = true; }
    catch (error) { outcome.error = error; outcome.value = String(error); }
    finally { if (own === undefined) delete process.env[FLAG]; else process.env[FLAG] = own; }
    return outcome;
  };
  const before = await run(undefined, old), off = await run(undefined, live), on = await run("on", live);
  const text = (outcome: Outcome, drop = false) => outcome.ok ? JSON.stringify(drop ? (({ laterImpactScenario: _s, ...rest }) => rest)(outcome.value) : outcome.value) : "error:" + outcome.value;
  log({ kind: "loadPlanningData", test: testName(), exercised: on.ok && !!on.value.laterImpactScenario,
    offSame: text(before) === text(off) && JSON.stringify(before.proofs) === JSON.stringify(off.proofs),
    onSame: text(before) === text(on, true) && JSON.stringify(before.proofs) === JSON.stringify(on.proofs) });
  const chosen = own === "on" ? on : off;
  if (chosen.proofs !== undefined) options.onBridgeRunProofs?.(chosen.proofs as never);
  if (!chosen.ok) throw chosen.error;
  return chosen.value;
};
EOF
cat > $S/rec/dataBridge.ts <<EOF
export * from "$D/forgeDailyBridge";
import { loadForgeDailyBridgeForecasts as live } from "$D/forgeDailyBridge";
import { loadForgeDailyBridgeForecasts as old } from "../baseline/rosterScheduleData/forgeDailyBridge";
import { log, testName } from "./record";
export const loadForgeDailyBridgeForecasts: typeof live = async (...args) => {
  const settle = async (work: () => Promise<unknown>) => { try { return JSON.stringify(await work()); } catch (error) { return "error:" + String(error); } };
  let captured = false;
  const before = await settle(() => old(...(args.slice(0, 7) as Parameters<typeof old>)));
  const off = await settle(() => live(...(args.slice(0, 7) as Parameters<typeof live>)));
  const on = await settle(() => live(...(args.slice(0, 7) as Parameters<typeof live>), () => { captured = true; }));
  log({ kind: "loadForgeDailyBridgeForecasts", test: testName(), exercised: captured, offSame: before === off, onSame: before === on });
  return live(...args);
};
EOF
cat > $S/vitest.s3.mts <<EOF
import { defineConfig } from "$W/node_modules/vitest/dist/config.js";
const alias = ["components", "contexts", "hooks", "lib", "pages", "public", "styles", "utils"].map(name => ({ find: new RegExp("^" + name + "/"), replacement: "$W/" + name + "/" }));
export default defineConfig({ root: "$W", resolve: { alias }, server: { fs: { allow: ["/"] } },
  // Each wrapped loader runs three times, so bounded-deadline tests take about three times longer; a test that timed out would
  // leave its loader running and toggling the flag under the next test, so the timeout is raised instead.
  test: { environment: "jsdom", setupFiles: ["$W/__tests__/vitest.setup.js"], dir: "$S/tests", include: ["**/*.test.ts"], testTimeout: 120000 } });
EOF
rm -f $S/record.jsonl
(cd $W && npx vitest run --config $S/vitest.s3.mts) || echo "(vitest exited non-zero; counts below are still recorded)"
python3 - "$S/record.jsonl" <<'EOF'
import json, sys, collections
by = collections.defaultdict(list)
for line in open(sys.argv[1]): row = json.loads(line); by[row['kind']].append(row)
for kind, rows in sorted(by.items()):
  print(kind, 'calls', len(rows), '| scenario exercised', sum(r['exercised'] for r in rows),
    '| mismatches vs baseline: off', sum(not r['offSame'] for r in rows), 'on', sum(not r['onSame'] for r in rows))
EOF
