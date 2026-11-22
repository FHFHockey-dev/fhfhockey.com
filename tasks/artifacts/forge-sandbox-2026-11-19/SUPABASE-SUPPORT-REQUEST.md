# Draft · Supabase support request (private; TJ sends)

**Subject:** PUBLIC EXECUTE on SECURITY DEFINER pgsodium functions (mask_role and others) in project fyhftlxokyjtpndbkfse

**Project:** fyhftlxokyjtpndbkfse (us-east-1, Postgres image 15.1.1.19, created 2022-09-30)

Hello Supabase team,

While auditing privileges before adding a restricted database login, we found that several pgsodium functions in our project are `SECURITY DEFINER` and executable by `PUBLIC`. They are owned by `supabase_admin`. Our `postgres` role has no grant option on them, so we cannot revoke the grants ourselves.

Read-only evidence, gathered 2026-11-19 from `pg_proc` and `pg_namespace`:

| Function | Owner | ACL | `postgres` grant option |
| --- | --- | --- | --- |
| `pgsodium.mask_role(regrole,text,text)` | supabase_admin | default (PUBLIC EXECUTE) | no |
| `pgsodium.update_mask(oid,boolean)` | supabase_admin | default (PUBLIC EXECUTE) | no |
| `pgsodium.enable_security_label_trigger()` | supabase_admin | default (PUBLIC EXECUTE) | no |
| `pgsodium.disable_security_label_trigger()` | supabase_admin | default (PUBLIC EXECUTE) | no |
| `pgsodium.get_key_by_id(uuid)` | supabase_admin | default (PUBLIC EXECUTE) | no |
| `pgsodium.get_key_by_name(text)` | supabase_admin | default (PUBLIC EXECUTE) | no |
| `pgsodium.get_named_keys(text)` | supabase_admin | default (PUBLIC EXECUTE) | no |
| `pgsodium.create_key(...)` | pgsodium_keymaker | `=X/pgsodium_keymaker` (PUBLIC EXECUTE) | yes |

`PUBLIC` also has `USAGE` on schema `pgsodium`.

The body of `pgsodium.mask_role` runs:

```sql
EXECUTE format('GRANT SELECT ON pgsodium.key TO %s', masked_role);
EXECUTE format('GRANT pgsodium_keyiduser, pgsodium_keyholder TO %s', masked_role);
EXECUTE format('GRANT ALL ON %I TO %s', view_name, masked_role);
```

Because it runs as `supabase_admin` and has no fixed `search_path`, any role that can log in appears able to call it. It can grant itself `ALL` on any relation reachable through its own `search_path`, and it can join the pgsodium key roles. We did not call any of these functions or change any grants.

**Request**

1. Please revoke `EXECUTE` from `PUBLIC` on the functions above, or advise the supported remediation for this image, such as an upgrade path or pgsodium removal guidance. We need to keep Vault working.
2. Please confirm whether `PUBLIC USAGE` on schema `pgsodium` is expected.

Until this is resolved we will not create any additional `LOGIN` roles in this project.

Thank you.
