import sys, types, json, importlib.util
START = frozenset(sys.modules)
RD = '/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-request-reader-20261111'
spec = importlib.util.spec_from_file_location('rlr', RD + '/run_live_read.py'); w = importlib.util.module_from_spec(spec); spec.loader.exec_module(w)
scope = json.load(open(RD + '/LIVE-READ-SCOPE.json'))
c, ros, custody = w.load_and_check_modules(scope, START | {'rlr'})
print('real load: ok; psycopg2 from', sys.modules['psycopg2'].__file__)
def fake(name, f):
    m = types.ModuleType(name); m.__file__ = f; return m
base = dict(sys.modules)
cases = {
  'site-packages other module': {'evilmod': fake('evilmod', '/opt/anaconda3/lib/python3.13/site-packages/six.py')},
  'unpinned file in reader folder': {'make_scope': fake('make_scope', RD + '/make_scope.py')},
  'psycopg2 from elsewhere': {'psycopg2': fake('psycopg2', '/tmp/psycopg2/__init__.py')},
  'capture_reader from a copy': {'capture_reader': fake('capture_reader', '/tmp/copy/capture_reader.py')},
}
for label, extra in cases.items():
    mods = {**base, **extra}
    try: w.check_import_origins(mods, START | {'rlr'}); print(label, '-> ACCEPTED')
    except w.Refuse as r: print(label, '->', r)
# a tampered source refuses before execution
import os
try: w.load_pinned_module('capture_reader', '0'*64); print('bad pin -> loaded?!')
except w.Refuse as r: print('bad pin ->', r)
