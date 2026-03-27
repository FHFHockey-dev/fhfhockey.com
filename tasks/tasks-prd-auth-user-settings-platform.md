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
- `web/__tests__/components/Layout/Header.test.tsx` - Component tests for logged-out header CTA rendering, modal launch, and logged-in header state handoff.
- `web/components/auth/AuthModal.tsx` - Modal container for sign-in, sign-up, forgot-password, and verification guidance flows.
- `web/components/auth/AuthModal.module.scss` - Styles for the header-triggered auth modal shell.
- `web/components/auth/AuthModal.test.tsx` - Component tests for auth modal rendering, mode switching, and main interaction states.
- `web/components/auth/AuthForm.tsx` - Form logic for Google sign-in, email/password sign-in, sign-up, and password recovery requests.
- `web/components/auth/AuthForm.module.scss` - Styles for the in-modal Google and email/password auth form states.
- `web/__tests__/components/auth/AuthForm.test.tsx` - Component tests for auth form validation, submit states, and auth-method branches.
- `web/components/auth/UserMenu.module.scss` - Styles for the logged-in avatar trigger and account tray/menu.
- `web/components/auth/UserMenu.tsx` - Logged-in avatar trigger and tray/menu for sign out, account settings, and league settings entry points.
- `web/__tests__/components/auth/UserMenu.test.tsx` - Component tests for avatar menu actions and authenticated header states.
- `web/pages/auth/index.tsx` - Existing auth page that should be reduced to a compatible fallback or redirect-oriented surface after the modal flow is introduced.
- `web/pages/auth/callback.tsx` - OAuth and verification callback handler route for Supabase redirects.
- `web/pages/auth/Callback.module.scss` - Styles for the callback status page that handles OAuth and email-link completion states.
- `web/__tests__/pages/auth/callback.test.tsx` - Route-level tests for callback code exchange and redirect behavior.
- `web/pages/auth/reset-password.tsx` - Password reset page for recovery links and password update UX.
- `web/pages/auth/ResetPassword.module.scss` - Styles for the dedicated reset-password recovery page.
- `web/__tests__/pages/auth/reset-password.test.tsx` - Tests for reset-password token handling, validation, and successful reset flow.
- `tasks/auth-provider-manual-config.md` - Manual Supabase and Google Cloud configuration checklist for the implemented auth flows.
- `web/pages/account/index.tsx` - Account settings route entry point for authenticated users.
- `web/__tests__/pages/account/index.test.tsx` - Smoke tests for the authenticated account route shell and unauthenticated fallback prompt.
- `web/components/account/AccountSettingsPage.tsx` - Main account settings UI for profile, league defaults, saved teams, connected accounts placeholders, and Patreon placeholder controls.
- `web/components/account/AccountSettingsPage.module.scss` - Styles for the authenticated account-settings shell and section navigation.
- `web/__tests__/components/account/AccountSettingsPage.test.tsx` - Component tests for account settings sections, profile editing, empty states, and guarded actions.
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

- [x] 3.0 Implement the header authentication entry flow with a logged-out sign-in/sign-up button and a logged-in avatar menu
  - [x] 3.1 Update `Header.tsx` to render a logged-out `Sign-in / Sign-up` CTA to the right of `.bmcWrap`.
  - [x] 3.2 Add the logged-in avatar trigger in the same header area, using a safe avatar fallback strategy when no provider image exists.
  - [x] 3.3 Build the logged-in tray or menu with at least `Account Settings`, `League Settings`, and `Sign Out`.
  - [x] 3.4 Wire the logged-out CTA to open the auth modal and wire the logged-in actions to the correct routes or placeholders.
  - [x] 3.5 Update header styles so the new auth UI works in the existing desktop/mobile header system without disrupting current navigation behavior.
  - [x] 3.6 Add component tests covering logged-out, logged-in, and sign-out/menu interaction states.

- [x] 4.0 Implement the core auth UX flows for Google sign-in, email/password, email verification, callback handling, and password reset
  - [x] 4.1 Build an `AuthModal` that supports sign-in, sign-up, and forgot-password modes without requiring a dedicated page for normal entry.
  - [x] 4.2 Build an `AuthForm` that supports Google OAuth initiation and email/password sign-in/sign-up submission through Supabase Auth.
  - [x] 4.3 Add clear UX states for email verification required, existing-account collisions, OAuth errors, invalid credentials, and recovery-email success.
  - [x] 4.4 Implement the Supabase callback route for OAuth code exchange and verification-related redirects.
  - [x] 4.5 Implement the reset-password page so recovery links can land on a dedicated route and allow secure password updates.
  - [x] 4.6 Rework the existing `/auth` page into a compatible fallback surface or redirect-oriented helper page that does not conflict with the new modal-first UX.
  - [x] 4.7 Add route/component tests for callback handling, password reset flow, and auth-form state transitions.
  - [x] 4.8 Document the manual provider configuration required in Supabase and Google Cloud, including site URL, redirect allow list, callback URL, and OAuth client settings.

- [x] 5.0 Build the MVP Account Settings experience and design-safe placeholders for league settings, connected accounts, provider refresh controls, and Patreon entitlements
  - [x] 5.1 Create the authenticated `/account` route and main `AccountSettingsPage` shell.
  - [x] 5.2 Add profile management UI backed by `user_profiles`, including display name and avatar display state.
  - [x] 5.3 Add league-default settings UI backed by `user_settings`, using the persisted fantasy scoring and roster-config mapping helpers without touching Draft Dashboard.
  - [x] 5.4 Add the MVP saved-teams UI backed by `user_saved_teams`, including create, edit, list, and default-selection behavior for manual saved teams.
  - [x] 5.5 Add non-implemented but explicit connected-account sections for Yahoo, Fantrax, Patreon, and ESPN so the architecture is visible without shipping the real sync flows yet.
  - [x] 5.6 Add design placeholders for future provider features including multiple linked leagues/teams, default team selection, active-context switching, refresh-on-login preference, manual refresh, cooldown messaging, and in-flight dedupe states.
  - [x] 5.7 Add Patreon entitlement placeholders on the account page that make clear Patreon is connected from account settings rather than used as primary site login.
  - [x] 5.8 Add guarded authenticated-page behavior for unauthenticated users and loading/error states for missing profile/settings rows.
  - [x] 5.9 Add component tests for account settings rendering, saved-team CRUD states, default-team behavior, and connected-account placeholder visibility.

- [ ] 6.0 Enforce cross-table ownership consistency for provider-linked records discovered during schema design
  - [ ] 6.1 Add composite foreign keys, constraints, or trigger-based validation so provider-linked rows cannot reference `connected_account_id`, `external_league_id`, or `external_team_id` owned by a different `user_id`.

- [ ] 7.0 Harden provider secret storage before any real Yahoo, Fantrax, Patreon, or ESPN tokens are written
  - [ ] 7.1 Choose and implement an at-rest encryption strategy for `private.connected_account_tokens` instead of relying on plain text token columns.

- [ ] 8.0 Migrate ambiguous Supabase imports to explicit client roles discovered during the wrapper audit
  - [ ] 8.1 Replace server-side and API-route imports of `lib/supabase` with explicit browser, public, authenticated-token, or service-role clients based on actual access requirements.

- [ ] NEW 9.0 Complete the manual Supabase email-auth delivery configuration required for sign-up verification and password recovery
  - [ ] NEW 9.1 Enable `Email` auth in the Supabase dashboard for the target environment.
  - [ ] NEW 9.2 Confirm that `Confirm email` is enabled so password sign-up requires verification before protected settings access.
  - [ ] NEW 9.3 Update Supabase auth email templates to use `{{ .RedirectTo }}` instead of only `{{ .SiteURL }}` so verification and recovery links return to the implemented app callback flow.
  - [ ] NEW 9.4 Verify the Supabase `Site URL` and redirect allow-list entries for localhost, production, and any required preview URLs.
  - [ ] NEW 9.5 Configure a working SMTP sender or otherwise verify outbound email delivery in the active Supabase environment so sign-up and recovery emails actually arrive.

- [ ] NEW 10.0 Complete the remaining manual auth-provider configuration and verification checklist documented in `tasks/auth-provider-manual-config.md`
  - [ ] NEW 10.1 Confirm required deploy environment values exist and are correct: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`.
  - [ ] NEW 10.2 Verify Google Cloud OAuth client configuration, including authorized JavaScript origins and the hosted Supabase callback URI.
  - [ ] NEW 10.3 Run the documented manual verification checklist for Google sign-in on localhost and production.
  - [ ] NEW 10.4 Run the documented manual verification checklist for email sign-up verification, callback completion, and password-recovery flow.
  - [ ] NEW 10.5 Verify preview-deployment auth behavior if preview auth support is required.
