#!/bin/zsh
# VORP S2 weekly-isolation harness (adapted from ../S1/run-primary-harness.sh). Runs the existing RSO engine tests with four
# weekly entry points wrapped. Each call runs the accepted S1 engine (081fcb849) and the working-tree engine twice: once
# plainly (scenario off) and once right after exercising the S2 scenario hook on a marked copy of the same snapshot
# (scenario on). It logs whether each full output matches the S1 output (planRoster ignores only search.elapsedMs).
# Usage: [BASE=<S1 engine ref, default 081fcb849>] run-isolation-harness.sh <empty scratch dir>. Offline; writes only to <dir>.
set -eu
S=${1:?scratch dir}
REPO=$(cd "$(dirname "$0")/../../../../.." && pwd); W=$REPO/web; L=$W/lib; R=$L/rosterScheduleOptimizer
mkdir -p $S/baseline $S/rec $S/tests
for f in planning streamingChain candidatePlanMetrics; do
  git -C $REPO show "${BASE:-081fcb849}:web/lib/rosterScheduleOptimizer/${f}.ts" > $S/baseline/$f.ts
  cp $R/$f.test.ts $S/tests/
done
python3 - "$S" "$L" <<'EOF'
import sys, re
S, L = sys.argv[1], sys.argv[2]; R = L + '/rosterScheduleOptimizer'; three = {'planning', 'streamingChain', 'candidatePlanMetrics'}
def fix(path, local):
    def sub(m):
        spec = m.group(2)
        if spec.startswith('./'): return m.group(1) + (local.get(spec[2:]) or R + '/' + spec[2:]) + m.group(3)
        if spec.startswith('../'): return m.group(1) + L + '/' + spec[3:] + m.group(3)
        return m.group(0)
    text = re.sub(r'(from ")([^"]+)(")', sub, open(path).read())
    open(path, 'w').write(text)
for f in three: fix(f'{S}/baseline/{f}.ts', {n: './' + n for n in three})
for f in three: fix(f'{S}/tests/{f}.test.ts', {n: S + '/rec/' + n for n in three})
EOF
cat > $S/rec/record.ts <<EOF
import { appendFileSync } from "node:fs";
import { expect } from "vitest";
import { evaluateScenarioPlan, LATER_IMPACT_USE } from "$R/planning";
export function log(row: unknown) { appendFileSync("$S/record.jsonl", JSON.stringify(row) + "\n"); }
export function same(left: unknown, right: unknown) {
  try { expect(JSON.parse(JSON.stringify(left))).toEqual(JSON.parse(JSON.stringify(right))); return true; } catch { return false; }
}
export const testName = () => expect.getState().currentTestName ?? "?";
const intent = { revision: 0, steps: [], protectedPlayerIds: [], excludedPlayerIds: [], goalieCoverage: "accept_risk", goalieWindow: "any", goalieSplit: "mon_thu", alternativeCount: 5 };
/** Scenario on: run the S2 hook over a marked copy of this snapshot. Returns whether it evaluated. */
export function exercise(snapshot: any, given?: any): boolean {
  if (!snapshot?.forecasts) return false;
  try {
    evaluateScenarioPlan({ ...snapshot, baselineSources: undefined, participationSources: undefined,
      forecasts: snapshot.forecasts.map((row: any) => ({ ...row, scenarioUse: LATER_IMPACT_USE })) }, given ?? intent, "outcome", LATER_IMPACT_USE);
    return true;
  } catch { return false; }
}
EOF
cat > $S/rec/planning.ts <<EOF
export * from "$R/planning";
import { evaluatePlan as liveEvaluate, planRoster as live } from "$R/planning";
import { evaluatePlan as oldEvaluate, planRoster as old } from "../baseline/planning";
import { exercise, log, same, testName } from "./record";
const strip = (r: any) => ({ ...r, search: { ...r.search, elapsedMs: 0 } });
export const planRoster: typeof live = (snapshot, intent, options) => {
  const before = strip(old(snapshot, intent, options)), off = live(snapshot, intent, options);
  const exercised = exercise(snapshot, intent), on = live(snapshot, intent, options);
  log({ kind: "planRoster", test: testName(), exercised, offSame: same(before, strip(off)), onSame: same(before, strip(on)) });
  return off;
};
export const evaluatePlan: typeof liveEvaluate = (snapshot, intent, objective, ...rest) => {
  const before = oldEvaluate(snapshot, intent, objective, ...rest), off = liveEvaluate(snapshot, intent, objective, ...rest);
  const exercised = exercise(snapshot, intent), on = liveEvaluate(snapshot, intent, objective, ...rest);
  log({ kind: "evaluatePlan", test: testName(), exercised, offSame: same(before, off), onSame: same(before, on) });
  return off;
};
EOF
cat > $S/rec/candidatePlanMetrics.ts <<EOF
export * from "$R/candidatePlanMetrics";
import { candidatePlanMetrics as live } from "$R/candidatePlanMetrics";
import { candidatePlanMetrics as old } from "../baseline/candidatePlanMetrics";
import { exercise, log, same, testName } from "./record";
export const candidatePlanMetrics: typeof live = (snapshot, intent, options) => {
  const before = old(snapshot, intent, options), off = live(snapshot, intent, options);
  const exercised = exercise(snapshot, intent), on = live(snapshot, intent, options);
  log({ kind: "candidatePlanMetrics", test: testName(), exercised, offSame: same(before, off), onSame: same(before, on) });
  return off;
};
EOF
cat > $S/rec/streamingChain.ts <<EOF
export * from "$R/streamingChain";
import { buildStreamingChains as live } from "$R/streamingChain";
import { buildStreamingChains as old } from "../baseline/streamingChain";
import { exercise, log, same, testName } from "./record";
export const buildStreamingChains: typeof live = (inputs) => {
  const before = old(inputs), off = live(inputs);
  const exercised = exercise((inputs as any).snapshot, (inputs as any).intent), on = live(inputs);
  log({ kind: "buildStreamingChains", test: testName(), exercised, offSame: same(before, off), onSame: same(before, on) });
  return off;
};
EOF
cat > $S/vitest.s2.mts <<EOF
import { defineConfig } from "$W/node_modules/vitest/dist/config.js";
const alias = ["components", "contexts", "hooks", "lib", "pages", "public", "styles", "utils"].map(name => ({ find: new RegExp("^" + name + "/"), replacement: "$W/" + name + "/" }));
export default defineConfig({ root: "$W", resolve: { alias }, server: { fs: { allow: ["/"] } },
  test: { environment: "jsdom", setupFiles: ["$W/__tests__/vitest.setup.js"], dir: "$S/tests", include: ["**/*.test.ts"] } });
EOF
rm -f $S/record.jsonl
(cd $W && npx vitest run --config $S/vitest.s2.mts)
python3 - "$S/record.jsonl" <<'EOF'
import json, sys, collections
by = collections.defaultdict(list)
for line in open(sys.argv[1]): row = json.loads(line); by[row['kind']].append(row)
for kind, rows in sorted(by.items()):
  print(kind, 'calls', len(rows), '| scenario exercised', sum(r['exercised'] for r in rows),
    '| mismatches vs S1: off', sum(not r['offSame'] for r in rows), 'on', sum(not r['onSame'] for r in rows))
EOF
