## Relevant Files

- `migrations/20260326_create_auth_user_settings_platform.sql` - Creates the MVP user tables, deferred-provider tables, indexes, constraints, triggers, and RLS policies described in the PRD.
- `web/lib/supabase/database-generated.types.ts` - Generated Supabase types that must be updated after the schema migration so app code can use the new tables safely.
- `web/lib/supabase/client.ts` - Browser Supabase client used by auth UI flows and client-side account/settings requests.
- `web/lib/supabase/index.ts` - Existing shared Supabase wrapper that may need consolidation or cleanup for global auth/session handling.
- `web/lib/supabase/public-client.ts` - Public client used in read-only contexts; should remain safe and not gain authenticated user-only responsibilities.
- `web/lib/supabase/server.ts` - Server-side Supabase client wrapper that will need clear separation between service-role and user-session usage.
- `web/contexts/AuthProviderContext/index.tsx` - Global auth state provider that must be expanded beyond the current minimal role lookup.
- `web/pages/_app.tsx` - App root where auth-aware provider wiring must become global so the header can react to session state on every route.
- `web/components/Layout/Header/Header.tsx` - Header entry point for the logged-out `Sign-in / Sign-up` button and logged-in avatar menu.
- `web/components/Layout/Header/Header.module.scss` - Header styling updates for the new auth CTA and avatar/menu affordances.
- `web/components/auth/AuthModal.tsx` - Modal container for sign-in, sign-up, forgot-password, and verification guidance flows.
- `web/components/auth/AuthModal.test.tsx` - Component tests for auth modal rendering, mode switching, and main interaction states.
- `web/components/auth/AuthForm.tsx` - Form logic for Google sign-in, email/password sign-in, sign-up, and password recovery requests.
- `web/components/auth/AuthForm.test.tsx` - Component tests for auth form validation, submit states, and auth-method branches.
- `web/components/auth/UserMenu.tsx` - Logged-in avatar trigger and tray/menu for sign out, account settings, and league settings entry points.
- `web/components/auth/UserMenu.test.tsx` - Component tests for avatar menu actions and authenticated header states.
- `web/pages/auth/index.tsx` - Existing auth page that should be reduced to a compatible fallback or redirect-oriented surface after the modal flow is introduced.
- `web/pages/auth/callback.tsx` - OAuth and verification callback handler route for Supabase redirects.
- `web/pages/auth/callback.test.tsx` - Route-level tests for callback code exchange and redirect behavior.
- `web/pages/auth/reset-password.tsx` - Password reset page for recovery links and password update UX.
- `web/pages/auth/reset-password.test.tsx` - Tests for reset-password token handling, validation, and successful reset flow.
- `web/pages/account/index.tsx` - Account settings route entry point for authenticated users.
- `web/components/account/AccountSettingsPage.tsx` - Main account settings UI for profile, league defaults, saved teams, connected accounts placeholders, and Patreon placeholder controls.
- `web/components/account/AccountSettingsPage.test.tsx` - Component tests for account settings sections, empty states, and guarded actions.
- `web/lib/user-settings/defaults.ts` - Central default values for profile/settings rows seeded from the existing fantasy config system.
- `web/lib/user-settings/defaults.test.ts` - Unit tests for default settings generation and schema-safe fallback values.
- `web/lib/user-settings/ensureUserRecords.ts` - Auth-time helper that creates or backfills missing `user_profiles` and `user_settings` rows for newly signed-in users.
- `web/lib/user-settings/mappers.ts` - Mapping helpers between persisted user settings and the existing fantasy config shapes already used in the app.
- `web/lib/user-settings/mappers.test.ts` - Unit tests for mapping between database rows and app-facing settings objects.
- `web/lib/projectionsConfig/fantasyPointsConfig.ts` - Existing reference for default fantasy scoring that should inform seeded account settings without changing Draft Dashboard behavior.
- `web/pages/api/` - Existing API route area that may need a small authenticated settings endpoint layer if direct client-table access is not sufficient for some account operations.
- `tasks/prd-auth-user-settings-platform.md` - Source PRD this task list implements.
- `tasks/tasks-prd-auth-user-settings-platform.md` - Implementation task list for the feature.

### Notes

- Unit tests should typically be placed alongside the code files they are testing.
- This repo currently uses Vitest rather than Jest, so run targeted tests with `npx vitest run [optional/path/to/test/file]`.
- Regenerate `web/lib/supabase/database-generated.types.ts` after the migration is applied.
- Do not modify `web/components/DraftDashboard/DraftDashboard.tsx` in this feature pass.
- Do not modify `web/pages/api/v1/db/manual-refresh-yahoo-token.ts` in this feature pass.

## Tasks

- [x] 1.0 Build the Supabase-backed user data foundation for profiles, settings, saved teams, and future connected-account support
  - [x] 1.1 Create a migration for `user_profiles`, `user_settings`, and `user_saved_teams` with UUID-based ownership keyed to `auth.users.id`.
  - [x] 1.2 Add the deferred-design tables needed for future provider support, including `connected_accounts`, provider preference records, external league/team metadata tables, sync-run tracking, and Patreon/site entitlement placeholders.
  - [x] 1.3 Add indexes, uniqueness constraints, and ownership constraints needed for default-team selection, provider identity uniqueness, and future Patreon anti-sharing enforcement.
  - [x] 1.4 Add RLS policies so authenticated users can only read and mutate their own profile, settings, saved teams, and future provider-owned rows.
  - [x] 1.5 Ensure provider token storage is modeled as service-role-only or otherwise not client-readable, even if full provider token handling is deferred.
  - [x] 1.6 Define sensible database defaults for fantasy scoring, league type, roster config, UI preferences, and active-context placeholders using the existing fantasy config references.
  - [x] 1.7 Apply the migration in the appropriate environment and regenerate `web/lib/supabase/database-generated.types.ts`.

- [x] 2.0 Refactor app-wide auth state and Supabase client handling so authenticated session state is available globally and safely
  - [x] 2.1 Audit the current Supabase wrappers in `web/lib/supabase/` and choose a clear responsibility split for browser auth, public read-only access, and service-role server access.
  - [x] 2.2 Expand `AuthProviderContext` to expose a richer authenticated user shape, including ID, email, display name, avatar URL, verification-aware metadata, and admin role where available.
  - [x] 2.3 Update `web/pages/_app.tsx` so auth-aware context is available globally rather than only on `/auth` and `/db` routes.
  - [x] 2.4 Ensure auth state initializes correctly on first page load and responds to Supabase auth state changes without flicker or route-specific assumptions.
  - [x] 2.5 Add helper logic for creating or reconciling app-owned profile/settings rows after successful authentication if they do not already exist.
  - [x] 2.6 Verify that existing admin-only flows depending on the current `public.users` role table still work after the auth refactor.

- [ ] 3.0 Implement the header authentication entry flow with a logged-out sign-in/sign-up button and a logged-in avatar menu
  - [ ] 3.1 Update `Header.tsx` to render a logged-out `Sign-in / Sign-up` CTA to the right of `.bmcWrap`.
  - [ ] 3.2 Add the logged-in avatar trigger in the same header area, using a safe avatar fallback strategy when no provider image exists.
  - [ ] 3.3 Build the logged-in tray or menu with at least `Account Settings`, `League Settings`, and `Sign Out`.
  - [ ] 3.4 Wire the logged-out CTA to open the auth modal and wire the logged-in actions to the correct routes or placeholders.
  - [ ] 3.5 Update header styles so the new auth UI works in the existing desktop/mobile header system without disrupting current navigation behavior.
  - [ ] 3.6 Add component tests covering logged-out, logged-in, and sign-out/menu interaction states.

- [ ] 4.0 Implement the core auth UX flows for Google sign-in, email/password, email verification, callback handling, and password reset
  - [ ] 4.1 Build an `AuthModal` that supports sign-in, sign-up, and forgot-password modes without requiring a dedicated page for normal entry.
  - [ ] 4.2 Build an `AuthForm` that supports Google OAuth initiation and email/password sign-in/sign-up submission through Supabase Auth.
  - [ ] 4.3 Add clear UX states for email verification required, existing-account collisions, OAuth errors, invalid credentials, and recovery-email success.
  - [ ] 4.4 Implement the Supabase callback route for OAuth code exchange and verification-related redirects.
  - [ ] 4.5 Implement the reset-password page so recovery links can land on a dedicated route and allow secure password updates.
  - [ ] 4.6 Rework the existing `/auth` page into a compatible fallback surface or redirect-oriented helper page that does not conflict with the new modal-first UX.
  - [ ] 4.7 Add route/component tests for callback handling, password reset flow, and auth-form state transitions.
  - [ ] 4.8 Document the manual provider configuration required in Supabase and Google Cloud, including site URL, redirect allow list, callback URL, and OAuth client settings.

- [ ] 5.0 Build the MVP Account Settings experience and design-safe placeholders for league settings, connected accounts, provider refresh controls, and Patreon entitlements
  - [ ] 5.1 Create the authenticated `/account` route and main `AccountSettingsPage` shell.
  - [ ] 5.2 Add profile management UI backed by `user_profiles`, including display name and avatar display state.
  - [ ] 5.3 Add league-default settings UI backed by `user_settings`, using the persisted fantasy scoring and roster-config mapping helpers without touching Draft Dashboard.
  - [ ] 5.4 Add the MVP saved-teams UI backed by `user_saved_teams`, including create, edit, list, and default-selection behavior for manual saved teams.
  - [ ] 5.5 Add non-implemented but explicit connected-account sections for Yahoo, Fantrax, Patreon, and ESPN so the architecture is visible without shipping the real sync flows yet.
  - [ ] 5.6 Add design placeholders for future provider features including multiple linked leagues/teams, default team selection, active-context switching, refresh-on-login preference, manual refresh, cooldown messaging, and in-flight dedupe states.
  - [ ] 5.7 Add Patreon entitlement placeholders on the account page that make clear Patreon is connected from account settings rather than used as primary site login.
  - [ ] 5.8 Add guarded authenticated-page behavior for unauthenticated users and loading/error states for missing profile/settings rows.
  - [ ] 5.9 Add component tests for account settings rendering, saved-team CRUD states, default-team behavior, and connected-account placeholder visibility.

- [ ] 6.0 Enforce cross-table ownership consistency for provider-linked records discovered during schema design
  - [ ] 6.1 Add composite foreign keys, constraints, or trigger-based validation so provider-linked rows cannot reference `connected_account_id`, `external_league_id`, or `external_team_id` owned by a different `user_id`.

- [ ] 7.0 Harden provider secret storage before any real Yahoo, Fantrax, Patreon, or ESPN tokens are written
  - [ ] 7.1 Choose and implement an at-rest encryption strategy for `private.connected_account_tokens` instead of relying on plain text token columns.

- [ ] 8.0 Migrate ambiguous Supabase imports to explicit client roles discovered during the wrapper audit
  - [ ] 8.1 Replace server-side and API-route imports of `lib/supabase` with explicit browser, public, authenticated-token, or service-role clients based on actual access requirements.
