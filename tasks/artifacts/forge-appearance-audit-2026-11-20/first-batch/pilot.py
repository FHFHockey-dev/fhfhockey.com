"""Bounded team_id pilot. Readback is always a fresh read-only transaction."""
import argparse
import csv
import datetime as dt
import fcntl
import json
from pathlib import Path
import sys
import time

import psycopg2
from psycopg2.extras import execute_values

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from batch import require, store
from snapshot import connect, sha

PACKET = Path('/Users/tim/Documents/Codex/2026-11-20/forge-appearance-first-batch')
HASH = '800c9ef136ca9d17b6d427b659774fd7654ea91168912c79184521cdf2aa01fc'
WITNESS_HASH = '5897d69da0be299fbef636c492c3edcee69375e74d38599dc503b6ba3caea26d'
SOCKET = '/tmp/forge-appearance-team-pilot-1120'
TABLE = 'public.rolling_player_game_metrics'
PLAN = 'player_id game_date strength_state game_id season old_team new_team audit_xmin event_side wgo_team wgo_toi'.split()
TYPES = 'bigint date text bigint int int int text text text float8'.split()
CTE = 'with p('+','.join(PLAN)+') as (values %s) '
JOIN = '(r.player_id,r.game_date,r.strength_state)=(p.player_id,p.game_date,p.strength_state)'
WINDOW = ('2026-11-21T18:10:00+00:00', '2026-11-21T18:15:00+00:00')


def load_plan():
    path = PACKET/'manifest.csv'
    require(sha(path) == HASH, 'manifest checksum mismatch')
    with path.open() as stream:
        rows = list(csv.DictReader(stream))
    require(len(rows) == 36 and len({(r['player_id'], r['game_date'], r['strength_state']) for r in rows}) == 36, 'key count mismatch')
    return [tuple(r['team_id'] or None if field == 'old_team' else r[field] for field in PLAN) for r in rows]


def connection(local):
    if local:
        return psycopg2.connect(host=SOCKET, port=55497, dbname='postgres', user='postgres')
    return connect()


def query(c, rows, sql):
    execute_values(c, CTE + sql, rows, template='('+','.join('%s::'+t for t in TYPES)+')', page_size=36)


def settings(c):
    c.execute("""set local statement_timeout='3s'; set local lock_timeout='300ms';
                 set local idle_in_transaction_session_timeout='10s'; set local timezone='UTC';
                 set local datestyle='ISO, MDY'; set local enable_seqscan=off; set local jit=off;
                 set local enable_hashjoin=off; set local enable_mergejoin=off""")


def keyed_state(c, rows):
    query(c, rows, f"""select r.player_id,r.game_date::text,r.strength_state,r.game_id,r.season,r.team_id,r.xmin::text,
        encode(sha256(convert_to((to_jsonb(r)-'team_id')::text,'UTF8')),'hex')
        from p join {TABLE} r on {JOIN} order by 1,2,3""")
    return [dict(zip(('player','date','strength','game','season','team','xmin','other_sha256'), row)) for row in c.fetchall()]


def evidence(c, rows):
    query(c, rows, """select count(*) from p
        join public.wgo_skater_stats w on (w.player_id,w.date)=(p.player_id,p.game_date)
        join public.games g on g.id=p.game_id join public.players pl on pl.id=p.player_id
        join public.seasons s on s.id=p.season
        join public.teams h on h.id=g."homeTeamId" join public.teams a on a.id=g."awayTeamId"
        where (g.date,g."seasonId")=(p.game_date,p.season) and g.type in (2,3)
        and g.type=(g.id/10000)%%100 and g.id/1000000*10001+1=p.season
        and p.game_date between s."startDate" and s."endDate"
        and (w.game_id,w.season_id,w.team_abbrev,w.toi_per_game)=(p.game_id,p.season,p.wgo_team,p.wgo_toi)
        and w.games_played=1 and w.toi_per_game>0
        and ((p.event_side='home' and (p.new_team,w.team_abbrev,w.opponent_team_abbrev,w.home_road)
                                      =(h.id,h.abbreviation,a.abbreviation,'H'))
          or (p.event_side='away' and (p.new_team,w.team_abbrev,w.opponent_team_abbrev,w.home_road)
                                      =(a.id,a.abbreviation,h.abbreviation,'R')))
        and not exists (select from public.rolling_player_metric_support_payloads sp
            where (sp.player_id,sp.game_date,sp.strength_state)=(p.player_id,p.game_date,p.strength_state))""")
    require(c.fetchone()[0] == 36, 'dated game, calendar, participation, teams, opponent or sidecar changed')


def audited_state(state, rows, versions, sealed, changed):
    require(len(state) == len(rows) == len(versions), 'missing or duplicate target')
    for row, plan, version, witness in zip(state, rows, versions, sealed, strict=True):
        team = plan[6 if changed else 5]
        expect = [int(plan[0]),plan[1],plan[2],int(plan[3]),int(plan[4]),None if team is None else int(team),str(version),witness['other_sha256']]
        require(list(row.values()) == expect, f"target value, version or non-team column drift at {plan[:3]}")


def connect_read(local):
    db = connection(local)
    db.set_session(isolation_level='REPEATABLE READ', readonly=True)
    c = db.cursor()
    settings(c)
    c.execute("select transaction_timestamp()::text,current_setting('transaction_read_only'),pg_current_snapshot()::text")
    stamp, ro, snap = c.fetchone()
    require(ro == 'on', 'readback must be read-only')
    return db, c, dict(time=stamp, read_only=ro, snapshot=snap)


def receipt_status(c, base, action, env):
    path = base/(action+'-intent.json')
    if not path.exists():
        return None
    receipt = json.loads(path.read_text())
    require(receipt['manifest'] == HASH and receipt['environment'] == env and receipt['action'] == action, 'unexpected intent')
    c.execute('select pg_xact_status(%s::xid8)', (str(receipt['xid']),))
    status = c.fetchone()[0]
    require(status in ('committed','aborted'), 'unknown commit status; reconcile intent and row versions')
    return receipt if status == 'committed' else None


def readback(local, rows, base, sealed, initial_versions, action):
    db, c, report = connect_read(local)
    try:
        env = 'disposable' if local else 'production'
        applied = receipt_status(c, base, 'apply', env)
        reversed_ = receipt_status(c, base, 'rollback', env)
        latest = reversed_ or applied
        versions = [latest['xid'] % 2**32]*36 if latest else initial_versions
        state = keyed_state(c, rows)
        audited_state(state, rows, versions, sealed, bool(applied and not reversed_))
        evidence(c, rows)
        report.update(environment=env, action=action, manifest=HASH, rows=state,
                      source_matches=36, committed_apply_xid=applied and applied['xid'],
                      committed_rollback_xid=reversed_ and reversed_['xid'])
        store(base/(action+'-readback-'+str(time.time_ns())+'.json'), report)
        return applied, reversed_
    finally:
        db.close()


def check_slot():
    now = dt.datetime.now(dt.timezone.utc)
    require(dt.datetime.fromisoformat(WINDOW[0]) <= now < dt.datetime.fromisoformat(WINDOW[1]), 'acknowledged pilot window is not open')


def run(action, local, approved, base):
    rows = load_plan()
    witness = PACKET/'preapproval.json'
    require(sha(witness) == WITNESS_HASH, 'original witness checksum mismatch')
    sealed = json.loads(witness.read_text())['rows']
    versions = [r[7] for r in rows]
    if local:
        versions = json.loads((PACKET/'fixture/local-versions.json').read_text())
    base.mkdir(parents=True, exist_ok=True)
    env = 'disposable' if local else 'production'
    with (base/'operator.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        applied, reversed_ = readback(local, rows, base, sealed, versions, action+'-pre')
        if action == 'readback':
            return
        if not local:
            require(approved == HASH, 'exact batch approval hash required')
        require(action != 'apply' or not reversed_, 'pilot rolled back; reapply requires a new audit')
        if (action == 'apply' and applied) or (action == 'rollback' and reversed_):
            print('Verified committed state, zero writes')
            return
        reverse = action == 'rollback'
        require(not reverse or applied, 'no committed apply')
        if not local and not reverse:
            check_slot()
        if reverse:
            versions = [str(applied['xid'] % 2**32)] * 36
        timed = time.monotonic
        db = connection(local)
        try:
            db.set_session(isolation_level='SERIALIZABLE', readonly=False)
            c = db.cursor()
            start = timed()
            settings(c)
            c.execute('select pg_try_advisory_xact_lock(25061120,36)')
            require(c.fetchone()[0], 'pilot busy')
            c.execute("""select count(*) from pg_trigger where tgrelid='public.rolling_player_game_metrics'::regclass
                         and not tgisinternal and tgenabled<>'D'""")
            require(c.fetchone()[0] == 0, 'unexpected enabled user trigger')
            evidence(c, rows)
            audited_state(keyed_state(c, rows), rows, versions, sealed, reverse)
            c.execute('select pg_current_xact_id()::text')
            xid = int(c.fetchone()[0])
            # The manifest column audit_xmin is rebound to the expected transaction version for this action only.
            compare_rows = [(*r[:7], v, *r[8:]) for r,v in zip(rows,versions,strict=True)]
            current, target = ('new_team','old_team') if reverse else ('old_team','new_team')
            update = f"""update {TABLE} r set team_id=p.{target} from p where {JOIN}
                and (r.game_id,r.season,r.team_id) is not distinct from (p.game_id,p.season,p.{current})
                and r.xmin::text=p.audit_xmin returning r.player_id"""
            def explain(options):
                execute_values(c, 'explain ('+options+') '+CTE+update, compare_rows,
                               template='('+','.join('%s::'+t for t in TYPES)+')',page_size=36)
                return c.fetchone()[0][0]
            shape = explain('format json')
            def bounded(node):
                if node.get('Relation Name') == 'rolling_player_game_metrics' and 'Scan' in node['Node Type']:
                    return (node['Node Type'] == 'Index Scan' and node.get('Index Name') == 'rolling_player_game_metrics_pkey'
                            and all(col in node.get('Index Cond','') for col in ('player_id','game_date','strength_state')))
                return all(bounded(p) for p in node.get('Plans', []))
            require(bounded(shape['Plan']) and 'rolling_player_game_metrics_pkey' in json.dumps(shape), 'unbounded target access path')
            before_update = timed()
            measured = explain('analyze, buffers, wal, timing off, format json')
            update_roundtrip_ms = (timed()-before_update)*1000
            engine = measured['Plan']
            require(engine['Actual Rows'] == 36, 'incomplete compare-and-set')
            audited_state(keyed_state(c, rows), rows, [xid % 2**32]*36, sealed, not reverse)
            require(engine['WAL Bytes'] <= 4*1024**2 and measured['Execution Time'] <= 500,
                    'pilot write exceeded WAL or execution budget; transaction aborted')
            info = dict(action=action, manifest=HASH, environment=env, xid=xid, changed=36,
                        update_roundtrip_ms=round(update_roundtrip_ms,3), explain=measured)
            store(base/(action+'-intent.json'),info)
            if not local and not reverse:
                check_slot()
            require(timed()-start < 5, 'five-second transaction budget exceeded before commit')
            t = timed()
            db.commit()
            info.update(commit_roundtrip_ms=round((timed()-t)*1000,3),transaction_wall_ms=round((timed()-start)*1000,3))
            store(base/(action+'-committed.json'),info)
        finally:
            db.close()
        readback(local,rows,base,sealed,versions,action+'-postcommit')
        print(f'{env} {action}: 36 committed and verified on independent connection; xid {xid}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=('apply','rollback','readback'))
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument('--disposable', action='store_true')
    scope.add_argument('--production', action='store_true')
    parser.add_argument('--approved-sha256')
    args = parser.parse_args()
    run(args.action,args.disposable,args.approved_sha256,PACKET/('local' if args.disposable else 'production'))
