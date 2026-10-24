# Queue verification relocation correction

The independent review's P2 is fixed locally. Its two offline reproductions remain the before-fix
evidence: the integration-test hash mismatch, followed by the missing old SQL path. They were not
repeated by executing SQL or loading the old target.

Only `VERIFY-QUEUE.cjs` changed beyond the accepted relocation packet. New
`SOURCE-RELOCATION.v1.json` explicitly maps the two affected historical inputs:

- The integration test retains its path but uses the accepted path-only edit hash
  `778fb645067f9f45830dab69f90b721ad838d26cb4023356319634d081310025`.
- The billing SQL resolves to the retained draft with unchanged hash
  `d78b385ec6b8acfbfcc6ba2909d5f558765cd90e8e4a18a2febab68bf146db12`.

The runner pins this versioned manifest's hash, verifies the historical manifest and accepted
relocation receipt hashes, and checks each mapping against its historical predecessor hash.
Moved SQL must retain the same hash. All other frozen inputs keep their original expected hashes.
The same strict verification function runs before and after database work; no failure is ignored.
Future SQL runs write new, exclusive `RESULTS.relocation-v1.json` / `FAILED-RESULT.relocation-v1.json`
files and reject existing result destinations, preserving the historical execution receipts.

## Offline verification

```sh
node tasks/artifacts/in-season-billing-2026-10-21/queue-sql-verification/VERIFY-QUEUE.cjs --preflight
node --test tasks/artifacts/billing-migration-authority-2026-10-22/queue-preflight-fix/VERIFY-QUEUE-PREFLIGHT.test.cjs
node --check tasks/artifacts/in-season-billing-2026-10-21/queue-sql-verification/VERIFY-QUEUE.cjs
```

- **Passed:** actual runner preflight resolves all seven inputs. `--preflight` exits before loading
  target configuration or a PostgreSQL client.
- **Passed:** 14 regression cases execute the actual runner source in a VM that permits only the
  specific local source/manifest reads and built-in hash/path/assert modules. They reject changes
  to every one of the seven inputs, all three provenance anchors, missing retained SQL, and
  post-preflight changes to both relocated SQL and an unchanged application input.
- **Passed:** syntax and scoped diff whitespace checks. SQL bytes, five unaffected frozen input
  hashes, prior non-runner relocation pins, authority/test/summary pins and four historical queue
  receipts remain unchanged.
- **Not run:** full queue SQL execution or any database/service check. The earlier 84 application
  tests were not rerun because this correction changes only the artifact runner and hash manifest.

[Actual preflight receipt](CURRENT-PREFLIGHT.json), [14-test TAP receipt](PREFLIGHT-TESTS.tap),
[exact runner delta](VERIFY-QUEUE.cjs.patch), [source pins and checks](CHANGED-FILES.json).

Runner SHA-256: `fe5e21a26ce2ac31a3bee44eb5ca45a408cca1e4b1ed3b1d72620ad58ae4bbe1`.
Manifest SHA-256: `54b33decfb7dbf1173bb67c154665ff9c154982961be754c0eb7000b0e96efb2`.

No SQL, target configuration, credentials, network, production, commit or deployment action was
performed. The checkout advanced concurrently to `0b6ef82e2a7223c25a9e75ddd1cb5db0a343c9f7`;
all affected and preserved file pins were checked at handoff. Independent re-review is next.
