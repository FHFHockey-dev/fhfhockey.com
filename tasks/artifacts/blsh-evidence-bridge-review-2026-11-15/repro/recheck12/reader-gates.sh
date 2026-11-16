#!/bin/zsh
# RECHECK-12 A1: the reader's new gates. Reads only; scratch writes only. Never --execute-read-only.
#   zsh reader-gates.sh <new scratch dir>
set -u; S=${1:?scratch}; mkdir -p $S; RD=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-request-reader-20261111
SC=$(shasum -a 256 $RD/LIVE-READ-SCOPE.json | cut -d' ' -f1); E=(/usr/bin/env -i PATH=/usr/bin:/bin /opt/anaconda3/bin/python3 -I -B)
print "1 documented preflight:"; $E -X pycache_prefix=/var/empty $RD/run_live_read.py --preflight --scope-sha $SC
print "2 no prefix:"; $E $RD/run_live_read.py --preflight --scope-sha $SC
print "3 another empty prefix:"; mkdir -p $S/emptydir; $E -X pycache_prefix=$S/emptydir $RD/run_live_read.py --preflight --scope-sha $SC
print "4 copied folder + planted psycopg2.py:"; cp -Rp $RD $S/copy; printf 'open("%s/PLANT-RAN","w").write("x")\n' $S > $S/copy/psycopg2.py
$E -X pycache_prefix=/var/empty $S/copy/run_live_read.py --preflight --scope-sha $SC; print "plant ran: $([[ -e $S/PLANT-RAN ]] && print yes || print no)"
print "5 script dir on sys.path under -I:"; mkdir -p $S/sp; printf 'import sys; print(any(p.rstrip("/")=="%s/sp" for p in sys.path))\n' $S > $S/sp/x.py; $E -X pycache_prefix=/var/empty $S/sp/x.py
print "6 origin check with injected modules:"; $E -X pycache_prefix=/var/empty ${0:A:h}/origin_probe.py
