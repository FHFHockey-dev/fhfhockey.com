"""Bounded capture core. No connection factory, credentials, repair import or CLI.

The caller must supply an independently authorized, authenticated session. This
module never admits a feed to scoring. A capture is a presence witness only.
"""
from __future__ import annotations
import asyncio
import datetime as dt
import hashlib
import json
from pathlib import Path
import time

ROOT = Path(__file__).resolve().parent
SEASON = 20262027
DATE_MIN = '2026-07-01'
DATE_MAX = '2026-10-31'
MAX_ROWS = 10000
PAGE_KEYS = 400
MAX_LINKED = 8
MAX_QUERIES = 35
MAX_TOTAL_BYTES = 8 * 1024 * 1024
MAX_PAGE_BYTES = 262144
MAX_KEY_BYTES = 131072
QUERY_SECONDS = 5
TOTAL_SECONDS = 150
TABLES = {'wgo': 'public.wgo_skater_stats', 'individual': 'public.nst_gamelog_as_counts',
          'onIce': 'public.nst_gamelog_as_counts_oi', 'calendar': 'public.games'}
COLUMNS_SHA256 = 'c14231f0e62595eed0cb37175360cab33e4731e48a520f22f4bf494e0c127750'
COLUMN_BYTES = (ROOT / 'COLUMNS.json').read_bytes()
if hashlib.sha256(COLUMN_BYTES).hexdigest() != COLUMNS_SHA256:
    raise ValueError('column_contract_changed')
COLUMNS = json.loads(COLUMN_BYTES)
CONTEXT = tuple(COLUMNS['wgo'][:12])


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n').encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


class CaptureError(ValueError):
    pass


def require(ok, reason):
    if not ok:
        raise CaptureError(reason)


def positive_id(value):
    return type(value) is int and 0 < value <= 9007199254740991


def date_ok(value):
    try:
        return isinstance(value, str) and dt.date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def instant(value):
    require(isinstance(value, str), 'missing_timestamp')
    result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None, 'timezone_required')
    return result


def bounded_json_query(body, cap):
    return ("WITH payload AS (" + body + ") SELECT CASE WHEN pg_catalog.octet_length(data::text) <= "
            + str(cap) + " THEN data::text ELSE '{\"error\":\"response_bound_exceeded\"}' END FROM payload")


def array(alias, feed):
    return 'pg_catalog.jsonb_build_array(' + ','.join(alias + '."' + col + '"' for col in COLUMNS[feed]) + ')'


META_SQL = """SELECT pg_catalog.jsonb_build_object(
 'readOnly',pg_catalog.current_setting('transaction_read_only'),
 'isolation',pg_catalog.current_setting('transaction_isolation'),
 'statementTimeout',pg_catalog.current_setting('statement_timeout'),
 'lockTimeout',pg_catalog.current_setting('lock_timeout'),
 'idleTimeout',pg_catalog.current_setting('idle_in_transaction_session_timeout'),
 'searchPath',pg_catalog.current_setting('search_path'),
 'timezone',pg_catalog.current_setting('TimeZone'),
 'pid',pg_catalog.pg_backend_pid(), 'snapshotUTC',pg_catalog.transaction_timestamp(),
 'snapshot',pg_catalog.txid_current_snapshot()::text)::text"""
KEY_SQL = bounded_json_query("""SELECT pg_catalog.jsonb_build_object(
 'ids',COALESCE(pg_catalog.jsonb_agg(id ORDER BY id),'[]'::jsonb),
 'rows',pg_catalog.count(*)) AS data FROM (
 SELECT w.id FROM public.wgo_skater_stats w
 WHERE w.season_id=%s AND w.date BETWEEN %s::date AND %s::date
 ORDER BY w.id LIMIT 10001) keys""", MAX_KEY_BYTES)


def linked(feed, alias, predicate):
    return '(SELECT COALESCE(pg_catalog.jsonb_agg(' + array(alias, feed) + ' ORDER BY ' + alias + '.id),\'[]\'::jsonb) FROM (SELECT * FROM ' + TABLES[feed] + ' WHERE ' + predicate + ' ORDER BY id LIMIT 9) ' + alias + ')'


PAGE_SQL = bounded_json_query("SELECT pg_catalog.jsonb_build_object('rows',COALESCE(pg_catalog.jsonb_agg(row ORDER BY id),'[]'::jsonb)) AS data FROM (SELECT w.id,pg_catalog.jsonb_build_array(" + array('w', 'wgo') + ','
    + linked('individual', 'n', 'player_id=w.player_id AND date_scraped=w.date AND season=20262027') + ','
    + linked('onIce', 'n', 'player_id=w.player_id AND date_scraped=w.date AND season=20262027') + ','
    + linked('calendar', 'g', 'id=w.game_id AND "seasonId"=20262027')
    + ") AS row FROM public.wgo_skater_stats w WHERE w.id=ANY(%s) AND w.season_id=%s AND w.date BETWEEN %s::date AND %s::date) selected", MAX_PAGE_BYTES)

INIT_SQL = (
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    "SET LOCAL statement_timeout='5s'", "SET LOCAL lock_timeout='1s'",
    "SET LOCAL idle_in_transaction_session_timeout='10s'",
    'SET LOCAL search_path=pg_catalog', "SET LOCAL timezone='UTC'",
)


def validate_meta(meta, prior=None):
    for key, expected in {'readOnly':'on', 'isolation':'repeatable read', 'statementTimeout':'5s',
                          'lockTimeout':'1s', 'idleTimeout':'10s', 'searchPath':'pg_catalog', 'timezone':'UTC'}.items():
        require(meta.get(key) == expected, 'session_contract_' + key)
    require(positive_id(meta.get('pid')) and isinstance(meta.get('snapshot'), str) and bool(meta['snapshot']), 'session_identity')
    instant(meta.get('snapshotUTC'))
    if prior is not None:
        require(meta == prior, 'session_or_snapshot_drift')


def add_page(data, ids, source, event_through):
    require(isinstance(data, dict) and isinstance(data.get('rows'), list), 'page_shape')
    rows = data['rows']
    require(len(rows) == len(ids), 'missing_or_added_sealed_key')
    observed = []
    for group in rows:
        require(isinstance(group, list) and len(group) == 4, 'row_group_shape')
        require(isinstance(group[0], list) and len(group[0]) == len(COLUMNS['wgo']), 'wgo_row_shape')
        target = dict(zip(COLUMNS['wgo'], group[0]))
        observed.append(target['id'])
        require(target['season_id'] == SEASON and date_ok(target['date']) and DATE_MIN <= target['date'] <= event_through, 'wgo_out_of_scope')
        for feed, values in zip(TABLES, [[group[0]], group[1], group[2], group[3]]):
            require(isinstance(values, list) and len(values) <= MAX_LINKED, 'linked_row_bound')
            within_group = set()
            for value in values:
                require(isinstance(value, list) and len(value) == len(COLUMNS[feed]), 'source_row_shape')
                item = dict(zip(COLUMNS[feed], value)); sid = item['id']
                require(positive_id(sid) and sid not in within_group, 'invalid_or_duplicate_linked_id')
                within_group.add(sid)
                if feed in ('individual','onIce'):
                    require(item['season'] == SEASON and item['player_id'] == target['player_id'] and item['date_scraped'] == target['date'], 'process_join_scope')
                elif feed == 'calendar':
                    require(item['seasonId'] == SEASON and item['id'] == target['game_id'], 'calendar_join_scope')
                # Calendar date/type and source metric disagreements are retained
                # for qualification, rather than changed or discarded at capture.
                if sid in source[feed]:
                    require(source[feed][sid] == item, 'same_id_different_values')
                source[feed][sid] = item
    require(observed == ids, 'sealed_key_order_or_identity')


def build_request(source, captured, snapshot_utc, event_through):
    require(instant(snapshot_utc) <= instant(captured), 'capture_before_snapshot')
    raw_files = {}; feeds = {}
    for feed in TABLES:
        values = sorted(source[feed].values(), key=lambda row: row['id'])
        raw = {'source': TABLES[feed], 'columns': COLUMNS[feed], 'records': values,
               'capturedAtUTC': captured, 'snapshotUTC': snapshot_utc}
        raw_files['RAW-' + feed + '.json'] = raw
        capture = {'source':TABLES[feed], 'sha256':sha(encoded(raw)), 'retrievedAtUTC':captured,
                   'sourceAvailableThroughUTC':None, 'revisionId':None}
        if feed == 'wgo':
            values = [{**{key:row[key] for key in CONTEXT}, 'counts':{key:row[key] for key in COLUMNS['wgo'] if key not in CONTEXT}} for row in values]
        feeds[feed] = {'capture':capture, 'rows':values}
        if feed in ('individual','onIce'):
            feeds[feed].update(strengthScope='unknown', dateMeaning='unknown', toiUnit='unknown')
    request = {'seasonId':SEASON, 'eventThroughDate':event_through, 'asOfUTC':captured,
               'freshnessPolicy':{'id':'blsh-capture-reader-v1-event7days-capture24hours', 'maxEventAgeDays':7, 'maxCaptureAgeHours':24}, **feeds}
    return raw_files, request


async def capture(session, output: Path, event_through=DATE_MAX):
    """One attempt. Ownership of the supplied session transfers to this call.

    Empty output directory required; preserve failures, never resume a different
    transaction into an existing attempt. The session is closed on every path.
    """
    result = {'state':'STOPPED_NO_RETRY', 'queriesDispatched':0, 'sourceBytes':0,
              'rowsCollected':0, 'dataWrites':0, 'providerRequests':0,
              'automaticScoringAdmissionPermitted':False, 'sessionClosed':False}
    files = {}; started = time.monotonic(); stage = 'preflight'; ready_output = False; close_attempted = False
    def save(name, value):
        body = encoded(value)
        with (output / name).open('xb') as stream:
            stream.write(body)
        files[name] = sha(body)
    async def query(sql, params=None, *, cap=8192, json_result=False):
        nonlocal stage
        remaining = TOTAL_SECONDS - (time.monotonic() - started)
        require(remaining > 0 and result['queriesDispatched'] < MAX_QUERIES, 'dispatch_budget')
        number = result['queriesDispatched'] + 1
        label = f'query-{number:02d}'
        save(label + '-DISPATCH.json', {'atUTC':utc_now(), 'querySHA256':sha(sql.encode()),
                                        'paramsSHA256':sha(encoded(params)), 'stage':stage})
        result['queriesDispatched'] = number
        try:
            answer = await asyncio.wait_for(session.query(sql, params), min(QUERY_SECONDS, remaining))
        except BaseException:
            result['uncertainDispatch'] = label
            raise
        if json_result:
            require(isinstance(answer,(list,tuple)) and len(answer)==1 and len(answer[0])==1 and isinstance(answer[0][0],str), 'query_shape')
            body = answer[0][0].encode()
            require(len(body) <= cap, 'client_response_bound')
            result['sourceBytes'] += len(body)
            require(result['sourceBytes'] <= MAX_TOTAL_BYTES, 'total_response_bound')
            data = json.loads(body, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite_json')))
            require(isinstance(data,dict) and 'error' not in data, 'server_response_bound_or_error')
            save(label + '-RAW.json',data)
        else:
            require(answer in (None,[]), 'unexpected_control_result')
            data = None
        save(label + '-RECEIPT.json', {'completedAtUTC':utc_now(), 'responseSHA256':files.get(label+'-RAW.json'), 'completed':True})
        return data
    try:
        kind = getattr(session, 'capture_kind', None)
        require(kind in ('offline_fixture', 'authorized_read_only_session'), 'explicit_session_context_required')
        result['executionMode'] = kind
        require(date_ok(event_through) and DATE_MIN <= event_through <= DATE_MAX, 'frozen_current_date_scope')
        require(not output.exists(), 'attempt_already_exists_no_retry')
        output.mkdir(); ready_output = True
        save('PLAN.json', {'seasonId':SEASON,'dateMin':DATE_MIN,'eventThroughDate':event_through,
                           'tables':TABLES,'columnsSHA256':COLUMNS_SHA256,'maxRows':MAX_ROWS,'pageKeys':PAGE_KEYS,
                           'maxQueries':MAX_QUERIES,'maxTotalBytes':MAX_TOTAL_BYTES,'totalSeconds':TOTAL_SECONDS,
                           'coreSHA256':sha(Path(__file__).read_bytes())})
        stage = 'transaction_init'
        for sql in INIT_SQL:
            await query(sql)
        stage = 'session_check'
        meta = await query(META_SQL,json_result=True); validate_meta(meta)
        stage = 'seal_keys'
        seal = await query(KEY_SQL,(SEASON,DATE_MIN,event_through),cap=MAX_KEY_BYTES,json_result=True)
        ids = seal.get('ids')
        require(isinstance(ids,list) and len(ids)<=MAX_ROWS and all(positive_id(n) for n in ids), 'cohort_bound_or_id')
        require(ids == sorted(set(ids)) and seal.get('rows') == len(ids), 'key_seal_shape')
        save('KEY-SEAL.json',seal)
        source = {key:{} for key in TABLES}
        for start in range(0,len(ids),PAGE_KEYS):
            stage = f'page_{start//PAGE_KEYS+1:02d}'
            page_ids = ids[start:start+PAGE_KEYS]
            data = await query(PAGE_SQL,(page_ids,SEASON,DATE_MIN,event_through),cap=MAX_PAGE_BYTES,json_result=True)
            add_page(data,page_ids,source,event_through)
            result['rowsCollected'] = len(source['wgo'])
        stage = 'snapshot_recheck'
        after = await query(META_SQL,json_result=True); validate_meta(after,meta)
        stage = 'transaction_end'
        await query('ROLLBACK')
        captured = utc_now()
        require(time.monotonic()-started <= TOTAL_SECONDS, 'total_deadline')
        raw_files, request = build_request(source,captured,meta['snapshotUTC'],event_through)
        # No ready request is published until closure succeeds.
        stage = 'close'
        close_attempted = True
        await asyncio.wait_for(session.close(),2)
        result['sessionClosed'] = True
        stage = 'export'
        for name,value in raw_files.items():save(name,value)
        request['captureContext'] = kind
        request_name = 'SIMULATED-REQUEST.json' if kind == 'offline_fixture' else 'CURRENT-REQUEST.json'
        save(request_name,request)
        result.update(state='OFFLINE_CAPTURE_SIMULATION_COMPLETE' if kind == 'offline_fixture' else 'CAPTURED_READ_ONLY_UNQUALIFIED', asOfUTC=captured, snapshotUTC=meta['snapshotUTC'],
                      eventThroughDate=event_through, rows={key:len(rows) for key,rows in source.items()},
                      atomicDatabaseSnapshot=True, sourcePublicationWatermarksKnown=False,
                      finalityEstablished=False, processDefinitionsQualified=False, populationScope='captured_WGO_records_only')
    except BaseException as error:
        # Never persist raw connection/driver exception text (may include secrets).
        result.update(failedStage=stage, errorType=type(error).__name__, errorCode=str(error) if isinstance(error,CaptureError) else getattr(error,'pgcode',None))
        if 'uncertainDispatch' in result:
            result['state'] = 'DISPATCH_OUTCOME_UNKNOWN_NO_RETRY'
    finally:
        if close_attempted and not result['sessionClosed']:
            result['state'] = 'SESSION_CLOSE_UNCONFIRMED'
        elif not result['sessionClosed']:
            try:
                await asyncio.wait_for(session.close(),2)
                result['sessionClosed'] = True
            except BaseException as error:
                result.update(state='SESSION_CLOSE_UNCONFIRMED',closeErrorType=type(error).__name__)
        result.update(finishedAtUTC=utc_now(),elapsedSeconds=time.monotonic()-started,artifacts=files.copy())
        if ready_output:save('RESULT.json',result)
    return result
