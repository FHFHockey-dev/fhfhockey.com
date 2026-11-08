# Bounded receiver intake candidate v1

Source manifest: `owned-source-v1-sha256.json`, SHA256 `6a652678d23c8161c57b0526c80a789b69c680b699f662388e81d8283f070b45`, 139 files plus15 read-only dependencies. Hold these exact pins for independent review. Only this new root's report/artifact files may be written during the hold. No other implementation writer owns these paths.

Three live paths change accepted125: receiver, retention helper and nearest receiver test. Their exact accepted bytes are under `before/`. Other122 prior source pins and all2224 prior reviewer artifacts were verified unchanged. All15 live/captured dependencies match. New policy module and nearest tests are additive. SQL6 is unchanged; select its accepted v2 replacement only, followed by new task-local SQL7.

Behavior: explicit exact route tuples, immutable operator-registered future policy, server window and monotonic stop, serialized attempt/receipt caps with stable receipt admission IDs. Active/malformed/partial pilot config never falls back to legacy writes. Controlled intake requires a known post ID and shadow config; it cannot request immediate processing even with process=true. Completely unset pilot config preserves default-off legacy compatibility; deployed alternate writers remain a gate.

Checks:104/104 final pass (72 actual private-PG,20 pure policy,12 nearest mocked); scoped TypeScript exit0; targeted lint exit0. No aggregate81/full suite/full compiler/build or hosted action. Initial47 setup failures caused by SQL alias ambiguity, focused repair1pass and both integrated104pass outputs retained. Adapted prior receiver harness explicitly changes setup/bridge to SQL7, missing-ID contract and permission probes; it is not claimed byte-identical. Original R19 raw-preservation assertions/races remain represented.

No production DDL/deploy/flag/policy registration/ingestion/stop/replay/queue/scheduler action authorized or performed. `POLICY-AND-ROLLOUT-GATES.md` gives exact policy choices and separate approval prerequisites. Caller-wide deadline, deployed full schema/ACL/triggers/writers, genuine source/identity/history/fences, external queue, future metrics and full52 acceptance remain open.

Independent review pending. Current processes: none. Source hold starts at this manifest.
