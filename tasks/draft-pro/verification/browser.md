# Draft Pro browser fixture status

`web/e2e/draft-pro-free.spec.ts` is a deterministic free-only smoke flow. It mocks the account access response as unauthenticated, intercepts all browser Supabase REST requests with fictional projection rows (two skaters and one goalie, plus the two-player local reference list for CSV identity resolution), and aborts Stripe and Patreon hosts. It uses no account, checkout, email, or production database.

It covers the current manual dashboard selectors: setup completion, free manual draft, favorite persistence before drafting, player comparison, source-weight blending, and local `draft.snapshot.v2` plus `projections.favorites` persistence. The CSV case imports a fictional mapped row through the real modal, then reloads without reseeding storage and verifies the normalized numeric row (`player_id` 1002; Goals 65, Assists 60, Shots 300) and completed pick are retained in local autosave. Existing `draft-settings.spec.ts` remains broader coverage for settings imports and preservation.

Premium controls, mobile/zoom, and paid lifecycle coverage are intentionally pending W07's release-candidate selectors and UI composition.
