-- PROPOSAL ONLY. Line R1b: read-only follow-up to R1 for option V1b + E2. Catalog metadata only; no secret values or rows.
-- BLSH Chef approves before it runs. Pair it with the Vercel integration listing (names only) described in PROPOSAL-SUPABASE §5.
begin transaction read only;
set local statement_timeout = '15s';
-- Roles a SUPABASE_JWT_SECRET-minted PostgREST token can assume (members of authenticator), and their attributes.
select 'authenticator_member' as fact, m.roleid::regrole::text as role, r.rolsuper, r.rolbypassrls,
       pg_catalog.has_schema_privilege(m.roleid, 'fhfh_internal', 'usage') as fhfh_internal_usage
  from pg_catalog.pg_auth_members m join pg_catalog.pg_roles r on r.oid = m.roleid
 where m.member = pg_catalog.to_regrole('authenticator') order by 2;
-- Who can log in with a password today (names only), so E2's rotation list is complete for the postgres user.
select 'login_role' as fact, rolname, rolsuper, rolcreaterole from pg_catalog.pg_roles where rolcanlogin order by 2;
rollback;
