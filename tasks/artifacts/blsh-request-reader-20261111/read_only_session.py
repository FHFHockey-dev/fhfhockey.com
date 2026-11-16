"""Dedicated existing-credential TLS transport, restricted to capture SQL."""
import asyncio
from pathlib import Path
from urllib.parse import urlsplit,unquote
import psycopg2
from psycopg2 import extensions
import capture_reader as c

REPO=Path('/Users/tim/Code/fhfhockey.com')
PROJECT='fyhftlxokyjtpndbkfse'
HOST='aws-0-us-east-1.pooler.supabase.com'
BUNDLE=Path('/Users/tim/Documents/Codex/2026-10-27/task-3/row-repair-01/live-execution-v4-01/pooler-qualification-01/attempt-01/existing-trusted-roots.pem')
BUNDLE_SHA256='50c3011a9542c7efe601ff2e0c0101a63af042fc0278fe68b3fa3ceefff4c3c5'


def bind(project,route,dsn):
    c.require(project==PROJECT,'project_binding_drift')
    target=urlsplit(route);credential=urlsplit(dsn)
    c.require(target.scheme=='postgresql' and target.hostname==HOST and target.port==5432
              and target.username=='postgres.'+PROJECT and target.path=='/postgres'
              and not target.password and not target.query and not target.fragment,'session_pooler_binding_drift')
    c.require(credential.scheme=='postgresql' and credential.hostname=='db.'+PROJECT+'.supabase.co'
              and credential.port==5432 and credential.username=='postgres' and credential.path=='/postgres'
              and bool(credential.password),'existing_credential_binding_drift')
    return target.username,unquote(credential.password)


async def ready(raw):
    while raw.poll()!=extensions.POLL_OK:
        await asyncio.sleep(.001)


class ReadOnlySession:
    capture_kind='authorized_read_only_session'
    def __init__(self,raw):self.raw=raw
    async def query(self,sql,params=None):
        c.require(sql in (*c.INIT_SQL,c.META_SQL,c.KEY_SQL,c.PAGE_SQL,'ROLLBACK'),'capture_sql_allowlist')
        if sql==c.KEY_SQL:
            c.require(params==(c.SEASON,c.DATE_MIN,c.DATE_MAX),'key_parameter_scope')
        elif sql==c.PAGE_SQL:
            c.require(isinstance(params,tuple) and len(params)==4 and params[1:]==(c.SEASON,c.DATE_MIN,c.DATE_MAX),'page_parameter_scope')
            ids=params[0]
            c.require(isinstance(ids,list) and 0<len(ids)<=c.PAGE_KEYS and all(c.positive_id(i) for i in ids) and ids==sorted(set(ids)),'page_key_scope')
        else:c.require(params is None,'control_parameter_scope')
        cur=self.raw.cursor()
        try:
            cur.execute(sql,params);await ready(self.raw)
            return cur.fetchall() if cur.description else []
        finally:cur.close()
    async def close(self):self.raw.close()


async def open_existing_read_only(dsn):
    # No persistent credential, system trust, role, security or database settings
    # are created/modified. The fixed existing trusted roots are hash-pinned.
    # 2026-11-11 retarget: the single SUPABASE_DB_URL value is parsed by run_live_read.py
    # (private-file, allowlist pattern from the operator lane) and passed in; never printed.
    c.require(c.sha(BUNDLE.read_bytes())==BUNDLE_SHA256,'existing_trust_bundle_drift')
    c.require(isinstance(dsn,str) and bool(dsn),'unambiguous_existing_credential_required')
    user,password=bind((REPO/'supabase/.temp/project-ref').read_text().strip(),
                       (REPO/'supabase/.temp/pooler-url').read_text().strip(),dsn)
    raw=None
    try:
        raw=psycopg2.connect(host=HOST,port=5432,user=user,password=password,dbname='postgres',
                             sslmode='verify-full',sslrootcert=str(BUNDLE),connect_timeout=3,async_=1,
                             application_name='BLSH_READONLY_CAPTURE_20261111',
                             options='-c default_transaction_read_only=on -c statement_timeout=5000')
        await asyncio.wait_for(ready(raw),4)
        c.require(raw.info.ssl_in_use and raw.info.host==HOST and raw.info.port==5432 and raw.info.dbname=='postgres','verified_TLS_endpoint_required')
        c.require(raw.get_transaction_status()==extensions.TRANSACTION_STATUS_IDLE,'new_idle_session_required')
        return ReadOnlySession(raw)
    except BaseException:
        if raw is not None:raw.close()
        raise
