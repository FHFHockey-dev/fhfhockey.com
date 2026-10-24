# Independent P07 verification receipts

- Canonical checkout read: octoberBranch, HEAD67b9efda5901a5f8c25a25889572e85527056f7a.
- Python hashlib SHA-256 comparison: all17 CANDIDATE.json files matched. START-HASHES.json pins those plus eight relevant caller/instruction files. END-HASHES.json records the final comparison.
- /usr/local/bin/node --version: v22.11.0. /usr/local/bin/npm --version:10.9.0.
- Copied exact rsoUsePolicy.ts and its test plus the unchanged owner bridge-claim oracle into a fresh ordinary /tmp directory. Used existing node_modules by symlink; installed nothing. Minimal package script test=vitest; node environment, one thread, private cache, no setup imports or application environment. Saved network-deny preload blocks net/http/https/fetch.

Executed from /tmp/fhfh-p07-independent-t6aa89me/web:

```sh
env -i PATH=/usr/local/bin:/usr/bin:/bin \
  HOME=/tmp/fhfh-p07-independent-t6aa89me/web/.audit-home \
  TMPDIR=/tmp/fhfh-p07-independent-t6aa89me/web/.audit-tmp \
  NODE_OPTIONS='--require /tmp/fhfh-p07-independent-t6aa89me/web/audit-network-deny.cjs' \
  npm test -- --run --config audit.vitest.config.mts \
  lib/player-forecasts/rsoUsePolicy.test.ts \
  lib/player-forecasts/bridge-claim-oracle.test.ts
```

Exit1:17 policy tests passed,1 C08 oracle failed. Expected false, received true at oracle13. See offline-policy-oracle.log. The failing assertion was not weakened or skipped.

Relevant source inspection: server data selection/gate, transport/wire reconstruction, workspace GET/PUT ownership and persistence, provider caller, current component data read and saved/provider snapshot assembly, forecast refresh rejection behavior, worker and fallback calls, two goalie display resolver consumers, Start Chart consumer. No external execution, broad suite, application type/lint/build or browser run.
