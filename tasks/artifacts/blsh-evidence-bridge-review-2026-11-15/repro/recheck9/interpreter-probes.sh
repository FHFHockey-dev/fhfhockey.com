#!/bin/zsh
# RECHECK-9 interpreter probes against the REAL launcher 31c370c3 (real clock: 2026-11-15, so every run that passes the
# interpreter gates refuses outside_start_window before any lock or env-file access). Writes only under <scratch>.
# The documented §1a line is used verbatim except that the output goes to <scratch>/launcher.log, not attestation/.
setopt nonomatch; S=$1; mkdir -p $S/fake/usr/bin $S/inj $S/sitec; LA=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/nst-pilot-launcher.py
echo "{}" > $S/r.json; chmod 600 $S/r.json
for b in python3 xcrun; do printf '#!/bin/sh\necho ran > %s/MARKER-%s\n' $S $b > $S/fake/usr/bin/$b; chmod 755 $S/fake/usr/bin/$b; done
printf 'open("%s/MARKER-hashlib","w").write("ran")\nraise ImportError("probe")\n' $S > $S/inj/hashlib.py
printf 'open("%s/MARKER-sitecustomize","w").write("ran")\n' $S > $S/sitec/sitecustomize.py
m() { n=$(ls $S | grep -c MARKER); rm -f $S/MARKER-*; echo "markers=$n"; }
# (a) exact documented line, contaminated outer shell (DEVELOPER_DIR + DYLD_* + PYTHONPATH exported)
export DEVELOPER_DIR=$S/fake DYLD_FOO=1 PYTHONPATH=$S/inj
/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I $LA --run $S/r.json > $S/launcher.log 2>&1; echo "a) documented line, dirty shell: $(cat $S/launcher.log) $(m)"
echo "   same without the env -i prefix: $(/usr/bin/python3 -I $LA --run $S/r.json 2>&1 | head -1) $(m)"
unset DEVELOPER_DIR DYLD_FOO PYTHONPATH
# (b) isolation and interpreter pin
echo "b1) no -I, PYTHONPATH hashlib.py: $(/usr/bin/env -i PATH=/usr/bin:/bin PYTHONPATH=$S/inj /usr/bin/python3 $LA --run $S/r.json 2>&1 | tail -1) $(m)"
echo "b2) no -I, PYTHONPATH sitecustomize.py: $(/usr/bin/env -i PATH=/usr/bin:/bin PYTHONPATH=$S/sitec /usr/bin/python3 $LA --run $S/r.json 2>&1 | tail -1) $(m)"
echo "b3) -I, PYTHONPATH sitecustomize.py: $(/usr/bin/env -i PATH=/usr/bin:/bin PYTHONPATH=$S/sitec /usr/bin/python3 -I $LA --run $S/r.json 2>&1 | tail -1) $(m)"
for P in /opt/anaconda3/bin/python3 /usr/local/bin/python3 /opt/homebrew/bin/python3; do [ -x $P ] && echo "b4) other interpreter $P -I: $(/usr/bin/env -i PATH=/usr/bin:/bin $P -I $LA --run $S/r.json 2>&1 | tail -1)"; done
echo "b5) CLT python directly (not the stub) -I with DYLD_FOO: $(/usr/bin/env -i PATH=/usr/bin:/bin DYLD_FOO=1 /Library/Developer/CommandLineTools/usr/bin/python3 -I $LA --run $S/r.json 2>&1 | tail -1)"
echo "b6) documented line, clean: $(/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I $LA --run $S/r.json 2>&1 | tail -1)"
echo "b7) T-1 interpreter check: $(/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I -c 'import sys; print(sys.executable)')"
