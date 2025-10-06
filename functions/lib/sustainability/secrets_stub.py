"""In-repo placeholder for local development secret overrides.

IMPORTANT:
  * DO NOT place real production secrets in this file.
  * This exists only to allow running the sustainability pipeline locally
    without exporting environment variables every time.
  * All values default to None so normal environment variable resolution is used.
  * If you temporarily set one for quick local debugging, revert it to None before commit.

SECURITY REMINDER:
  Supabase service role keys, database passwords, refresh tokens, and private keys
  are highly sensitive. Hardcoding them in the repository history increases risk.
  Instead, provide them via environment variables, a secrets manager, or a local
  untracked .env file.
"""

# Example (leave as None in committed code):
HARD_CODED_SUPABASE_DB_URL: str | None = None  # e.g., "postgresql://..."
HARD_CODED_SUPABASE_SERVICE_ROLE_KEY: str | None = None

# You may also add other optional dev-only overrides here (anon key is public but still prefer env):
HARD_CODED_SUPABASE_ANON_KEY: str | None = None

__all__ = [
    "HARD_CODED_SUPABASE_DB_URL",
    "HARD_CODED_SUPABASE_SERVICE_ROLE_KEY",
    "HARD_CODED_SUPABASE_ANON_KEY",
]
