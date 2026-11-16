# Browserless host trace
- Scope: identify host/operator/admin route from existing records only. No live host connections, secrets, configuration changes or auth.
- Current: local admin metadata previously found no host profile; checking repository history, saved chats and connected mailbox.
- Blocker: current host identity/operator unknown.

## Findings
- Original compose addition: commit `2c7d2a109ca714fdb48eafd6bdc384e3b21ed1d7` (2024-10-25), author xiaohai-huang, for `web/pages/api/v1/webhooks/docker-compose.yaml`.
- Passive public index https://bgp.he.net/net/43.156.0.0/18 associates exact recorded endpoint IP `43.156.28.69` with `xiaohai-huang.net` (line 687 when retrieved); prefix origin is Tencent AS132203. No connection to the endpoint or associated domain was made.
- Existing Gmail correspondence confirms a known developer relationship with Xiaohai HUANG (2024-11-17, subject `Re: Can I add your Twitter account?`). No external message sent.
- Strong lead, not proof of current control: ask that developer whether he still manages the endpoint and which hosting/admin route supports coordinated TLS and token rotation. Do not presume Tim owns a Tencent account. No credentials should be emailed.
- Prior local metadata checks found no matching SSH/admin profile; no validated admin access was recovered. Saved ChatGPT search did not locate the endpoint setup. DigitalOcean twitter-scraper history is a separate host and must not be conflated.
- Changes in this task: diary only; no production access, auth, code/settings changes, or credential reads.

## Follow-up: no developer contact available
- Owner reports Xiaohai is no longer associated and cannot be contacted. Do not treat contacting him as the unblock path.
- Read-only runtime trace: sole PUPPETEER_ENDPOINT consumer is `web/pages/api/v1/webhooks/on-new-line-combo.ts:75-82`. It opens public `/lines/line-combo/{gameId}` (103), captures a team matrix (132-137), uploads a PNG (142-148), then calls the Discord send route (35-46, 169-179).
- Discord reader: `web/pages/api/v1/discord/send-message/line-combo/[gameId].ts:43-47` references the stored PNG, while also constructing text line combinations from database rows. The present orchestration stops before Discord if capture fails.
- Migration `20260716112910_harden_line_combination_trigger_auth.sql:34-57,124-127` defines the asynchronous webhook on lineCombinations INSERT. No enable/disable feature flag in either route. Production trigger state and recent successful deliveries remain unverified: no service/DB calls performed.
- No Browserless dependency found in normal DRM or Game Grid rendering, goalie calculation, or other runtime screenshot routes. This dependency is screenshot automation for Discord, not NHL data ingestion or line assignment. Local QA Playwright scripts are separate.
- Options for owner: replace the orphaned endpoint with a controlled managed browser service (lowest operational burden), run a controlled self-hosted Chromium service (more maintenance), or intentionally retire/disable this screenshot automation (loses current screenshot + Discord orchestration unless text-only fallback is built). No change performed. Endpoint replacement requires new authorization/setup and end-to-end acceptance; a hostname substitution alone is not verification.

## Quarantine plan (not executed)
Owner now wants Browserless quarantined and parked. The existing transport lane's OWNERSHIP.json says the frozen candidate has already returned to parent custody. Preserve candidate/source changes; do not revert shared files or roll back deployed redaction.

Local scope: record parked status and keep transport candidate out of unrelated release selection. No tests or code changed in this trace.

Production plan needing a specific controlled change:
1. Add an authenticated early-exit guard to the screenshot orchestration route before any Browserless connection, page navigation, storage or Discord work. An explicit parked/skipped response must not claim screenshot success. Mock tests must prove zero external effects while parked. This requires local implementation plus an approved deploy, not a live smoke invocation of the old route.
2. Separately disable only trigger `after_line_combo_insert` on `public."lineCombinations"`. This prevents new async screenshot requests. Never disable all triggers: `after_player_underlying_stats_insert` on the same table drives actual underlying-stat updates. Preserve function, stored line combinations and existing images. Re-enable the one trigger only after a controlled replacement qualifies.
3. Account for already queued/in-flight requests and direct callers; a trigger switch alone does not stop these. The guard is defense against new direct calls to the serving deployment. No queue deletion, upstream host shutdown, token revocation, immutable deployment disablement or network setting change is covered by this note.
4. Verify from narrowly bounded configuration/log evidence rather than calling the side-effectful webhook. Current trigger-enabled state and recent usage remain unknown without those reads. Existing November 10 evidence proves a READY redaction release, not successful screenshot delivery or current traffic.

Expected impact: automatic line-combo image generation and its chained Discord posts stop; existing PNGs remain. NHL data, line assignments and ordinary Grid/DRM rendering have no identified Browserless dependency. The unrelated direct Discord endpoint is not a Browserless caller and remains outside this narrow quarantine unless explicitly included.
