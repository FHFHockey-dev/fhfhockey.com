#!/bin/zsh
# VORP S4a primary-identity harness (adapted from ../S1/run-primary-harness.sh). Runs the working-tree RSO engine tests with
# three engine entry points wrapped. Each call runs the baseline engine (f3e95cf78) and the working-tree engine on the same
# input and logs whether the primary output is byte-identical (JSON text): streaming everything except `alternatives` and
# `alternativesTruncated`; planRoster everything except those two streaming fields and search.elapsedMs. Best Fit calls
# also count each candidate's alternative as shown or collapsed under CandidateBrowser's `alternativeShown` rule (before S4
# every alternative was shown). Usage: [BASE=<engine ref, default f3e95cf78>] run-primary-harness.sh <empty scratch dir>.
# Offline; writes only to <dir>.
set -eu
S=${1:?scratch dir}
REPO=$(cd "$(dirname "$0")/../../../../.." && pwd); W=$REPO/web; L=$W/lib; R=$L/rosterScheduleOptimizer
mkdir -p $S/baseline $S/rec $S/tests
for f in planning streamingChain candidatePlanMetrics; do
  git -C $REPO show "${BASE:-f3e95cf78}:web/lib/rosterScheduleOptimizer/${f}.ts" > $S/baseline/$f.ts
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
export function log(row: unknown) { appendFileSync("$S/record.jsonl", JSON.stringify(row) + "\n"); }
export const bytes = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
export const testName = () => expect.getState().currentTestName ?? "?";
export const primary = (plan: any) => plan && (({ alternatives, alternativesTruncated, ...rest }: any) => rest)(plan);
export const alternatives = (plan: any) => ({ count: plan?.alternatives?.length ?? 0, truncated: plan?.alternativesTruncated ?? 0,
  otherGoal: (plan?.alternatives ?? []).filter((chain: any) => chain.wins?.length === 1 && chain.wins[0] !== (plan.chains[0]?.evaluation?.objective === "outcome" ? "points" : "games")).length });
EOF
cat > $S/rec/planning.ts <<EOF
export * from "$R/planning";
import { planRoster as live } from "$R/planning";
import { planRoster as old } from "../baseline/planning";
import { alternatives, bytes, log, primary, testName } from "./record";
const strip = (r: any) => ({ ...r, search: { ...r.search, elapsedMs: 0 }, streaming: primary(r.streaming) });
export const planRoster: typeof live = (snapshot, intent, options) => {
  const before = old(snapshot, intent, options), after = live(snapshot, intent, options);
  log({ kind: "planRoster", test: testName(), primarySame: bytes(strip(before), strip(after)),
    chainsSame: bytes(before.streaming?.chains, after.streaming?.chains), recommendedSame: bytes(before.streaming?.recommended, after.streaming?.recommended),
    before: alternatives(before.streaming), after: alternatives(after.streaming) });
  return after;
};
EOF
cat > $S/rec/streamingChain.ts <<EOF
export * from "$R/streamingChain";
import { buildStreamingChains as live } from "$R/streamingChain";
import { buildStreamingChains as old } from "../baseline/streamingChain";
import { alternatives, bytes, log, primary, testName } from "./record";
export const buildStreamingChains: typeof live = (inputs) => {
  const before = old(inputs), after = live(inputs);
  log({ kind: "buildStreamingChains", test: testName(), primarySame: bytes(primary(before), primary(after)),
    chainsSame: bytes(before.chains, after.chains), recommendedSame: bytes(before.recommended, after.recommended),
    before: alternatives(before), after: alternatives(after) });
  return after;
};
EOF
cat > $S/rec/candidatePlanMetrics.ts <<EOF
export * from "$R/candidatePlanMetrics";
import { candidateAlternativeForSort, candidatePlanForSort, candidatePlanMetrics as live } from "$R/candidatePlanMetrics";
import { candidatePlanMetrics as old } from "../baseline/candidatePlanMetrics";
import { alternativeShown } from "$W/components/RosterScheduleOptimizer/CandidateBrowser";
import { bytes, log, testName } from "./record";
export const candidatePlanMetrics: typeof live = (snapshot, intent, options) => {
  const before = old(snapshot, intent, options), after = live(snapshot, intent, options);
  const categories = snapshot.rules?.scoring.mode === "categories", counts = { points: { shown: 0, collapsed: 0 }, schedule: { shown: 0, collapsed: 0 } };
  for (const sort of categories ? ["schedule" as const] : ["points" as const, "schedule" as const]) for (const comparison of after.candidates) {
    const plan = candidatePlanForSort(comparison.plans, sort), alternative = plan && candidateAlternativeForSort(comparison, sort);
    if (plan && alternative) counts[sort][alternativeShown(plan, alternative, categories) ? "shown" : "collapsed"]++;
  }
  log({ kind: "candidatePlanMetrics", test: testName(), primarySame: bytes(before, after), counts });
  return after;
};
EOF
cat > $S/vitest.s4.mts <<EOF
import { defineConfig } from "$W/node_modules/vitest/dist/config.js";
const alias = ["components", "contexts", "hooks", "lib", "pages", "public", "styles", "utils"].map(name => ({ find: new RegExp("^" + name + "/"), replacement: "$W/" + name + "/" }));
export default defineConfig({ root: "$W", resolve: { alias }, server: { fs: { allow: ["/"] } }, esbuild: { jsx: "automatic" },
  test: { environment: "jsdom", setupFiles: ["$W/__tests__/vitest.setup.js"], dir: "$S/tests", include: ["**/*.test.ts"] } });
EOF
rm -f $S/record.jsonl
(cd $W && npx vitest run --config $S/vitest.s4.mts)
python3 - "$S/record.jsonl" <<'EOF'
import json, sys, collections
by = collections.defaultdict(list)
for line in open(sys.argv[1]): row = json.loads(line); by[row['kind']].append(row)
for kind in ('buildStreamingChains', 'planRoster'):
  rows = by[kind]
  print(kind, 'calls', len(rows), '| primary mismatches', sum(not r['primarySame'] for r in rows), '| chains mismatches', sum(not r['chainsSame'] for r in rows),
    '| recommended mismatches', sum(not r['recommendedSame'] for r in rows), '| alternatives', sum(r['before']['count'] for r in rows), '->', sum(r['after']['count'] for r in rows),
    '| truncated', sum(r['before']['truncated'] for r in rows), '->', sum(r['after']['truncated'] for r in rows), '| other-goal-only alternatives added', sum(r['after']['otherGoal'] for r in rows),
    '| calls gaining one', sum(r['after']['count'] > r['before']['count'] for r in rows))
c = by['candidatePlanMetrics']
total = lambda sort, key: sum(r['counts'][sort][key] for r in c)
print('candidatePlanMetrics calls', len(c), '| primary mismatches', sum(not r['primarySame'] for r in c))
for sort in ('points', 'schedule'):
  shown, collapsed = total(sort, 'shown'), total(sort, 'collapsed')
  print(f'best fit {sort} sort: alternatives {shown + collapsed} | before S4 shown {shown + collapsed}, collapsed 0 | after S4 shown {shown}, collapsed {collapsed}')
EOF
