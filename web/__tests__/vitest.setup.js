// Unit tests must never depend on or load ignored local environment files.
// These inert values satisfy import-time client validation while ensuring an
// accidentally unmocked request cannot target the deployed Supabase project.
process.env.NEXT_PUBLIC_SUPABASE_URL ??=
  "https://unit-tests.supabase.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY ??= "synthetic-public-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "synthetic-service-role-key";
