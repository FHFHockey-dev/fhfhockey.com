-- `public.execute_sql(text)` is an operator-only maintenance boundary.  It is
-- SECURITY DEFINER and accepts arbitrary SQL, so browser roles must never be
-- able to invoke it.  Keep the evidenced server-side service-role consumers.

revoke execute on function public.execute_sql(text)
from public, anon, authenticated;

grant execute on function public.execute_sql(text)
to service_role;
