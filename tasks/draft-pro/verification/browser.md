# Draft Pro browser fixture status

`web/e2e/draft-pro-free.spec.ts` is a deterministic free-only smoke flow. It mocks the account access response as unauthenticated, intercepts all browser Supabase REST requests with fictional projection rows (one skater and one goalie for projection tables; empty data for all other tables), and aborts Stripe and Patreon hosts. It uses no account, checkout, email, or production database.

It covers the current manual dashboard selectors: setup completion, free manual draft, favorite persistence before drafting, and the local `draft.snapshot.v2` plus `projections.favorites` persistence. Existing `draft-settings.spec.ts` remains the broader coverage for source weights, imports, comparisons, and local state preservation.

Premium controls, mobile/zoom, and paid lifecycle coverage are intentionally pending W07's release-candidate selectors and UI composition.
