# Underlying Stats 320px local QA

Checkout: master at 73af9d051ecc755dd3695f5265bf5837bbfc7a4e. Six scoped files clean before and after; SHA-256 identities in browser-receipt.json.

Run from repository root: `node output/underlying-stats-320px-20261002/verify.cjs`. Requires the existing local server at http://127.0.0.1:3000 and supported require_escalated execution. No install, server launch, custom browser flags, profile or credential reuse. Interception precedes page creation.

All seven browser cases passed. Expanded panel x=8..312, width=304; client/scroll width=302. Body/document width=320. Keyboard Enter/Space preserves disclosure focus and visible focus ring. ArrowRight/Home and click switch Chart/Rankings; retained sorting, pin, Simple/Advanced, top-12/all, snapshot loading/error/recovery pass. Focused Vitest: 10/10 passed.

Screenshots: expanded-readiness.png, chart-320px.png, recovered-rankings-320px.png. Playwright trace: trace.zip. Exact browser results: browser-receipt.json. Initial sandbox failure preserved in browser-launch.json and receipt.json; superseded by approved escalated run.

Closes the requested local QA gap only. External fonts/third-party resources deliberately blocked, so production fonts and live data remain unverified. No application changes; expanded-readiness duplication decision untouched. Weekly remaining 67%.
