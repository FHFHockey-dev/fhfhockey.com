# Remaining Draft Pro account error boundary

Codex fixed the three duck-typed catches under its owned `web/pages/api/v1/draft-pro/` paths. Focused tests37/37 passed; backend status/message objects receive fixed500s, while authored capability/season/rate-limit errors use `DraftProRequestError`.

The Claude-owned `web/pages/api/v1/account/draft-pro/refund-requests.ts` still trusts duck-typed statusCode and forwards messages for404/422. Its helper `web/lib/draft-pro/account/refunds.ts` constructs plain authored errors. Neither was changed. Pair any future branded-helper conversion with the consumer so legitimate404/422/409 behavior remains, and add backend status/message regressions. Preserve refund/business policy. This is a local code follow-up, not authorization for a refund/provider action or deployment.
