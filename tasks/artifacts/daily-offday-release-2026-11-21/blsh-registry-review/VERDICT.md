# Chef review: BLSH pilot registry entry (line F evidence), 2026-11-21

Verdict: **ACCEPT Y `1efdfb4364dffa73a9c249f382dbfebe22ebbbd2`.** Push Y only, never X alone. Local and read-only; nothing was pushed or committed.

- X `b5e18f49078addde4bda3e5679e5602f8ed58393`: parents 523ba0108 + 16f5c4603, tree 596918577eae.
- Y `1efdfb4364dffa73a9c249f382dbfebe22ebbbd2`: sole parent X; no attribution in the message.

| Check (clean `git archive` exports, node_modules symlinked) | Result |
|---|---|
| X producer closure (`forge-producer-closure.ts --print`) | `d6520f1c72711fcd151c1484f81c0379fc15c57e80963e72e024c1cd4e23e1e2` (matches the report) |
| Y producer closure | same, `d6520f1c…`: the registry and receipt are outside the closure |
| Receipt in Y's tree, sha256 | `8c2d3a3ca8b513f009ae6f74e75745e6cd1b547e890ff3fadbca0d5a7d069dba` (matches the entry) |
| Receipt contents | producerIdentity.closureSha256 d6520f1c…, closure 243 modules, findings 0, commit.tree = X's tree |
| X→Y diff | receipt (+550), entry appended last after 0446100e/e2f8c6bc9 (+8), 1 test row; master field names |
| `verifiedForgeReleases.test.ts` on Y | 28/28 passed |
| Build admission on Y (VERCEL_ENV=production, commit Y, --closure d6520f1c) | **pass**, no problems |
| Build admission on X (same, commit X) | **fail**: closure unregistered, as expected. That's why Y, not X, must be the pushed tip |

Line F (the push) is still TJ's decision.
