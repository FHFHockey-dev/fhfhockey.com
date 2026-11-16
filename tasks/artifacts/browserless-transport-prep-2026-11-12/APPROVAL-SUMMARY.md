> PARKED by TJ on 2026-11-12. This is historical replacement/TLS/rotation preparation, not active execution authority. See [PARKED.md](PARKED.md) for the separate local quarantine guard and [TRIGGER-PLAN.md](TRIGGER-PLAN.md) for unexecuted trigger planning.

# Browserless: current decision and approval prerequisites

**Local candidate:** implemented, dependency declarations integrated, 80 fixture tests and scoped static checks accepted, independent re-review clear. The npm listing discrepancy is explained and does not require a candidate source/lock change. **Operational status:** not deployed; credentials, TLS/network configuration and live verification unchanged.

## Build decision

`web/node_modules/node_modules` is an unmanaged symlink back to its own parent, created October 20 before this candidate. npm/Arborist places the installed packages beneath that link in its tree; the depth-zero filtered listing consequently appears empty. A read-only probe excluding only this link finds valid `ws` 8.21.1, `@types/ws` 8.18.1 and Puppeteer 22.13.1. Both lockfiles exclude the link, Git ignores it, and neither newly declared dependency has an install lifecycle script.

The actual transport now also passes an offline bundle-and-load check, including safe rejection of an insecure fixture before socket creation. This isolates the discrepancy to the shared local installation layout, not missing candidate dependencies. A clean dependency tree from the tracked candidate is not expected to inherit that link; this is an inference, not a completed clean-install/build. Full Next production build and deployment packaging remain untested. Any process that reuses this tree and gates on its ordinary `npm ls` can still fail. The symlink and installed tree were left untouched. [Detailed diagnosis](NPM-DIAGNOSIS.json).

## Recovered host evidence

The saved November 10 production variable inspection recorded a self-hosted plaintext WebSocket endpoint on port 3000, with a query token, shared across production/preview/development. The tracked `web/pages/api/v1/webhooks/docker-compose.yaml`, last committed October 2024, instead maps `3001:3000`, uses unpinned `ghcr.io/browserless/chromium`, and declares `CONCURRENT` and a nonempty literal `TOKEN`. It contains no TLS/proxy definition. Token contents were suppressed, and no environment file or remote secret store was read.

These are two historical records, not verified current host configuration. The port mismatch and unpinned image prevent treating the Compose file as a ready live replacement. The literal token might be a placeholder or obsolete; if active, treat it as potentially exposed. Do not paste or compare its value in chat. [Safe evidence and exact unknowns](HOST-EVIDENCE.json).

## Exact next prerequisite

**Minimum information needed now:** confirm whether `43.156.28.69` is still the production Browserless host, then identify its operator and approved management route (an existing SSH profile/account or hosting-console/service name). Do not send a token, password or private key. The operator can instead supply the sanitized service inventory below.

The local-only access check is complete in [HOST-ACCESS.json](HOST-ACCESS.json): the five named dotenv files expose only a development endpoint at `ws://localhost:3001`; current process environment has no Browserless endpoint. SSH config and its Colima include provide no usable matching host profile, and local known-host records have no match for the saved production address/default SSH port. The one Docker context is Colima over a local Unix socket. No SSH connection or Docker daemon query was attempted. This identifies development intent and the historical production address, but not current production administration access. The secure candidate will reject the local development plaintext endpoint too; no exception was added.

TJ or the Browserless host operator should provide a sanitized inventory for **one running instance**, containing:

1. Host identifier, operator and launch mechanism (Compose/service manager), plus running image **digest/version** and mapped/listening ports.
2. Current endpoint scheme/host/port only; consumer names and secret binding/version IDs for production, preview and development. No full authenticated URL, environment dump or token value.
3. Supported authentication method, dual-token overlap versus single-token restart, revocation semantics, and whether disconnect reclaims a Browserless session.
4. Approved TLS DNS name, certificate/renewal owner, reverse-proxy/native-TLS arrangement, encrypted/loopback upstream and IPv4/IPv6 backend exposure rules.
5. Query-safe proxy/Browserless log configuration and the approved operational window, coordinated with the active production work.

Existing records or operator-provided output are sufficient. If host inspection is needed, authorize only a named operator's read-only inspection of those metadata fields on that one instance; no container restart, token read, certificate issuance, firewall edit, endpoint probe or deployment. No unsupported SSH account, command, provider or service manager has been guessed.

## Subsequent approvals — separate scopes

| Scope | Concrete approval must name | Acceptance / stopping condition |
| --- | --- | --- |
| TLS/network cutover | Actual host, reviewed proxy/native-TLS configuration, chosen DNS/certificate, upstream and old-port rules, maintenance/rollback choice | Direct `wss` upgrade with certificate verification; protected upstream; plaintext ingress closed. No redirect/fallback or insecure verification override. |
| Credential rotation and activation | Secret version IDs and consumer bindings, supported overlap/single-token sequence, session handling | New credential travels only over TLS; all authorized bindings moved; old credential revoked. If single-token, explicitly accept the coordinated maintenance gap. Never restore a retired token. |
| Application release | Exact eight-file candidate SHA, project `fhfhockey` / root `web`, production / `master`, fresh linked-project build inventory and release custody | TLS/secret configuration ready **before** candidate activation: this code rejects the historically recorded `ws` endpoint. Inspect existing deployments for the exact SHA; reuse READY or wait for in-progress. No duplicate or preview build. |
| Bounded live proof | Exact WSS host/path, two sequential handshake attempts at most, 10 seconds each, approved cleanup and session cost; one exact-deployment webhook log read, latest 15 minutes, at most 20 events | New credential accepted, retired credential rejected; close only test-owned connections. No retries, page navigation, screenshot, upload, Discord or application HTTP request. Log read saves only safe schema/count/diagnostic results. No natural error means `no-sample`, not passed. |

The last build inventory had one web build plus three canceled companion entries; that is historical and must be reconfirmed before publishing. Any changed companion build behavior needs a targeted plan and approval. A successful Browserless handshake may allocate one billable session; cost and disconnect cleanup remain unknown until inventory. Historical logs and credential exposure are a separate owner-managed assessment, not permission to export or delete logs.

The candidate SHA and live configuration are not yet pinned, so this packet is **not an execution-ready blanket approval request**. The next useful action is the sanitized inventory above; then finalize the actual TLS/configuration diff and exact release candidate for approval. The ordered procedure, budgets and failure handling remain in [ROLLOUT.md](ROLLOUT.md).
