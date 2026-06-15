# Auth Provider Manual Configuration

This note documents the manual setup required for the auth flows now implemented in the app.

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
- `http://localhost:3000/**`
- `https://*-<your-vercel-team-or-account-slug>.vercel.app/**`

Notes:

- In production, prefer the exact callback path instead of a broad wildcard.
- The app now uses `redirectTo` URLs that land on `/auth/callback`, then internally forwards users to the right next page.
- Because the app uses `NEXT_PUBLIC_VERCEL_URL` as a redirect fallback in preview environments, preview URLs must be on the allow list if you want auth to work on previews.

### Email auth settings

Recommended:

- Keep `Confirm email` enabled.
- Use Supabase-managed passwords only. Do not store passwords in app tables.
- Configure a branded SMTP sender if you want production-ready email delivery and branding.

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
  - app exchanges the code and redirects the user back to `next`

- Email/password sign-up:
  - app calls `supabase.auth.signUp(..., { emailRedirectTo: "<app>/auth/callback?next=..." })`
  - email confirmation link returns to app `/auth/callback`
  - app verifies the OTP link and redirects the user back to `next`

- Forgot password:
  - app calls `supabase.auth.resetPasswordForEmail(..., { redirectTo: "<app>/auth/callback?next=/auth/reset-password" })`
  - recovery link returns to app `/auth/callback`
  - app verifies recovery and forwards to `/auth/reset-password`
  - reset page updates the password with `supabase.auth.updateUser({ password })`

## 4. Manual Verification Checklist

After configuring Supabase and Google, manually verify:

1. Google sign-in works from `http://localhost:3000`.
2. Google sign-in works from `https://fhfhockey.com`.
3. Email/password sign-up sends a verification email.
4. Clicking the verification email lands on `/auth/callback` and returns the user to the site.
5. Forgot-password sends a recovery email.
6. Clicking the recovery email lands on `/auth/reset-password`.
7. Updating the password on `/auth/reset-password` succeeds and returns the user to the site.
8. Preview deployments authenticate correctly if you intend to support auth on preview URLs.

## 5. Common Misconfigurations

- `Site URL` is still `http://localhost:3000` in production.
- Production callback path was not added to Supabase redirect URLs.
- Google `Authorized redirect URIs` points to your app callback instead of the Supabase callback.
- Google provider is enabled in app code but not enabled in the Supabase dashboard.
- Email templates still use `{{ .SiteURL }}` and ignore `{{ .RedirectTo }}`.
- `NEXT_PUBLIC_SITE_URL` is missing in production, causing redirects to rely on a preview or localhost fallback.

## Sources

- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase Google sign-in: https://supabase.com/docs/guides/auth/social-login/auth-google
