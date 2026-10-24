# C2 COPY-only backport review

**Accepted for COPY-only semantics.** Read actual `/tmp/fhfh-c2-copy-only-release-ts8y0cz3` candidate against production `d4c2632d39ee8a59fa683f44a0e1d21c55db66bd`, original `C2-NEWS-COPY.patch`, and C7's `RECEIPT-C2-T3.md`.

- `NewsCard.tsx` actual SHA: `ab46854d98aa3ee4f2ae1e433dfb4f38b55af2c875d5c88fa58e47f72a3a928a`. Only the identical plain-language const/comment and `<p>` text under the unchanged `!lineup && presentation.unresolvedReason` branch differ. Reverting those two changes reproduces production bytes exactly. Production layout is preserved.
- `NewsCard.test.tsx` actual SHA: `a9e031dac51da085f7d9ec14ce08ec62049e6fde50d4259e4243eb63a9aa52af`. Actual diff preserves existing tests/assertions apart from the intended old-label expectation, adds the exact C2 receipt/verified-claim/link/lineup regression block, and adds its necessary imports/const. No unrelated modern-layout test transplantation.
- Sanitized fixture SHA is exactly accepted `ac3e9711a02275749990f9020611e560ae8c07b6f06daa476f587bb14467a0a1`.
- Snapshot `newsFeed.ts` (reader, validator, public gates and attribution), `newsLineupCard.ts`, `ExternalNewsLink.tsx`, card stylesheet, homepage and `tweet-pattern-review.ts` are byte-identical to production. Exact hashes and comparisons are in `COPY-BACKPORT-REVIEW.json`.

No findings requiring a COPY-only change. No tests, browser, server, network or source edits performed; coordinator owns focused runtime checks. This does not accept the separate metadata writer, duplicate-identity proposal, or modern layout.
