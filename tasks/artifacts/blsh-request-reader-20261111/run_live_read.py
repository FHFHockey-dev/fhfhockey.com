"""BLSH request reader for source date 2026-11-11: the ONE live read (POST-CAPTURE step 4), then the offline export.

Adapted from Codex current-refresh-reader-20261101-01/execute_read_only.py (108c4179...). Value-free: it never prints a
credential value, never puts one in argv and never persists driver exception text.

The ONLY supported invocation (needs TJ's approval of the exact command and LIVE-READ-SCOPE.json hash):
    /usr/bin/env -i PATH=/usr/bin:/bin /opt/anaconda3/bin/python3 -I -B -X pycache_prefix=/var/empty <this file> \
        --execute-read-only --candidate v5 --scope-sha <LIVE-READ-SCOPE.json sha256> --conversion "$WORK/conversion" \
        --out "$WORK/request-read" --request-out "$WORK/request.json" --context-out "$WORK/context.json"

Gate order (every refusal is one JSON line {"reader":"refuse","code":...}, exit 2, before any connection):
  isolation + no bytecode (-I -B, pycache_prefix=/var/empty, root-owned and empty) -> own env allowlist -> args ->
  reader folder is the pinned path -> scope + pins (local files, trust bundle, interpreter, psycopg2 tree, node, web
  sources) -> offline test receipt -> capture_reader/read_only_session executed from their hash-checked source bytes
  (never via sys.path or a .pyc) -> import-origin check (every module loaded since start-up is stdlib, the pinned
  psycopg2 tree or a pinned file) -> conversion (manifest hashes, class re-derived from the explicit --candidate's
  approved pins/verifier/node/lineage, its packet name, date 2026-11-11) -> time window
  (after the latest native retrieval, <= 12 h after the earliest, inside 2026-11-17T14:05Z..2026-11-19T00:00Z) ->
  fresh output paths -> env file (private regular file, parsed, never sourced; SUPABASE_DB_URL only) -> per-packet
  lock (O_EXCL, never removed) -> ONE connection -> capture core -> close -> offline export (node, PATH-only env).
No retries anywhere. A second run for the same native packet refuses on its lock.

Value-free preflight (T-1 and again just before the read; no conversion, env file, lock or connection):
    /usr/bin/env -i PATH=/usr/bin:/bin /opt/anaconda3/bin/python3 -I -B -X pycache_prefix=/var/empty <this file> \
        --preflight --scope-sha <sha>

Custody residual (not verifiable from inside this process; RUNBOOK "Custody"): the stdlib source and lib-dynload under
/opt/anaconda3 (owned by the user, not root), the libcrypto hashlib uses to compute the pins, and the .pth start-up hooks
that run under -I before line 1 (their modules are recorded as startupNonStdlibModules).
"""
import sys

STARTUP_MODULES = frozenset(sys.modules)  # taken before any import of ours; modules loaded later are origin-checked
EXPECTED_PYTHON = "/opt/anaconda3/bin/python3.13"  # realpath of /opt/anaconda3/bin/python3 (only interpreter with psycopg2)
PYCACHE_PREFIX = "/var/empty"                      # root-owned and empty: every module compiles from its source
if __name__ == "__main__":
    import os as _os
    if not sys.flags.isolated or not sys.flags.dont_write_bytecode or _os.path.realpath(sys.executable) != EXPECTED_PYTHON:
        sys.stdout.write('{"code": "not_isolated_or_unexpected_interpreter", "reader": "refuse"}\n')
        sys.exit(2)
    _st = _os.stat(PYCACHE_PREFIX)
    if sys.pycache_prefix != PYCACHE_PREFIX or _st.st_uid != 0 or _os.listdir(PYCACHE_PREFIX):
        sys.stdout.write('{"code": "bytecode_cache_not_disabled", "reader": "refuse"}\n')
        sys.exit(2)

import asyncio
import datetime as dt
import errno
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import time

ROOT = Path(__file__).resolve().parent
REPO = Path('/Users/tim/Code/fhfhockey.com')
ENV_FILE = REPO / 'web/.env.local'
NODE = '/usr/local/bin/node'
LOCK_DIR = ROOT / 'locks'
SCOPE = ROOT / 'LIVE-READ-SCOPE.json'
TESTS_RECEIPT = ROOT / 'TESTS-RECEIPT.json'
NATIVE_DATE = '2026-11-11'
UTC = dt.timezone.utc
WINDOW_OPEN = dt.datetime(2026, 11, 17, 14, 5, 0, tzinfo=UTC)    # the earliest native capture slot
WINDOW_CLOSE = dt.datetime(2026, 11, 19, 0, 0, 0, tzinfo=UTC)    # covers the 11-18 fallback slot; event age <= 7 d
MAX_HOURS_AFTER_EARLIEST_NATIVE = 12                              # leaves >= 12 h of the 24 h for frames, review, install
ENV_ALLOWED = {'PATH', 'LC_CTYPE'}                                 # LC_CTYPE: Python's own PEP 538 coercion under env -i
LOCAL_PINNED = ('capture_reader.py', 'read_only_session.py', 'run_live_read.py', 'export_context.cjs',
                'production_context.cjs', 'COLUMNS.json')
PINNED_ROOT = '/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-request-reader-20261111'
STDLIB = '/opt/anaconda3/lib/python3.13/'
PSYCOPG2_TREE = STDLIB + 'site-packages/psycopg2/'
# The bridge's approved candidate sets (convert.mjs CANDIDATES, 2026-11-15), re-derived here rather than taking the
# conversion's evidenceClass as written (RECHECK-11 A3). The candidate is explicit on the CLI, never inferred.
_V5 = {'verifierSHA256': 'b86af692e5c4b3b9b1650f949171cbbaeed6663c6d1668efdc443e91fa0ad5c5',
       'nodeSHA256': 'daa77e22e1b8778361b392461e9921a6d292d0382ebf4ae872a0081f02f01fef',
       'lineageSHA256': '14e0816c65fd8988b1401e21952b0873fcb142da6866523f6c87d8f1b72ff4da'}
CANDIDATES = {
    'v5': {**_V5, 'pinsSHA256': 'a2a1e694dfa79ba9ebc110a3e45a249540b739c0061e0558fc6887e0f30367d1', 'packet': 'fhfh-blsh-native-20261117T140500Z'},
    'v5-1118': {**_V5, 'pinsSHA256': '3f61f9d4725fb66efc3d0f2f201e74c46998d67856b84f9c9c7230357b866376',
                'packet': 'fhfh-blsh-native-20261118T140500Z'},
}


class Refuse(Exception):
    pass


def sha_bytes(b):
    return hashlib.sha256(b).hexdigest()


def sha_file(p):
    with open(p, 'rb') as h:
        return sha_bytes(h.read())


def tree_sha(directory):
    """sha256 over sorted 'relpath\\0sha256\\n' lines of every regular file, __pycache__ excluded."""
    lines = []
    for base, dirs, files in os.walk(directory):
        dirs[:] = sorted(d for d in dirs if d != '__pycache__')
        for name in sorted(files):
            full = os.path.join(base, name)
            if os.path.islink(full):
                raise Refuse('runtime_tree_symlink')
            lines.append('%s\0%s\n' % (os.path.relpath(full, directory), sha_file(full)))
    return sha_bytes(''.join(sorted(lines)).encode())


def utc_now():
    return dt.datetime.now(UTC)


def stamp(value):
    if not isinstance(value, str):
        raise Refuse('invalid_clock')
    t = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if t.tzinfo is None:
        raise Refuse('invalid_clock')
    return t.astimezone(UTC)


def check_own_env(env):
    bad = sorted(k for k in env if k not in ENV_ALLOWED)
    if bad:
        # Key names only (never values); DYLD_*/PG*/SSL*/PYTHON* all land here.
        raise Refuse('env_key_not_allowed:' + ','.join(bad))


def check_pins(scope_sha, *, scope_path=SCOPE, root=ROOT):
    if sha_file(scope_path) != scope_sha:
        raise Refuse('scope_sha_mismatch')
    scope = json.loads(Path(scope_path).read_text())
    for name in LOCAL_PINNED:
        if sha_file(root / name) != scope['pins']['local'][name]:
            raise Refuse('local_pin_drift:' + name)
    ext = scope['pins']['external']
    for key, entry in ext.items():
        actual = tree_sha(entry['path']) if entry.get('kind') == 'tree' else sha_file(entry['path'])
        if actual != entry['sha256']:
            raise Refuse('external_pin_drift:' + key)
    return scope


def check_tests_receipt(scope, receipt_path=TESTS_RECEIPT):
    try:
        r = json.loads(Path(receipt_path).read_text())
    except (OSError, ValueError):
        raise Refuse('tests_receipt_missing')
    if sha_file(receipt_path) != scope['testsReceiptSHA256']:
        raise Refuse('tests_receipt_not_pinned')
    if not (r.get('failed') == 0 and r.get('passed', 0) > 0 and r.get('pins') == scope['pins']['local']):
        raise Refuse('tests_receipt_not_green_for_these_pins')


def check_no_libpq_client_dir(home=None):
    """libpq sends ~/.postgresql/postgresql.crt (and reads its key/root files) by default; none may exist."""
    import pwd
    home = home or pwd.getpwuid(os.getuid()).pw_dir
    if os.path.lexists(os.path.join(home, '.postgresql')):
        raise Refuse('libpq_client_dir_present')


def load_conversion(directory, candidate, candidates=CANDIDATES):
    """Same completion check as assemble.mjs loadCompleted; the approval is re-derived from the explicit candidate's
    pinned pins/verifier/node/lineage hashes (as assemble.mjs does), never taken from evidenceClass alone."""
    if candidate not in candidates:
        raise Refuse('candidate_unknown')
    approved = candidates[candidate]
    d = Path(directory)
    if not d.is_absolute() or not d.is_dir() or d.is_symlink():
        raise Refuse('conversion_dir_invalid')
    manifest = json.loads((d / 'MANIFEST.json').read_bytes())
    files = {}
    for f in manifest['files']:
        b = (d / f['file']).read_bytes()
        if sha_bytes(b) != f['sha256'] or len(b) != f['bytes']:
            raise Refuse('conversion_hash_drift')
        files[f['file']] = b
    if any(n != 'MANIFEST.json' and n not in files for n in os.listdir(d)):
        raise Refuse('conversion_unlisted_file')
    conv = json.loads(files['CONVERSION.json'])
    if conv.get('evidenceClass') != 'candidate_pending_independent_review' or conv.get('approvedInputs') is not True:
        raise Refuse('conversion_not_candidate')
    if any(conv.get(k) != approved[k] for k in ('pinsSHA256', 'verifierSHA256', 'nodeSHA256', 'lineageSHA256')):
        raise Refuse('conversion_not_approved_for_candidate')
    if conv.get('packet') != approved['packet']:
        raise Refuse('conversion_packet_not_candidate_slot')
    if conv.get('date') != NATIVE_DATE:
        raise Refuse('conversion_date_not_20261111')
    natives = [stamp(json.loads(files['receipt-%s.json' % g])['retrievedAtUTC']) for g in ('individual', 'onIce')]
    return conv, natives


def load_pinned_module(name, pin, root=ROOT):
    """Execute the module from the exact bytes just hashed: no sys.path search, no .pyc, no finder. A module already
    imported (offline tests only) must come from the same file and that file must still hash to the pin."""
    import types
    path = os.path.join(str(root), name + '.py')
    with open(path, 'rb') as h:
        source = h.read()
    if sha_bytes(source) != pin:
        raise Refuse('module_source_not_pinned:' + name)
    existing = sys.modules.get(name)
    if existing is not None:
        if os.path.realpath(getattr(existing, '__file__', '') or '') != os.path.realpath(path):
            raise Refuse('module_origin_not_pinned:' + name)
        return existing
    module = types.ModuleType(name)
    module.__file__ = path
    sys.modules[name] = module
    try:
        exec(compile(source, path, 'exec'), module.__dict__)
    except BaseException:
        sys.modules.pop(name, None)
        raise
    return module


def check_import_origins(modules, startup, root=PINNED_ROOT):
    """Every module loaded since start-up comes from the stdlib (not site-packages), the pinned psycopg2 tree or one of
    the two pinned reader files; psycopg2 and its C extension come from the pinned tree. Returns the start-up
    (custody) modules that are not stdlib, for the record."""
    pinned = {os.path.join(root, n) for n in ('capture_reader.py', 'read_only_session.py')}
    def origin(m):
        f = getattr(m, '__file__', None)
        return os.path.realpath(f) if f else None
    def allowed(f):
        return f in pinned or f.startswith(PSYCOPG2_TREE) or (f.startswith(STDLIB) and not f.startswith(STDLIB + 'site-packages/'))
    for name, m in sorted(modules.items()):
        if name in startup or m is None:
            continue
        f = origin(m)
        if f is not None and not allowed(f):
            raise Refuse('module_origin_not_pinned:' + name)
    for name, want in (('capture_reader', os.path.join(root, 'capture_reader.py')),
                       ('read_only_session', os.path.join(root, 'read_only_session.py'))):
        if name not in modules or origin(modules[name]) != want:
            raise Refuse('module_origin_not_pinned:' + name)
    for name in ('psycopg2', 'psycopg2._psycopg'):
        f = origin(modules.get(name)) if modules.get(name) is not None else None
        if not f or not f.startswith(PSYCOPG2_TREE):
            raise Refuse('psycopg2_origin_not_pinned_tree:' + name)
    return sorted(n for n in startup if modules.get(n) is not None and origin(modules[n])
                  and not (origin(modules[n]).startswith(STDLIB) and not origin(modules[n]).startswith(STDLIB + 'site-packages/')))


def load_and_check_modules(scope, startup):
    c = load_pinned_module('capture_reader', scope['pins']['local']['capture_reader.py'])
    ros = load_pinned_module('read_only_session', scope['pins']['local']['read_only_session.py'])
    custody = check_import_origins(dict(sys.modules), startup)
    return c, ros, custody


def check_window(now, natives):
    if not (WINDOW_OPEN <= now < WINDOW_CLOSE):
        raise Refuse('outside_read_window')
    if now < max(natives):
        raise Refuse('read_before_native_capture')
    if now - min(natives) > dt.timedelta(hours=MAX_HOURS_AFTER_EARLIEST_NATIVE):
        raise Refuse('read_too_late_after_native_capture')


def take_packet_lock(lock_dir, packet, now):
    lock_dir.mkdir(mode=0o700, exist_ok=True)
    path = lock_dir / (packet + '.lock')
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except FileExistsError:
        raise Refuse('packet_lock_exists_no_second_read')
    with os.fdopen(fd, 'w') as h:
        h.write(json.dumps({'pid': os.getpid(), 'takenAtUTC': now.isoformat()}) + '\n')


def read_private_env_file(path):
    """Operator-lane pattern: open without following a symlink, fstat the same descriptor (regular, own uid, no
    group/other bits), parse, never source, never echo."""
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    except OSError as error:
        raise Refuse('env_file_not_private_regular_file' if error.errno == errno.ELOOP else 'env_file_unreadable')
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode) or st.st_uid != os.getuid() or st.st_mode & 0o077:
            raise Refuse('env_file_not_private_regular_file')
        with os.fdopen(fd, encoding='utf-8') as handle:
            fd = None
            text = handle.read()
    finally:
        if fd is not None:
            os.close(fd)
    values = []
    for line in text.split('\n'):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        if line.startswith('export '):
            line = line[len('export '):].lstrip()
        key, value = line.split('=', 1)
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in '"\'':
            value = value[1:-1]
        if key == 'SUPABASE_DB_URL':
            values.append(value)
    if len(values) != 1:
        raise Refuse('SUPABASE_DB_URL_missing_or_duplicate')
    if not values[0] or any(ch.isspace() for ch in values[0]) or values[0][:1] in '"\'':
        raise Refuse('SUPABASE_DB_URL_shape_suspect')
    return values[0]


def default_export(args, summary_out):
    out = subprocess.run([NODE, str(ROOT / 'export_context.cjs'), '--capture', str(Path(args['out']) / 'capture'),
                          '--conversion', args['conversion'], '--request-out', args['request-out'],
                          '--context-out', args['context-out'], '--summary-out', str(summary_out)],
                         env={'PATH': '/usr/bin:/bin'}, capture_output=True, text=True, timeout=180, cwd=str(ROOT))
    try:
        return json.loads(out.stdout.strip().split('\n')[-1])
    except (ValueError, IndexError):
        return {'ok': False, 'refusal': 'export_output_unparsed'}


def run(args, *, own_env, now=utc_now, env_file=ENV_FILE, lock_dir=LOCK_DIR, opener=None,
        export=default_export, scope_path=SCOPE, tests_receipt=TESTS_RECEIPT, startup_modules=STARTUP_MODULES,
        candidates=CANDIDATES, log):
    """All gates, one attempt. Keyword seams exist only for the offline tests; main() fixes them."""
    check_own_env(own_env)
    if os.path.realpath(str(ROOT)) != PINNED_ROOT:
        raise Refuse('reader_root_not_pinned')  # a copied folder (with planted modules) never runs
    if args.get('preflight') is True:
        # Value-free T-1 check: pins, test receipt, module origins, libpq client-cert dir, packet locks.
        # No conversion, env file or connection.
        if set(args) != {'preflight', 'scope-sha'}:
            raise Refuse('usage')
        scope = check_pins(args['scope-sha'], scope_path=scope_path)
        check_tests_receipt(scope, tests_receipt)
        _, _, custody = load_and_check_modules(scope, startup_modules)
        check_no_libpq_client_dir()
        log({'reader': 'preflight_ok', 'scopeSHA256': args['scope-sha'], 'packetLocks': sorted(p.name for p in lock_dir.glob('*.lock')),
             'pycachePrefix': sys.pycache_prefix, 'startupNonStdlibModules': custody})
        return 0
    for key in ('conversion', 'out', 'request-out', 'context-out'):
        if not args.get(key) or not os.path.isabs(args[key]):
            raise Refuse('usage')
    if args.get('execute-read-only') is not True:
        raise Refuse('explicit_execute_flag_required')
    if not args.get('candidate'):
        raise Refuse('candidate_required')
    scope = check_pins(args.get('scope-sha'), scope_path=scope_path)
    check_tests_receipt(scope, tests_receipt)
    # Never via sys.path (-I already drops the script dir): executed from the hashed source bytes, then origin-checked.
    c, ros, custody = load_and_check_modules(scope, startup_modules)
    check_no_libpq_client_dir()
    conv, natives = load_conversion(args['conversion'], args['candidate'], candidates)
    t = now()
    check_window(t, natives)
    out = Path(args['out'])
    for p in (out, Path(args['request-out']), Path(args['context-out'])):
        if p.exists():
            raise Refuse('output_exists_no_retry')
    if not out.parent.is_dir():
        raise Refuse('output_parent_missing')
    # No /private/tmp/fhfh-heavy.lock: that mkdir convention serialises heavy LOCAL jobs (tsc heaps, npm ci); this read is
    # ~5 s / ~2 MB, and a stale or long-held lock must not block a time-critical single attempt.
    dsn = read_private_env_file(env_file)  # an env-file refusal leaves the packet lock untaken
    take_packet_lock(lock_dir, conv['packet'], t)
    report = {'state': 'NOT_DISPATCHED', 'scopeSHA256': args['scope-sha'], 'wrapperSHA256': sha_file(ROOT / 'run_live_read.py'),
              'conversionPacket': conv['packet'], 'nativeRetrievedAtUTC': sorted(n.isoformat() for n in natives),
              'candidate': args['candidate'], 'startupNonStdlibModules': custody, 'pycachePrefix': sys.pycache_prefix,
              'databaseWrites': 0, 'providerRequests': 0, 'automaticRetries': 0, 'connectionAttempts': 0, 'sessionClosed': False}
    started = time.monotonic()
    session = None
    try:
        out.mkdir(mode=0o700)
        if opener is None:
            opener, HOST, PROJECT = ros.open_existing_read_only, ros.HOST, ros.PROJECT
        else:
            HOST, PROJECT = 'offline-test-host', 'offline-test-project'
        with (out / 'CONNECTION-DISPATCH.json').open('x') as h:
            h.write(json.dumps({'atUTC': c.utc_now(), 'project': PROJECT, 'host': HOST, 'TLS': 'verify-full',
                                'readOnly': True, 'scopeSHA256': args['scope-sha']}) + '\n')

        async def collect():
            nonlocal session
            report['connectionAttempts'] = 1
            try:
                session = await asyncio.wait_for(opener(dsn), 4)
                report['connectionOpened'] = True
                result = await c.capture(session, out / 'capture', c.DATE_MAX)
                report.update(state=result['state'], captureResultSHA256=sha_file(out / 'capture/RESULT.json'),
                              queriesDispatched=result['queriesDispatched'], rows=result.get('rows'),
                              sourceBytes=result['sourceBytes'], asOfUTC=result.get('asOfUTC'),
                              eventThroughDate=result.get('eventThroughDate'), failedStage=result.get('failedStage'),
                              errorCode=result.get('errorCode'), sessionClosed=result['sessionClosed'],
                              uncertainDispatch=result.get('uncertainDispatch'))
            except BaseException as error:
                report.update(state='CONNECTION_OR_WRAPPER_STOPPED_NO_RETRY', errorType=type(error).__name__,
                              errorCode=str(error) if isinstance(error, c.CaptureError) else getattr(error, 'pgcode', None))
            finally:
                raw = getattr(session, 'raw', None)
                if raw is not None and not raw.closed:
                    raw.close()
                report['sessionClosed'] = session is None or bool(getattr(getattr(session, 'raw', None), 'closed', report['sessionClosed']))
        asyncio.run(collect())
        del dsn
    finally:
        report.update(finishedAtUTC=c.utc_now(), elapsedSeconds=time.monotonic() - started)
    if report['state'] == 'CAPTURED_READ_ONLY_UNQUALIFIED':
        report['export'] = export(args, out / 'EXPORT-SUMMARY.json')
        report['state'] = 'REQUEST_AND_CONTEXT_EXPORTED' if report['export'].get('ok') is True else 'CAPTURED_EXPORT_REFUSED'
    with (out / 'RESULT.json').open('x') as h:
        h.write(json.dumps(report, indent=2) + '\n')
    log({k: report.get(k) for k in ('state', 'queriesDispatched', 'rows', 'sourceBytes', 'asOfUTC', 'eventThroughDate',
                                     'failedStage', 'errorCode', 'sessionClosed', 'export')})
    return 0 if report['state'] == 'REQUEST_AND_CONTEXT_EXPORTED' else 1


def parse_args(argv):
    args, i = {}, 0
    while i < len(argv):
        a = argv[i]
        if a in ('--execute-read-only', '--preflight'):
            if a[2:] in args:
                raise Refuse('usage')
            args[a[2:]] = True; i += 1
        elif a in ('--scope-sha', '--candidate', '--conversion', '--out', '--request-out', '--context-out') and i + 1 < len(argv):
            if a[2:] in args:
                raise Refuse('usage')
            args[a[2:]] = argv[i + 1]; i += 2
        else:
            raise Refuse('usage')
    return args


def main(argv):
    def log(obj):
        sys.stdout.write(json.dumps(obj, sort_keys=True) + '\n'); sys.stdout.flush()
    try:
        return run(parse_args(argv), own_env=dict(os.environ), log=log)
    except Refuse as refusal:
        log({'reader': 'refuse', 'code': str(refusal)}); return 2
    except Exception as error:  # never a traceback: it could carry a value
        log({'reader': 'refuse', 'code': 'unexpected_' + type(error).__name__}); return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
