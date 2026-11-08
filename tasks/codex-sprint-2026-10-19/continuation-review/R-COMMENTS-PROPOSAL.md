# R-COMMENTS — reviewable abuse-policy decision

NEW-028 item1 remains open. Current POST/input/error hardening is verified by retained source/tests; the route still creates anonymous Sanity comments. `tasks/artifacts/security-audit-fixes-2026-10-18/DIARY.md:39–43` explicitly leaves TJ the choice of sign-in, CAPTCHA, moderation or shared-store rate limiting. This proposal makes the smallest local option concrete; it does not select the policy or modify runtime files.

## Option A: require existing FHFH sign-in

- `web/pages/api/createComment.ts`: keep method/input/error contracts; use existing `requireApiUser` admission before Sanity creation. A missing or invalid session returns a fixed401 response without a write. Never accept a caller-supplied user ID as proof of identity.
- `web/components/CommentForm/CommentForm.tsx`: use existing auth context/browser session support, show a sign-in action and disabled reason to signed-out users, and attach the session bearer token on authorized submission. Preserve entered content and provide a visible recovery error if the session expires or the request fails; avoid duplicate submission. No token enters a URL, log or stored comment.
- Extend `web/__tests__/pages/api/createComment.test.ts` for missing/expired identity, no-write denials, valid admission, existing validation and safe failures. Add a focused mocked form test only if no relevant component test exists; verify signed-out explanation, token header, expired/failure feedback and successful reset.
- Run the focused web tests, then proportionate TypeScript/lint. Existing schema, comment display-name rules and Sanity document shape remain intact. This adds identity admission; it is not a numerical rate limit or proof against every signed-in abuse pattern.

This option uses existing auth and needs no new provider, dependency, migration or hosted action. It changes the public commenting product contract, so the prior explicit TJ decision cannot be inferred from a generic security-fix instruction.

## Other policies and their bounds

Preserving anonymous submissions with CAPTCHA requires a chosen provider, configuration and verification contract. A durable shared-store rate limit requires a chosen identity/privacy/retention contract and the separately owned schema/storage surface; an in-memory counter is insufficient across instances. Moderation requires an actual pending/approved workflow: current `cms/schemas/comment.js` has no approval field and the Comments GraphQL query has no approval filter. No existing moderation behavior is assumed.

TJ may instead explicitly accept the current anonymous-write risk and record that disposition. No deployment or provider action is included in any option. Current source/schema/tests were read only; exact created file is this proposal. All original hard fences and no-hosted-call rules remain.

## Owner disposition — accepted2026-10-19

TJ directly answered the pending policy question: **“Accept current anonymous behavior.”** Current anonymous valid submissions remain the accepted product behavior with existing POST/input/error controls. No sign-in, CAPTCHA, moderation, rate-limit, schema or runtime change is authorized or implemented by that answer. This resolves NEW-028 item1 by explicit owner disposition of the current behavior; it does not assert an abuse limiter, hosted protection or new security test. The implementation options above remain proposals, not an active assignment. Sprint continues on the other unresolved items.
