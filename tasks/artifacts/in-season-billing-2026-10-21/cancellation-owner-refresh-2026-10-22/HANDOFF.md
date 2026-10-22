# Cancellation request continuity — pinned local correction

The P2 review finding is corrected in two files only. An unresolved cancellation request now retains its ID across token refresh or repeated sign-in for the same session owner. Sign-out, a missing owner, or an actual owner change clears the cache. Before sending a cancellation, the current session owner scopes the cache as well, so an owner change cannot reuse an earlier owner's ID even if an auth callback was missed. Existing response invalidation and server-side ownership enforcement are unchanged.

This is in-memory continuity within the mounted account panel, not new persistence across browser reloads. No billing semantics, billing core, routes, schema or activation configuration changed.

| File | SHA-256 |
| --- | --- |
| `web/components/account/InSeasonPanel.tsx` | `aa8b536ee039599c6d41167841b5c1a177f0350c895d03ae0b6ed0acfd76a167` |
| `web/components/account/InSeasonPanel.test.tsx` | `9111c5524568150797b0cc232e3b4f2584758102206531d9b26d408ba8abdd10` |

[CHANGED-FILES.json](CHANGED-FILES.json) contains baseline hashes, exact patches, HEAD observations and the 18 preserved hashes: seven other files from the entrypoint packet and all 11 previously reviewed correction files. The earlier packet's two panel hashes are superseded by this correction; its other hashes remain valid. This correction requires independent re-review.

Verification from `web/`, Node 22.11.0/npm 10.9.0, no `GIT_DIR` override:

```sh
npm test -- components/account/InSeasonPanel.test.tsx -t 'unresolved cancellation ID' --reporter=default --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/cancellation-owner-refresh-2026-10-22/REPRODUCTION-RESULTS.json
npm test -- components/account/InSeasonPanel.test.tsx --reporter=default --reporter=json --outputFile=../tasks/artifacts/in-season-billing-2026-10-21/cancellation-owner-refresh-2026-10-22/FINAL-RESULTS.json
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit --incremental false
npx eslint components/account/InSeasonPanel.tsx components/account/InSeasonPanel.test.tsx
```

- Before the application fix: two same-owner lost-response cases failed because retry IDs differed; two owner-change/sign-out controls passed. The reproduction receipt retains the failure evidence; its 24 filtered tests were skipped, not executed.
- Final panel suite: **29/29 passed**, zero failures/skips. Five added regression cases cover lost response followed by same-owner `TOKEN_REFRESHED`, same-owner `SIGNED_IN`, different owner, different owner without a callback, and sign-out followed by the same owner signing in. Requests use the refreshed token while retaining or replacing the request ID as appropriate.
- Full TypeScript and targeted lint: both passed, exit 0. Their logs are retained in this folder.
- The earlier independent 105-test run and earlier local 307-test run are historical evidence. They were not rerun or added to this 29-test count.

No flags were enabled, credentials accessed, services called, SQL applied, cron added or deployment performed. The owner-lookup draft remains unapplied; provider/service and release gates remain open. No action was denied or has an uncertain execution outcome.
