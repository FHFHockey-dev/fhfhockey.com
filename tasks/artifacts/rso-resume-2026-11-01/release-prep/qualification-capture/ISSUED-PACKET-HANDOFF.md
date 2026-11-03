# Saved E1 packet binding preflight

`inspect-issued-packet.mjs` checks the selected immutable RPC revisions against their saved identity metadata before an original-issuance extractor consumes them. Latest-per-game metadata alone can name a different revision from the one the public RPC selected. This check rejects that substitution instead of silently treating the discovery result as E1.

Input is one saved JSON object with `capture: { date, observedAt, gameIds }`, `metadata` (the array accepted by `inspect-identity.mjs`) and `revisions` (the selected raw RPC rows). All inputs must already be authorized and saved. The tool performs no network/database calls, creates no files and does not alter its inputs.

It checks the complete game population; exact revision, run and snapshot IDs; model identity and original clocks; one frozen context per game; and each original skater's game/team/horizon/run/date and unique canonical/NHL roster mapping. Explicit timestamp offsets, calendar validity and PostgreSQL microseconds use the existing production parser. Equivalent explicit offsets compare as the same instant. No row is silently trimmed to make a passing population.

The CLI reports a SHA-256 of the exact packet bytes and canonical hashes of revision payloads. A failing report may contain partial diagnostic bindings; only `pass: true` establishes that the entire packet passed these binding checks. Preserve the original packet and failed reports without overwriting them.

```sh
node tasks/artifacts/rso-resume-2026-11-01/release-prep/qualification-capture/inspect-issued-packet.mjs saved-packet.json
```

Exit 0 means the binding preflight passed; exit 1 means recorded findings; exit 2 means an input/CLI error. The existing installed `web/node_modules/ts-node` loads only the pure production timestamp utility through `timestamp-parser.cjs`.

**11 synthetic tests pass**, including the CLI, selected-versus-latest revision mismatch, exact microsecond/offset clocks, duplicate/missing populations, model and context mismatches, invalid calendar dates and sealed/postgame captures. See `timestamp-review-fix/after.json` and `issued-packet-evidence.json`. No real or sealed payload was read.

This is not the E1 scorer or admission verifier. It calculates no forecast values, invents no participation revision, and checks only the issue-to-puck-drop boundary rather than proving T−60 execution. It always grants no qualification. Actual release attribution, issuing-version admission/scoring, original participation and comparator inputs, approved scope and immutable capture provenance remain required. The real issued identity is still unknown; the Vercel 403 remains respected.
