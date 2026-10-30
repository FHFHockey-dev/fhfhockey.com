# OFFLINE FIXTURE screenshots — not production data

These images come from the fictional rows in `web/lib/socialShare/trendsFixture.ts`. The rows are shaped exactly like the real columns. Every name ("Fixture TEAM-Tn") and every value is invented.

They were produced by the E2E test "Tuesday OFFLINE FIXTURE evidence" in `web/e2e/social-share.spec.ts`. The test ran on the isolated :3110 server (`PLAYWRIGHT_ISOLATED_NEXT=1`) behind the real access gate, using the fictional `.invalid` editor, with the network denied.

- `OFFLINE-FIXTURE-desktop-*.png` — 1440 px page, full height. A yellow OFFLINE FIXTURE banner is added to the page, outside the card.
- `OFFLINE-FIXTURE-phone-*.png` — 390 × 844 viewport with the same banner.
- `OFFLINE-FIXTURE-png-*.png` — the downloaded 1080 × 1080 card PNG, unmodified. The filename carries the label, so no banner is drawn on the card.
