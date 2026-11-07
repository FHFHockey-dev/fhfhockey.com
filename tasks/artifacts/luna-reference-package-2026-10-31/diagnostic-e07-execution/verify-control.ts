import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { operate, read, save } from "./control";

async function main() {
  const root = resolve(".."), base = join(root, "tasks/artifacts/luna-reference-package-2026-10-31"), dir = join(base, "diagnostic-e07-execution"), frozen = join(base, "diagnostic-e07-e16-r2");
  const before = readFileSync(join(base, "paid-evaluation/ledger.json")), start = JSON.parse(before.toString()), plan = read(join(frozen, "PLAN.json"));
  const wire = read(join(frozen, "REQUESTS.json")).requests, mock = read(join(base, "omission-diagnosis/rehearsal/SYNTHETIC-ONLY-ledger.json"));
  const results: any[] = [];
  for (const scenario of ["all-pass", "offset-E10", "uncertain-E07", "incomplete-decisions-E10", "corrupt-E07", "occupied-candidate-E07"]) {
    const temp = mkdtempSync(join(tmpdir(), "luna-diagnostic-supervisor-")), ledgerPath = join(temp, "SYNTHETIC-ONLY-ledger.json");
    try {
      writeFileSync(join(temp, "START-LEDGER.json"), before as unknown as Uint8Array);
      const live = read(join(dir, "LIVE-PREFLIGHT.json")); live.checkedAt = "2026-10-31T23:00:00Z"; save(join(temp, "LIVE-PREFLIGHT.json"), live);
      save(ledgerPath, { ...start, ...plan.activationProposalOnly.setOnlyAfterReview });
      const config = { root, directory: temp, ledgerPath, now: () => Date.parse("2026-10-31T23:00:00Z") };
      const anchors: any[] = [], records: any[] = []; let calls = 0, stopped = false;
      for (const id of plan.selectedCaseIds) {
        if (scenario === "occupied-candidate-E07") writeFileSync(join(temp, `${id}.candidate.json`), "occupied");
        let pre: any;
        try { pre = await operate(config, "preflight", id, anchors); }
        catch { stopped = true; break; }
        const fixture = { requests: wire.filter((r: any) => r.caseId === id).map((r: any) => {
          const reply = structuredClone(mock.attempts[r.hash].receipt.body);
          if (scenario === "offset-E10" && id === "E10" && r.endpoint === "responses") {
            const raw = JSON.parse(reply.output[0].content[0].text); raw.goalieStatuses[0].evidence.end--; reply.output[0].content[0].text = JSON.stringify(raw);
          }
          if (scenario === "incomplete-decisions-E10" && id === "E10" && r.endpoint === "decisions") reply.status = "incomplete";
          return { ...r, reply, requestId: `offline-supervisor-${id}-${r.endpoint}`, throwUncertain: scenario === "uncertain-E07" };
        }) };
        const fixturePath = join(temp, `${id}.fixture.json`), callsPath = join(temp, `${id}.calls.json`); save(fixturePath, fixture);
        const cli = spawnSync(process.execPath, ["--experimental-require-module", "-r", "ts-node/register/transpile-only", "-r", join(frozen, "mock-cli-provider.cjs"),
          "scripts/review-ifttt-luna.ts", "--input", join(frozen, "inputs", `${id}.json`), "--output", join(temp, `${id}.original.json`),
          "--binding-candidate-output", join(temp, `${id}.candidate.json`), "--ledger", ledgerPath, "--dispatch"], {
          cwd: join(root, "web"), encoding: "utf8", env: { PATH: process.env.PATH, TMPDIR: tmpdir(), NODE_PATH: ".:./node_modules", NODE_ENV: "test",
            NODE_OPTIONS: `--require=${join(base, "deny-network.cjs")}`, TS_NODE_COMPILER_OPTIONS: '{"module":"CommonJS","moduleResolution":"node","allowJs":false}',
            OPENAI_API_KEY: "offline-not-a-credential", IFTTT_LUNA_REVIEW_ENABLED: "true", IFTTT_LUNA_REVIEW_STOP: "false", LUNA_OFFLINE_FIXTURE: fixturePath, LUNA_OFFLINE_CALLS: callsPath } });
        assert([0, 2].includes(cli.status!), cli.stderr); const observed = read(callsPath); calls += observed.calls.length; assert.equal(observed.actualProviderRequests, 0);
        const result: any = await operate(config, "grade", id, anchors, cli.status!, pre.preflightHash); records.push(result);
        if (result.anchor) anchors.push(result.anchor);
        if (scenario === "offset-E10" && id === "E10") {
          assert.equal(result.outcome, "recorded_model_failure"); assert(result.candidateAvailable); assert.equal(result.callsThisReport, 1);
          assert.equal(result.decisionsDisposition, "not_run_original_responses_held"); assert(result.proceed);
        }
        if (!result.proceed) { stopped = id !== "E16"; break; }
        if (scenario === "corrupt-E07") writeFileSync(join(temp, "E07.candidate.json"), "{}");
      }
      const final = read(ledgerPath); assert.equal(final.enabled, false);
      for (const [hash, value] of Object.entries(start.attempts)) assert.deepEqual(final.attempts[hash], value);
      assert.equal(stopped, !["all-pass", "offset-E10"].includes(scenario));
      assert.equal(calls, ({ "all-pass": 12, "offset-E10": 11, "uncertain-E07": 1, "incomplete-decisions-E10": 5, "corrupt-E07": 1, "occupied-candidate-E07": 0 } as any)[scenario]);
      if (scenario === "uncertain-E07") { const last: any = Object.values(final.attempts).at(-1); assert.equal(last.state, "uncertain"); assert.equal(last.reservedNanoUsd, 233000000); assert.equal(final.blockedReason, "unknown_billed_outcome"); }
      results.push({ scenario, mockCalls: calls, actualProviderRequests: 0, stopped, ledgerEnabled: final.enabled, blockedReason: final.blockedReason, priorSevenPreserved: true, records });
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  assert.deepEqual(readFileSync(join(base, "paid-evaluation/ledger.json")), before);
  save(join(dir, "OFFLINE-CONTROL-VERIFICATION.json"), { scenariosPassed: results.length, actualProviderRequests: 0, realLedgerUnchanged: true, scenarios: results });
  process.stdout.write(JSON.stringify({ scenariosPassed: results.length, actualProviderRequests: 0, realLedgerUnchanged: true }) + "\n");
}
main().catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });
