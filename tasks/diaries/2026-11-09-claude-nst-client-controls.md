# NST client opt-in controls for BLSH capture — 2026-11-09 (Claude NST owner)

- Scope (Chef ticket, TJ-approved): in `web/lib/nst/client.ts` (+ `sharedAdmission.ts` only as needed) and tests: (1) bounded/streaming body cap (`maxResponseBytes`, from Codex patch 827445c1 on base 48d82fc4), (2) opt-in `maxAdmissionCalls`, (3) pre-dispatch `operationHook` over every NST GET and admission POST, with sanitized settlement and counting before dispatch. All default-off; cron behaviour unchanged. Publish the interface + SHA-256 of client.ts and the redactor in CLAUDE-TO-CODEX.md. No NST/DB/prod/push. Exclusive custody: me. Off-limits: web/scripts/blsh/**, web/lib/skoElement/**, web/lib/cron/*, Rankings, blshTrade.
- Inputs read: NST-OWNER-HANDOFF.md, RUNNER-HANDOFF.md, mailbox -05/-06, patch (applies to current base 48d82fc4), runner port (`CaptureDispatch = (operation, action(spec)) => Captured`).
- Design: hook has the runner's wrap shape `hook(operation, perform)`; client counts per kind before calling the hook; network happens only inside `perform`; `perform` resolves to a sanitized settlement and the client keeps the real result; refusal (hook throws or never calls perform) = NstExecutionLimitError, no request, not retried; perform at most once; hook signal links to the client abort. `maxAdmissionCalls` counts admission POSTs per page across retries; a denied receipt at the cap fails at once instead of sleeping. Any new control bypasses the 24h memory cache.

## Log
- (start) diary created.
- Patch applied -> 99ad45c5 (exact candidate). Added maxAdmissionCalls + operationHook (runNstOperation helper, NstOperationRefusedError in sharedAdmission.ts). Default admission call kept at 3 args (existing exact-args test caught a 4th arg; fixed by passing it only when opted in).
- Checks: clientOperationControls.test.ts 28/28; NST suite 19 files / 424 pass; scripts/blsh 80 pass (run only); typecheck exit 0; eslint 0.
- Hashes: client.ts 1a568c28…738d; sharedAdmission.ts 9ae8a672…bec6; redactor section ab44700a… unchanged. Mailbox entry CLAUDE-NST-CLIENT-OPERATION-CONTROLS-20261109-08.
- Gotcha: the redactor lives inside client.ts (no separate file); BLSH runner pins client.ts and sharedAdmission.ts and must update to these hashes.
- Next: BLSH wires the adapter; TJ approves the exact pilot separately.
