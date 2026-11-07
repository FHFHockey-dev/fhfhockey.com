#!/bin/zsh
# VORP S1 primary-identity harness. Runs the existing RSO engine tests with the three engine entry points wrapped: each call
# runs the HEAD (pre-S1) engine and the working-tree engine on the same input and logs whether the primary output matches.
# Usage: [BASE=<pre-S1 engine ref, default 5453d2eca>] run-primary-harness.sh <empty scratch dir> [tests: git ref, default HEAD, or "worktree"]. Offline; writes only to <dir>.
set -eu
S=${1:?scratch dir}; REF=${2:-HEAD}
REPO=$(cd "$(dirname "$0")/../../../../.." && pwd); W=$REPO/web; L=$W/lib; R=$L/rosterScheduleOptimizer
mkdir -p $S/baseline $S/rec $S/tests
for f in planning streamingChain candidatePlanMetrics; do
  git -C $REPO show "${BASE:-5453d2eca}:web/lib/rosterScheduleOptimizer/${f}.ts" > $S/baseline/$f.ts
  if [ "$REF" = worktree ]; then cp $R/$f.test.ts $S/tests/; else git -C $REPO show "${REF}:web/lib/rosterScheduleOptimizer/${f}.test.ts" > $S/tests/$f.test.ts; fi
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
export function same(left: unknown, right: unknown) {
  try { expect(JSON.parse(JSON.stringify(left))).toEqual(JSON.parse(JSON.stringify(right))); return true; } catch { return false; }
}
export const testName = () => expect.getState().currentTestName ?? "?";
EOF
cat > $S/rec/planning.ts <<EOF
export * from "$R/planning";
import { planRoster as live } from "$R/planning";
import { planRoster as old } from "../baseline/planning";
import { log, same, testName } from "./record";
const drops = (steps: Array<{ dropPlayerId?: string; type: string; playerId: string }>) => steps.flatMap(s => s.dropPlayerId ? [s.dropPlayerId] : s.type === "drop" ? [s.playerId] : []).sort().join("|");
// Primary = everything except list places after the best plan, the S1 disclosure line, elapsed time and streaming alternatives.
const strip = (r: any) => ({ ...r, alternatives: r.alternatives.slice(0, 2),
  search: { ...r.search, elapsedMs: 0, limitations: r.search.limitations.filter((t: string) => !t.startsWith("Beam reserve:")) },
  streaming: r.streaming && (({ alternatives, alternativesTruncated, ...rest }: any) => rest)(r.streaming) });
export const planRoster: typeof live = (snapshot, intent, options) => {
  const before = old(snapshot, intent, options), after = live(snapshot, intent, options);
  log({ kind: "planRoster", test: testName(), primarySame: same(strip(before), strip(after)),
    altBefore: before.alternatives.length - 1, altAfter: after.alternatives.length - 1,
    dropSetsBefore: new Set(before.alternatives.slice(1).map(a => drops(a.steps))).size, dropSetsAfter: new Set(after.alternatives.slice(1).map(a => drops(a.steps))).size,
    reserve: after.search.limitations.find(t => t.startsWith("Beam reserve:")) ?? null, streamChainsSame: same(before.streaming?.chains, after.streaming?.chains),
    streamChains: after.streaming?.chains.length ?? 0, streamAlternatives: (after.streaming as any)?.alternatives?.length ?? 0 });
  return after;
};
EOF
cat > $S/rec/candidatePlanMetrics.ts <<EOF
export * from "$R/candidatePlanMetrics";
import { candidatePlanMetrics as live } from "$R/candidatePlanMetrics";
import { candidatePlanMetrics as old } from "../baseline/candidatePlanMetrics";
import { log, same, testName } from "./record";
const key = (p: any) => p.steps.flatMap((s: any) => s.dropPlayerId ? [s.dropPlayerId] : []).sort().join("|");
const strip = (r: any) => ({ ...r, candidates: r.candidates.map(({ alternatives, alternativesTruncated, ...rest }: any) => rest) });
export const candidatePlanMetrics: typeof live = (snapshot, intent, options) => {
  const before = old(snapshot, intent, options), after = live(snapshot, intent, options);
  log({ kind: "candidatePlanMetrics", test: testName(), primarySame: same(strip(before), strip(after)), candidates: after.candidates.length,
    dropSetsBefore: before.candidates.reduce((n: number, c: any) => n + new Set(c.plans.map(key)).size, 0),
    dropSetsAfter: after.candidates.reduce((n: number, c: any) => n + new Set([...c.plans, ...(c.alternatives ?? [])].map(key)).size, 0),
    alternatives: after.candidates.reduce((n: number, c: any) => n + (c.alternatives?.length ?? 0), 0),
    truncated: after.candidates.reduce((n: number, c: any) => n + (c.alternativesTruncated ?? 0), 0) });
  return after;
};
EOF
cat > $S/rec/streamingChain.ts <<EOF
export * from "$R/streamingChain";
import { buildStreamingChains as live } from "$R/streamingChain";
import { buildStreamingChains as old } from "../baseline/streamingChain";
import { log, same, testName } from "./record";
export const buildStreamingChains: typeof live = (inputs) => {
  const before = old(inputs), after = live(inputs);
  const { alternatives, alternativesTruncated, ...rest } = after;
  log({ kind: "buildStreamingChains", test: testName(), primarySame: same(before, rest), chains: after.chains.length, alternatives: alternatives?.length ?? 0 });
  return after;
};
EOF
cat > $S/vitest.s1.mts <<EOF
import { defineConfig } from "$W/node_modules/vitest/dist/config.js";
const alias = ["components", "contexts", "hooks", "lib", "pages", "public", "styles", "utils"].map(name => ({ find: new RegExp("^" + name + "/"), replacement: "$W/" + name + "/" }));
export default defineConfig({ root: "$W", resolve: { alias }, server: { fs: { allow: ["/"] } },
  test: { environment: "jsdom", setupFiles: ["$W/__tests__/vitest.setup.js"], dir: "$S/tests", include: ["**/*.test.ts"] } });
EOF
rm -f $S/record.jsonl
(cd $W && npx vitest run --config $S/vitest.s1.mts)
python3 - "$S/record.jsonl" <<'EOF'
import json, sys, collections
by = collections.defaultdict(list)
for line in open(sys.argv[1]): row = json.loads(line); by[row['kind']].append(row)
for kind, rows in by.items(): print(kind, 'calls', len(rows), 'primary mismatches', sum(not r['primarySame'] for r in rows))
p, c = by['planRoster'], by['candidatePlanMetrics']
print('planner: streaming chains identical', all(r['streamChainsSame'] for r in p), '| listed alternatives', sum(r['altBefore'] for r in p), '->', sum(r['altAfter'] for r in p),
  '| distinct drop sets shown', sum(r['dropSetsBefore'] for r in p), '->', sum(r['dropSetsAfter'] for r in p), '| calls gaining', sum(r['dropSetsAfter'] > r['dropSetsBefore'] for r in p),
  'losing', sum(r['dropSetsAfter'] < r['dropSetsBefore'] for r in p), '| calls with beam reserve', sum(bool(r['reserve']) for r in p))
print('streaming via planner: chains', sum(r['streamChains'] for r in p), 'alternatives', sum(r['streamAlternatives'] for r in p), 'calls with alternatives', sum(r['streamAlternatives'] > 0 for r in p))
print('best fit: candidates', sum(r['candidates'] for r in c), '| drop sets', sum(r['dropSetsBefore'] for r in c), '->', sum(r['dropSetsAfter'] for r in c),
  '| alternative plans', sum(r['alternatives'] for r in c), '| truncated sets', sum(r['truncated'] for r in c), '| calls changed', sum(r['dropSetsAfter'] > r['dropSetsBefore'] for r in c))
EOF
