-- REVIEW ONLY: not a migration and not authorized for hosted execution.
-- Append in the same creation transaction, after the existing explicit grants.
-- Coordinates with the current owner of the FORGE reserve migration.
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.forge_reserve_projections
  FROM service_role;
