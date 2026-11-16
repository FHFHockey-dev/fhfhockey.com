#!/bin/zsh
# RECHECK-8 shell probes (offline; writes only under <scratch>; never runs the launcher in its window or with credentials).
# Usage: zsh shell-probes.sh <scratch>
setopt nonomatch; S=$1; mkdir -p $S/fake/usr/bin $S/inj; LA=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools/nst-pilot-launcher.py
# 1. DEVELOPER_DIR redirects the /usr/bin/python3 stub (xcode-select shim) to an arbitrary xcrun/interpreter.
for b in python3 xcrun; do printf '#!/bin/sh\necho ran > %s/MARKER-%s\necho "FAKE %s"\n' $S $b $b > $S/fake/usr/bin/$b; chmod 755 $S/fake/usr/bin/$b; done
rm -f $S/MARKER-*; echo "DEVELOPER_DIR=fake /usr/bin/python3 -I -c: $(DEVELOPER_DIR=$S/fake /usr/bin/python3 -I -c 'print("real")' 2>&1 | head -1); markers=$(ls $S | grep -c MARKER)"
rm -f $S/MARKER-*; echo "env -i PATH=... /usr/bin/python3 -I -c (outer DEVELOPER_DIR set): $(DEVELOPER_DIR=$S/fake /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I -c 'import sys;print("real", sys.executable)' 2>&1); markers=$(ls $S | grep -c MARKER)"
# 2. Without -I, PYTHONPATH injection runs before any launcher gate (real clock: outside the window, refuses anyway).
printf 'open("%s/MARKER-inj","w").write("ran")\nraise ImportError("probe")\n' $S > $S/inj/hashlib.py; echo "{}" > $S/r.json; chmod 600 $S/r.json
rm -f $S/MARKER-*; env -i PATH=/usr/bin:/bin PYTHONPATH=$S/inj /usr/bin/python3 $LA --run $S/r.json >/dev/null 2>&1; echo "no -I + PYTHONPATH: markers=$(ls $S | grep -c MARKER)"
rm -f $S/MARKER-*; echo "with -I: $(env -i PATH=/usr/bin:/bin PYTHONPATH=$S/inj /usr/bin/python3 -I $LA --run $S/r.json 2>&1 | tail -1); markers=$(ls $S | grep -c MARKER)"
# 3. Which shell-side checks can see a DYLD_* key.
export DYLD_FOO=1
echo "export -p: $(export -p | grep -c DYLD_)  /usr/bin/env: $(/usr/bin/env | grep -c DYLD_)  printenv: $(/usr/bin/printenv | grep -c DYLD_)  stub python: $(/usr/bin/python3 -I -c 'import os;print(sum(k.startswith("DYLD_") for k in os.environ))')"
unset DYLD_FOO
