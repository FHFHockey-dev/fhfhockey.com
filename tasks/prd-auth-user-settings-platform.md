# PRD: Auth + User Settings Platform

## Introduction/Overview

This feature adds a production-ready authentication and user settings platform to `fhfhockey.com` using Supabase Auth and site-owned application tables.

The goal is to introduce a secure account system without managing raw passwords, give users a clear sign-in/sign-up experience, and establish the minimum data model needed for persistent per-user settings. The MVP focuses on core site authentication, profile/settings storage, and a foundational account settings experience. It also designs, but does not fully implement, future connected-account flows for Yahoo, Fantrax, Patreon, and ESPN.

This feature must keep core site authentication separate from external fantasy-platform connections. A user should sign into the site with site auth first, then optionally connect external accounts from account or league settings.

## Goals

1. Add secure site authentication using Supabase Auth.
2. Support Google sign-in and email/password sign-up/sign-in.
3. Require email verification for password-based sign-up before users can fully use account-backed settings.
4. Add a global auth entry point in the site header.
5. Replace the logged-out header CTA with a `Sign-in / Sign-up` button and replace it with a logged-in avatar menu when authenticated.
6. Create secure per-user storage for profile data, fantasy scoring settings, league settings, and saved teams.
7. Add an Account Settings page where users can manage their profile, account preferences, league defaults, saved teams, and future connected accounts.
8. Define a modular connected-accounts architecture for Yahoo, Fantrax, Patreon, and future ESPN without coupling those services to core site auth.
9. Define a future league-sync architecture that supports multiple external leagues/teams per user, a user-selectable default team, and a non-destructive “active league” switching model.
10. Prevent unsafe or excessive league-refresh behavior by designing explicit rate limiting and refresh cooldown rules.

## User Stories

- As a site visitor, I want to create an account with Google or email/password so I can save settings and return later.
- As a new password-based user, I want to verify my email so my account is secure and recoverable.
- As a returning user, I want a forgot-password reset flow so I can regain access without support.
- As a logged-out user, I want a clear sign-in/sign-up button in the header so I can access authentication from anywhere on the site.
- As a logged-in user, I want to see my avatar in the header and open an account tray with actions like account settings and sign out.
- As a user, I want my league defaults and scoring settings saved to my account so I do not have to re-enter them on every visit.
- As a user, I want saved teams stored under my account so I can manage different roster setups over time.
- As a user with multiple external leagues, I want to choose a default league/team and switch active league context without losing in-progress work.
- As a user, I want external fantasy account connections to live in Account Settings or League Settings rather than being forced into my main login identity.
- As a site operator, I want Patreon access modeled separately from site login so perk access can be granted without coupling Patreon identity to site identity.
- As a site operator, I want controls that prevent users from repeatedly triggering league refreshes and hammering provider APIs.

## Functional Requirements

1. The system must add a `Sign-in / Sign-up` button to [Header.tsx](/Users/tim/Code/fhfhockey.com/web/components/Layout/Header/Header.tsx) positioned to the right of `.bmcWrap` when the user is logged out.
2. The system must replace that button with a user avatar when the user is logged in.
3. The logged-in avatar must open a tray or menu containing at least `Account Settings`, `League Settings`, and `Sign Out`.
4. The system must support Google sign-in through Supabase Auth.
5. The system must support email/password sign-up and sign-in through Supabase Auth.
6. The system must support email verification for password-based sign-up.
7. The system must support forgot-password and password reset flows.
8. The system must not store raw passwords in site-owned application tables.
9. The system must make authenticated user state available globally, not only on `/auth` and `/db` routes.
10. The system must add an account settings surface for profile and league-default management.
11. The system must store user profile data in a site-owned profile table keyed to `auth.users.id`.
12. The system must store user settings in a separate settings table keyed to `auth.users.id`.
13. The system must store saved teams in a dedicated table that supports multiple team entries per user.
14. The system must support a “manual saved teams + import-ready schema” MVP, even if Yahoo/Fantrax/ESPN sync is not yet implemented.
15. The system must preserve the existing `public.users` table only for current admin-role concerns unless an explicit migration is required later.
16. The system must use Row Level Security so users can only read and write their own profile, settings, saved teams, and account-link records.
17. The system must keep external provider access tokens and refresh tokens out of browser-readable tables and client-side access paths.
18. The system must define a connected-accounts table that supports Yahoo, Fantrax, Patreon, and ESPN as separate providers.
19. The system must define a future provider token storage pattern that is separate from core user profile/settings tables.
20. The system must keep app authentication separate from Yahoo, Fantrax, Patreon, and ESPN account connections.
21. The system must support the future concept of one user linking multiple external leagues or teams from the same provider account.
22. The system must support the future concept of one user choosing a default external team or league.
23. The system must support the future concept of switching active league context in-place without forcing a page navigation that destroys in-progress UI state.
24. The future Yahoo sync architecture must support discovery of a user’s leagues and teams from a Yahoo-connected account.
25. The future Yahoo sync architecture must support importing league metadata including league identifiers, team identifiers, team names, roster positions, scoring/stat categories, standings, rosters, matchups, player statuses, and selected transaction history.
26. The future Yahoo sync architecture must include sync job state, refresh timestamps, sync errors, and cooldown metadata.
27. The future system must prevent rapid repeated sync requests by enforcing server-side refresh throttling, cooldown windows, and in-flight job deduplication.
28. The future system must allow users to choose whether to refresh league data manually or automatically on login, with safeguards against abusive refresh frequency.
29. The future Fantrax integration must be modeled as a separate provider adapter with provider-specific account, league, and sync records.
30. The future Patreon integration must be initiated from Account Settings rather than from the primary login flow.
31. The future Patreon integration must support a site-owned entitlement model so Patreon benefits can be granted or revoked without becoming the site’s core authentication identity.
32. The future Patreon integration must prevent the same Patreon account email or Patreon member identity from being attached in a way that grants duplicate perk access across multiple site accounts, subject to what Patreon identity fields are reliably available.
33. The system must expose enough account and league settings structure to later map saved settings into existing fantasy scoring and roster configuration systems.

## Non-Goals (Out of Scope)

- Full Yahoo account connection implementation in this phase.
- Full Fantrax sync implementation in this phase.
- Full Patreon OAuth implementation in this phase.
- ESPN integration implementation in this phase.
- Automatic migration of existing local Draft Dashboard session state into account-backed persistence.
- Any modifications to [DraftDashboard.tsx](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/DraftDashboard.tsx) in this phase.
- Changes to [manual-refresh-yahoo-token.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/manual-refresh-yahoo-token.ts).
- Full MFA rollout in this phase.
- Provider-specific token refresh jobs for user-linked Yahoo/Fantrax/Patreon accounts in this phase.
- Full background sync workers and queues unless they are needed for a minimal schema placeholder.

## Design Considerations

- The auth entry should feel lightweight and globally available. Use a modal or modal-equivalent flow from the header rather than forcing users onto a standalone auth page for normal use.
- Header behavior:
  - Logged out: show `Sign-in / Sign-up` button to the right of `.bmcWrap`.
  - Logged in: show user avatar image in the same area.
  - Avatar click: open a tray or menu with account-related actions.
- The Account Settings page should have clear sections:
  - Profile
  - Account security
  - League defaults
  - Saved teams
  - Connected accounts
  - Patreon / perks
- League switching should be designed as contextual selection, not as a hard navigation dependency. Users must be able to switch active league/team while preserving unsaved work where possible.
- Saved teams and connected leagues should distinguish:
  - Site-owned manual/saved team entries
  - Externally synced league/team records
  - The user’s default team
  - The user’s currently active team context

## Technical Considerations

### Existing repo constraints

- [Header.tsx](/Users/tim/Code/fhfhockey.com/web/components/Layout/Header/Header.tsx) is the correct insertion point for the auth entry.
- [AuthProviderContext](/Users/tim/Code/fhfhockey.com/web/contexts/AuthProviderContext/index.tsx) currently only supports a minimal user shape and is only wrapped for select routes in [\_app.tsx](/Users/tim/Code/fhfhockey.com/web/pages/_app.tsx). This must be expanded to global app usage for auth-aware header behavior.
- [DraftDashboard.tsx](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/DraftDashboard.tsx) already defines useful settings shape but must not be modified in this phase.
- [fantasyPointsConfig.ts](/Users/tim/Code/fhfhockey.com/web/lib/projectionsConfig/fantasyPointsConfig.ts) should be used as the baseline for default scoring settings.
- Existing Yahoo ingestion and token refresh are app-level and must stay intact:
  - [yahooAPI.py](/Users/tim/Code/fhfhockey.com/web/lib/supabase/Upserts/Yahoo/yahooAPI.py)
  - [manual-refresh-yahoo-token.ts](/Users/tim/Code/fhfhockey.com/web/pages/api/v1/db/manual-refresh-yahoo-token.ts)

### Recommended auth strategy

- MVP auth methods:
  - Google OAuth
  - Email/password
- Verification and recovery:
  - Email verification for password sign-up
  - Forgot-password reset flow
- Recommended non-MVP:
  - TOTP-based MFA, offered later as an account-security enhancement
- Recommendation rationale:
  - Google reduces signup friction.
  - Email/password covers users who do not want social login.
  - Email OTP is useful for verification/recovery flows but should not be the primary third sign-in mode for MVP.
  - Magic-link-only auth would be simpler but is a weaker fit for a settings-heavy multi-session product where users expect password recovery and standard account controls.

### Recommended application tables

- Keep auth-owned identity data in `auth.users`.
- Keep app-owned data in public tables keyed by `auth.users.id`.

Recommended MVP tables:

- `public.user_profiles`
  - `user_id uuid primary key references auth.users(id)`
  - `display_name text`
  - `avatar_url text`
  - `timezone text`
  - `created_at timestamptz`
  - `updated_at timestamptz`

- `public.user_settings`
  - `user_id uuid primary key references auth.users(id)`
  - `scoring_categories jsonb`
  - `league_type text`
  - `category_weights jsonb`
  - `roster_config jsonb`
  - `ui_preferences jsonb`
  - `active_context jsonb`
  - `created_at timestamptz`
  - `updated_at timestamptz`

- `public.user_saved_teams`
  - `id uuid primary key`
  - `user_id uuid references auth.users(id)`
  - `name text`
  - `source_type text`
  - `provider text null`
  - `external_team_key text null`
  - `external_league_key text null`
  - `roster_json jsonb`
  - `settings_snapshot jsonb`
  - `is_default boolean`
  - `created_at timestamptz`
  - `updated_at timestamptz`

Design-now, defer-implementation tables:

- `public.connected_accounts`
  - one row per site user + provider account

- `private.connected_account_tokens` or equivalent restricted table
  - encrypted/provider token storage
  - service-role-only access

- `public.external_leagues`
  - provider league metadata per connected account

- `public.external_teams`
  - provider team metadata per league

- `public.user_provider_preferences`
  - default team, default league, refresh-on-login preference, active-context preference

- `public.provider_sync_runs`
  - sync status, rate-limit backoff, error logs, dedupe keys, timestamps

- `public.user_entitlements`
  - site-owned access flags such as Patreon perks, subscription state, source provider, effective dates

### Mapping to existing fantasy config

- `user_settings.scoring_categories` should map directly to the `DraftSettings.scoringCategories` shape used in [DraftDashboard.tsx](/Users/tim/Code/fhfhockey.com/web/components/DraftDashboard/DraftDashboard.tsx).
- `user_settings.league_type` should map to `DraftSettings.leagueType`.
- `user_settings.category_weights` should map to `DraftSettings.categoryWeights`.
- `user_settings.roster_config` should map to `DraftSettings.rosterConfig`.
- Default values should be seeded from [fantasyPointsConfig.ts](/Users/tim/Code/fhfhockey.com/web/lib/projectionsConfig/fantasyPointsConfig.ts) and the current draft settings defaults, without modifying the Draft Dashboard in this phase.

### Callback routes and session handling

- Add a dedicated auth callback route for OAuth and verification completion.
- Add a reset-password route for recovery links.
- Store session state using Supabase-supported browser auth flows.
- Prefer a modern callback exchange pattern compatible with the current Next.js setup and review whether the current client wrappers need to be consolidated for consistent auth behavior.
- Ensure authenticated header UI can initialize safely on first load without route-specific provider wrapping.

### RLS policy baseline

- `user_profiles`: users can only `select`, `insert`, `update`, `delete` rows where `auth.uid() = user_id`
- `user_settings`: same rule
- `user_saved_teams`: same rule
- `connected_accounts`, `external_leagues`, `external_teams`, `user_provider_preferences`: same user ownership rule
- Token storage table: no direct client access; service role only

### Future Yahoo sync architecture

- Keep the current singleton Yahoo credential flow for global Yahoo ingestion untouched.
- Add a separate per-user Yahoo connection model later.
- Flow:
  1. User authenticates to site
  2. User opens Account Settings or League Settings
  3. User chooses `Connect Yahoo`
  4. User completes Yahoo OAuth
  5. Server stores provider account row + token row
  6. Server fetches available Yahoo leagues and teams
  7. User selects default team/league
  8. Sync metadata is stored
  9. User can manually refresh or enable guarded refresh-on-login

Yahoo-importable data candidates:

- provider account identity
- league key, name, season, scoring type
- roster positions
- stat categories and scoring modifiers
- team key, team name, team logos
- managers/ownership metadata
- standings and matchup schedule
- team rosters and starting slots
- player eligible positions and statuses
- transactions, waivers, adds/drops, selected claim info

### Future Fantrax sync architecture

- Treat Fantrax as a separate provider adapter, not as a variant of Yahoo.
- Design the same logical entities:
  - connected account
  - external leagues
  - external teams
  - sync runs
  - user provider preferences
- Implementation risk is higher than Yahoo because official public API support is not yet confirmed in this planning pass and the public developer page is not easily inspectable without client-side rendering.
- Recommendation:
  - do not make Fantrax an MVP provider
  - design schema compatibility now
  - validate official auth and data-access support before implementation
  - consider manual import or CSV fallback if official API access proves limited

### Future Patreon architecture

- Patreon should be connected from Account Settings, not used as site login.
- A site user may connect Patreon even if the Patreon email differs from the site-login email.
- Store Patreon connection separately from core auth identity.
- Materialize Patreon-derived access into a site-owned `user_entitlements` record.
- Enforce uniqueness on Patreon provider identity fields that reliably identify a single patron account, so one Patreon account cannot be used to confer perks across multiple site accounts.
- Use Patreon API v2 concepts for long-term design.

## Success Metrics

- Users can sign up and sign in with Google or email/password from the header flow.
- Password-based users can verify email and complete password reset successfully.
- Logged-in users see avatar-based account controls in the header.
- User profile and settings records are created and can be updated only by the owning user.
- Saved teams can be created and read back per user.
- No raw passwords are stored outside Supabase Auth.
- RLS blocks cross-user reads and writes for new account tables.
- The codebase has a clear path to add Yahoo, Fantrax, Patreon, and ESPN connectors without reworking the core auth model.

## Open Questions

1. Should authenticated-but-unverified users be allowed to save draft/league settings temporarily, or should all account-backed writes be blocked until verification is complete?
2. Should the logged-in avatar use a generated fallback, Google avatar when available, uploaded custom avatar, or a prioritized combination?
3. What exact UI should be used for `League Settings` in MVP: separate page, account sub-tab, or placeholder route?
4. What should the default refresh cooldown be for future provider syncs, and should different providers have different cooldown rules?
5. Should the future “refresh on login” behavior always be background-only, or should it ever block page readiness while a sync runs?
6. Should Patreon perk enforcement key off Patreon member ID only, or also email when available as a secondary fraud-prevention signal?
7. When switching active league/team context, what unsaved page states should be preserved automatically versus require a confirmation modal?

## Proposed Files

Expected files to modify in the first implementation pass:

- [web/pages/_app.tsx](/Users/tim/Code/fhfhockey.com/web/pages/_app.tsx)
- [web/components/Layout/Header/Header.tsx](/Users/tim/Code/fhfhockey.com/web/components/Layout/Header/Header.tsx)
- [web/contexts/AuthProviderContext/index.tsx](/Users/tim/Code/fhfhockey.com/web/contexts/AuthProviderContext/index.tsx)
- [web/lib/supabase/client.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/client.ts)
- [web/lib/supabase/index.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/index.ts)
- [web/pages/auth/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/auth/index.tsx)
- [web/lib/supabase/database-generated.types.ts](/Users/tim/Code/fhfhockey.com/web/lib/supabase/database-generated.types.ts)

Expected files to create in the first implementation pass:

- [migrations/20260326_create_auth_user_settings_platform.sql](/Users/tim/Code/fhfhockey.com/migrations/20260326_create_auth_user_settings_platform.sql)
- [web/pages/account/index.tsx](/Users/tim/Code/fhfhockey.com/web/pages/account/index.tsx)
- [web/pages/auth/callback.tsx](/Users/tim/Code/fhfhockey.com/web/pages/auth/callback.tsx)
- [web/pages/auth/reset-password.tsx](/Users/tim/Code/fhfhockey.com/web/pages/auth/reset-password.tsx)
- [web/components/auth/AuthModal.tsx](/Users/tim/Code/fhfhockey.com/web/components/auth/AuthModal.tsx)
- [web/components/auth/AuthForm.tsx](/Users/tim/Code/fhfhockey.com/web/components/auth/AuthForm.tsx)
- [web/components/auth/UserMenu.tsx](/Users/tim/Code/fhfhockey.com/web/components/auth/UserMenu.tsx)
- [web/components/account/AccountSettingsPage.tsx](/Users/tim/Code/fhfhockey.com/web/components/account/AccountSettingsPage.tsx)
- [web/lib/user-settings/defaults.ts](/Users/tim/Code/fhfhockey.com/web/lib/user-settings/defaults.ts)
- [web/lib/user-settings/mappers.ts](/Users/tim/Code/fhfhockey.com/web/lib/user-settings/mappers.ts)

