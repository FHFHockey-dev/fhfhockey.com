# Exact local owner setting

Parent's latest trusted delegation supplies TJ's UUID from the requested Supabase Authentication → Users flow and explicitly authorizes configuring that value locally. This supersedes the earlier identity-input blocker; it is user-supplied, not independently session-verified. The earlier activation checkpoint remains historical evidence.

Only configuration target: `web/.env.development.local`, adding the absent `FORGE_TESTING_GROUNDS_OWNER_USER_ID` key. Preserve all existing bytes and file permissions; no other configuration or shared application changes. Initial inspection: regular file, not a symlink, zero key occurrences. Do not place environment contents/hashes or UUID/token values in this packet.

New packet paths: this `OWNERSHIP.md`, `configuration-check.json`, `local-http.json`, `HANDOFF.md`, and `EVIDENCE.json`. Update the existing task diary. Frozen source/review packets remain unchanged.

Next's installed env watcher supports forced env reload and server propagation. Before editing, the one observed localhost:3000 browser tab was navigated to `about:blank`; its resulting blank state was observed. No app reload, token extraction or authenticated request was requested. The existing Next PID49759 remains untouched; terminal controller is still unconfirmed.

After the setting, make at most one credential-free GET to the inspected local access endpoint. Missing bearer credentials return before lazy provider import, so this check cannot verify TJ's session. Stop when configuration loading is conclusive. Do not return the browser to the app while repeated verification/shared profile-write containment remains unresolved. One approved hosted Auth read remains unused by this worker.
