select rolname, rolconfig from pg_roles where rolname in ('authenticator','anon','service_role','authenticated')
