# Focused reproduction

Use `/tmp/fhfh-rso-correctness-20261023/web` with the original packet's clean environment and network-denial harness. Source pins match the review snapshot. The artifact `confirmedStartReview.test.ts` is copied only into that temporary tree under `lib/rosterScheduleOptimizer/`; do not add the two intentionally failing policy assertions to the canonical application suite without owner scope reconciliation.

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin TZ=UTC \
 NODE_OPTIONS='--require /tmp/fhfh-rso-correctness-20261023/web/audit-network-deny.cjs --max-old-space-size=8192' \
 npm_config_offline=true npm test -- --run --config audit.vitest.config.mts \
 lib/rosterScheduleOptimizer/confirmedStartReview.test.ts
```

Expected current receipt:12passed,2failed (likely/projected unchanged-prior assertions). `confirmed-tests.json` contains exact cases; `confirmed-assertions.log` retains readable failure output. The original fixture assertions are preserved; no `it.fails` wrapper.

The Yahoo acquisition source filter is:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin TZ=UTC \
 NODE_OPTIONS='--require /tmp/fhfh-rso-correctness-20261023/web/audit-network-deny.cjs --max-old-space-size=8192' \
 npm_config_offline=true npm test -- --run --config audit.vitest.config.mts \
 lib/integrations/yahoo/rosterPlanning.test.ts -t 'Yahoo goalie starting status'
```

Expected3passed/75skipped. This mocked provider test confirms upstream label acquisition; it does not establish a trusted positive Yahoo-to-planner authority path. No fullsuite/static rerun was needed for application source because this follow-up edits no application files.
