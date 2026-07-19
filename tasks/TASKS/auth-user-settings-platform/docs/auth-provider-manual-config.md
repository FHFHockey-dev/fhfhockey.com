# Auth Provider Manual Configuration

This note documents the manual setup required for the auth flows now implemented in the app.

Evidence status as of 2026-07-18: production Google OAuth is verified; localhost Google remains open; custom SMTP configuration, Supabase handoff, and Outlook Inbox receipt for both confirmation and recovery are verified; the received-link confirmation/recovery/password-update/cleanup lifecycle remains open; preview auth is required only if previews are intentionally supported. The browser client still uses Supabase JavaScript's default implicit flow. PKCE remains a separate deferred migration under source task `NEW 46.0` and must not be enabled before the email-template and mailbox-backed flows are compatible.

Implemented app routes:

- Production site URL: `https://fhfhockey.com`
- App auth callback route: `https://fhfhockey.com/auth/callback`
- App reset-password route: `https://fhfhockey.com/auth/reset-password`
- Local app URL: `http://localhost:3000`
- Local app callback route: `http://localhost:3000/auth/callback`
- Local reset-password route: `http://localhost:3000/auth/reset-password`

Hosted Supabase project reference found in the repo:

- Supabase project ref: `fyhftlxokyjtpndbkfse`
- Hosted Supabase OAuth callback URI: `https://fyhftlxokyjtpndbkfse.supabase.co/auth/v1/callback`

## 1. Supabase Dashboard

### Authentication providers

Enable:

- `Email`
- `Google`

Do not use Yahoo, Fantrax, Patreon, or ESPN as primary site auth providers.

### URL configuration

Set:

- `Site URL` = `https://fhfhockey.com`

Add redirect URLs:

- `https://fhfhockey.com/auth/callback`
- `https://fhfhockey.com/auth/reset-password`
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/reset-password`
- `http://localhost:3000/**`
- `https://*-<your-vercel-team-or-account-slug>.vercel.app/**` only if preview auth is intentionally supported

Notes:

- In production, prefer the exact callback path instead of a broad wildcard.
- The app now uses `redirectTo` URLs that land on `/auth/callback`, then internally forwards users to the right next page.
- Because the app uses `NEXT_PUBLIC_VERCEL_URL` as a redirect fallback in preview environments, preview URLs must be on the allow list only when preview auth is an intended supported behavior.

### Email auth settings

Recommended:

- Keep `Confirm email` enabled.
- Use Supabase-managed passwords only. Do not store passwords in app tables.
- Keep the current custom SMTP sender configured. Production confirmation/recovery requests, Supabase handoff, and recipient-side Outlook Inbox receipt are verified; link completion remains unverified.

### Email templates

If your confirmation or recovery templates still use `{{ .SiteURL }}`, update them to respect `redirectTo`:

- use `{{ .RedirectTo }}` in the auth email links

This matters because sign-up and recovery links now intentionally target the app callback route rather than only the base site URL.

### Required app environment values

Confirm these exist in your deploy environment:

- `NEXT_PUBLIC_SITE_URL=https://fhfhockey.com`
- `NEXT_PUBLIC_SUPABASE_URL=https://fyhftlxokyjtpndbkfse.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY=<your anon/public key>`

Optional but recommended on Vercel:

- `NEXT_PUBLIC_VERCEL_URL` is automatically injected by Vercel and is used as the preview fallback origin.

## 2. Google Cloud / Google Auth Platform

Create a Google OAuth client:

- type: `Web application`

### Authorized JavaScript origins

Add:

- `https://fhfhockey.com`
- `http://localhost:3000`

If you actively test preview deployments with Google login, also add the exact preview origin you need. Do not over-broaden this list more than necessary.

### Authorized redirect URIs

Add:

- `https://fyhftlxokyjtpndbkfse.supabase.co/auth/v1/callback`

If you use local Supabase CLI auth locally, also add:

- `http://127.0.0.1:54321/auth/v1/callback`

Important:

- Google redirects to the Supabase Auth callback, not directly to `/auth/callback` on your site.
- Supabase then redirects back into the app callback route you configured in `redirectTo`.

### Google scopes

Keep the auth scopes minimal:

- `openid`
- `userinfo.email`
- `userinfo.profile`

No additional Google scopes are needed for site auth MVP.

### Brand / consent screen

Recommended:

- set app name and logo in Google Auth Platform
- verify branding if you plan to ship widely

Without branding, users will see a more generic consent experience and may instead see the Supabase domain in parts of the flow.

## 3. App Flow Mapping

Current flow behavior in code:

- Google sign-in:
  - app calls `supabase.auth.signInWithOAuth({ provider: "google", options.redirectTo: "<app>/auth/callback?next=..." })`
  - Google returns to Supabase callback
  - Supabase redirects to app `/auth/callback`
  - the current browser client does not set `flowType`, so Supabase JavaScript's default implicit flow remains active
  - `/auth/callback` accepts a code, token hash, or fragment session payload, synchronously scrubs query/hash and Next-history state before asynchronous auth work, then returns the user to a sanitized same-origin `next` path
  - production Google sign-in is verified; localhost remains open

- Email/password sign-up:
  - app calls `supabase.auth.signUp(..., { emailRedirectTo: "<app>/auth/callback?next=..." })`
  - email confirmation link returns to app `/auth/callback`
  - app accepts the supported code, token-hash, or fragment-session representation, scrubs credential-bearing location/history state synchronously, verifies the response, and redirects to a sanitized `next`
  - custom SMTP configuration, Supabase handoff, and Outlook Inbox receipt are verified; link opening, callback completion, and cleanup remain open

- Forgot password:
  - app calls `supabase.auth.resetPasswordForEmail(..., { redirectTo: "<app>/auth/reset-password" })`
  - recovery lands directly on `/auth/reset-password`
  - the reset page accepts a code, recovery token hash, or fragment session payload and synchronously scrubs credential-bearing location/history state before session processing
  - after a valid recovery session, the page sends a bounded `PUT` request to Supabase `/auth/v1/user` with the active recovery access token; it does not call `supabase.auth.updateUser`
  - request/handoff behavior and Outlook Inbox receipt are verified; reset rendering from a real received link, password update, return navigation, and cleanup remain open

## 4. Manual Verification Checklist

After configuring Supabase and Google, use this current evidence split:

1. **Open:** Google sign-in works from `http://localhost:3000`.
2. **Verified:** Google sign-in works from `https://fhfhockey.com`.
3. **Verified for delivery:** Email/password sign-up request, SMTP handoff, and Outlook Inbox receipt succeed.
4. **Open:** A received verification link lands on `/auth/callback`, completes confirmation, returns safely, and leaves no credential-bearing location/history state.
5. **Verified for delivery:** Forgot-password request, SMTP handoff, and Outlook Inbox receipt succeed.
6. **Open:** A received recovery link lands directly on `/auth/reset-password` and renders the reset flow.
7. **Open:** Updating the password on `/auth/reset-password` through the bounded `/auth/v1/user` request succeeds, returns safely, and is cleaned up.
8. **Conditional:** Verify preview deployments only if preview auth support is intentionally required.

## 5. Common Misconfigurations

- `Site URL` is still `http://localhost:3000` in production.
- Production callback path was not added to Supabase redirect URLs.
- Production or localhost `/auth/reset-password` path was not added to Supabase redirect URLs.
- Google `Authorized redirect URIs` points to your app callback instead of the Supabase callback.
- Google provider is enabled in app code but not enabled in the Supabase dashboard.
- Email templates still use `{{ .SiteURL }}` and ignore `{{ .RedirectTo }}`.
- `NEXT_PUBLIC_SITE_URL` is missing in production, causing redirects to rely on a preview or localhost fallback.

## Sources

- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase Google sign-in: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase password-based auth and recovery: https://supabase.com/docs/guides/auth/passwords
- Supabase PKCE flow: https://supabase.com/docs/guides/auth/sessions/pkce-flow
