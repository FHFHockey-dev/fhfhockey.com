-- Minimal pgTAP stand-in for the disposable D4 cluster (pgTAP is not installed locally and
-- no dependency install is authorized). Implements only what the D4 tests call:
-- no_plan, ok, throws_ok, results_eq, finish. TAP lines are returned, and every
-- "not ok" also raises a WARNING so failures cannot hide behind psql exit code 0.
-- Counters live in transaction-local GUCs so they work under SET ROLE anon/authenticated.
CREATE FUNCTION extensions.no_plan() RETURNS SETOF text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('d4tap.n', '0', true);
  PERFORM set_config('d4tap.failed', '0', true);
  RETURN;
END $$;

CREATE FUNCTION extensions.ok(pass boolean, description text DEFAULT '') RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  n integer := coalesce(nullif(current_setting('d4tap.n', true), ''), '0')::integer + 1;
  f integer := coalesce(nullif(current_setting('d4tap.failed', true), ''), '0')::integer;
BEGIN
  PERFORM set_config('d4tap.n', n::text, true);
  IF pass IS TRUE THEN
    RETURN format('ok %s - %s', n, description);
  END IF;
  PERFORM set_config('d4tap.failed', (f + 1)::text, true);
  RAISE WARNING 'D4TAP not ok % - %', n, description;
  RETURN format('not ok %s - %s', n, description);
END $$;

CREATE FUNCTION extensions.throws_ok(query text, errcode char(5), errmsg text, description text)
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE query;
  EXCEPTION WHEN OTHERS THEN
    IF errcode IS NULL OR SQLSTATE = errcode THEN
      RETURN extensions.ok(errmsg IS NULL OR SQLERRM = errmsg, description);
    END IF;
    RETURN extensions.ok(false, format('%s (got %s: %s)', description, SQLSTATE, SQLERRM));
  END;
  RETURN extensions.ok(false, description || ' (no error raised)');
END $$;

CREATE FUNCTION extensions.lives_ok(query text, description text) RETURNS text
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE query;
  RETURN extensions.ok(true, description);
EXCEPTION WHEN OTHERS THEN
  RETURN extensions.ok(false, format('%s (got %s: %s)', description, SQLSTATE, SQLERRM));
END $$;

CREATE FUNCTION extensions.results_eq(query text, want anyarray, description text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  rec record;
  got text[] := ARRAY[]::text[];
  expected text[];
BEGIN
  SELECT coalesce(array_agg(e::text), ARRAY[]::text[]) INTO expected FROM unnest(want) e;
  FOR rec IN EXECUTE query LOOP
    got := got || (SELECT value FROM json_each_text(row_to_json(rec)) LIMIT 1);
  END LOOP;
  IF got IS NOT DISTINCT FROM expected THEN
    RETURN extensions.ok(true, description);
  END IF;
  RETURN extensions.ok(false, format('%s (got %s, want %s)', description, got, expected));
EXCEPTION WHEN OTHERS THEN
  RETURN extensions.ok(false, format('%s (got %s: %s)', description, SQLSTATE, SQLERRM));
END $$;

CREATE FUNCTION extensions.finish() RETURNS SETOF text LANGUAGE plpgsql AS $$
DECLARE
  n integer := coalesce(nullif(current_setting('d4tap.n', true), ''), '0')::integer;
  f integer := coalesce(nullif(current_setting('d4tap.failed', true), ''), '0')::integer;
BEGIN
  RETURN NEXT format('1..%s', n);
  IF f > 0 THEN
    RETURN NEXT format('# Looks like you failed %s test%s of %s', f, CASE WHEN f = 1 THEN '' ELSE 's' END, n);
  END IF;
END $$;

GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION extensions.no_plan(), extensions.ok(boolean, text),
  extensions.throws_ok(text, char, text, text), extensions.lives_ok(text, text),
  extensions.results_eq(text, anyarray, text), extensions.finish()
  TO PUBLIC, anon, authenticated, service_role;
