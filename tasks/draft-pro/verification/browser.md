# Draft Pro browser fixture status

`web/e2e/draft-pro-free.spec.ts` is a deterministic free-only smoke flow. It mocks the account access response as unauthenticated and aborts Stripe and Patreon hosts; it uses no account, checkout, email, or production database.

It covers the current manual dashboard selectors: setup completion, small free manual draft, favorite persistence, and the local `draft.snapshot.v2` snapshot. Existing `draft-settings.spec.ts` remains the broader coverage for source weights, imports, comparisons, and local state preservation.

Premium controls, mobile/zoom, and paid lifecycle coverage are intentionally pending W07's release-candidate selectors and UI composition.
