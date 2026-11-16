#!/bin/zsh
# RECHECK-11 A1: what the reader's pins do not bind. Scratch only; never touches anaconda, the reader folder or the DB.
#   zsh reader-interpreter-probe.sh <new scratch dir>
set -u; S=${1:?scratch}; mkdir -p $S/pyc; cd $S/pyc
PY=(/usr/bin/env -i PATH=/usr/bin:/bin /opt/anaconda3/bin/python3 -I)
print 'X = '"'"'pinned-source'"'" > m.py
$PY -c "import sys; sys.path.insert(0,'$S/pyc'); import m"             # leaves a normal pyc
$PY -c "
import importlib._bootstrap_external as b, os
st=os.stat('$S/pyc/m.py'); code=compile(\"X = 'TAMPERED-pyc'\n\",'$S/pyc/m.py','exec')
open('$S/pyc/__pycache__/m.cpython-313.pyc','wb').write(b._code_to_timestamp_pyc(code,int(st.st_mtime),st.st_size))"
print -r -- "source sha256: $(shasum -a 256 m.py | cut -c1-12)"
$PY -B -c "import sys; sys.path.insert(0,'$S/pyc'); import m; print('-I -B loads:', m.X)"
$PY -B -X pycache_prefix=$S/empty -c "import sys; sys.path.insert(0,'$S/pyc'); import m; print('-I -B -X pycache_prefix loads:', m.X)"
# .pth startup hooks run under -I before the script's first line:
$PY -B -c "import sys; print('.pth hook ran under -I:', '_distutils_hack' in sys.modules)"
ls /opt/anaconda3/lib/python3.13/site-packages/psycopg2/__pycache__ | wc -l | sed 's/^ */psycopg2 pyc files (excluded from the tree pin): /'
stat -f 'anaconda owner: %Su' /opt/anaconda3/lib/python3.13
# End to end against the reader's own pin: copy psycopg2 to scratch, plant a pyc for __init__, recompute tree_sha.
mkdir -p $S/site && cp -Rp /opt/anaconda3/lib/python3.13/site-packages/psycopg2 $S/site/
$PY -c "
import importlib._bootstrap_external as b, os
src='$S/site/psycopg2/__init__.py'; st=os.stat(src)
code=compile(open(src).read()+'\nprint(\"TAMPERED psycopg2 pyc ran\")\n', src, 'exec')
open('$S/site/psycopg2/__pycache__/__init__.cpython-313.pyc','wb').write(b._code_to_timestamp_pyc(code,int(st.st_mtime),st.st_size))"
$PY -B -c "
import sys; sys.path.insert(0,'/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-request-reader-20261111')
import run_live_read as w; print('tree_sha(copy with planted pyc):', w.tree_sha('$S/site/psycopg2')[:12], '(scope pin d4f938139870)')"
$PY -B -c "import sys; sys.path.insert(0,'$S/site'); import psycopg2; print('imported from', psycopg2.__file__)"
# Candidate fix: a root-owned, empty pycache prefix; every module then compiles from its (hashed) source.
$PY -B -X pycache_prefix=/var/empty -c "import sys; sys.path.insert(0,'$S/site'); import psycopg2; print('with -X pycache_prefix=/var/empty: no tamper line above; prefix', sys.pycache_prefix)"
# Shadowing: an unlisted psycopg2.py in a scratch copy of the reader folder passes --preflight and wins the import.
cp -Rp /Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-request-reader-20261111 $S/reader-copy
printf 'print("PLANTED psycopg2.py in the reader folder ran")\nraise SystemExit(0)\n' > $S/reader-copy/psycopg2.py
$PY -B $S/reader-copy/run_live_read.py --preflight --scope-sha c731a79f0b8052950a50a69e30e71e9fc5d1b76fc5a29be5822648a65ffc617b
$PY -B -X pycache_prefix=/var/empty -c "import sys; sys.path.insert(0,'$S/reader-copy'); import read_only_session"
# Which bytes run today (reads only):
$PY -B -v -c "import psycopg2" 2>&1 | grep -m1 "code object from '/opt/anaconda3/lib/python3.13/site-packages/psycopg2/__pycache__"
