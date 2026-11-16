#!/bin/zsh
# R7: the RECHECK-11 B1 slot-date guards, with the date faked. Extracts each guard as written and evaluates it; runs nothing else.
O=/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/tools
for d in 2026-11-16 2026-11-17 2026-11-18 2026-11-19; do
  sh_guard=$(sed -n 4p $O/dress-rehearsal.sh | sed "s#\$(/bin/date -u +%Y-%m-%d)#$d#")
  r1=$(zsh -c "$sh_guard; print -r -- run" 2>&1 | tail -1)
  r2=$(/usr/bin/python3 -I - "$O/test-nst-pilot-launcher.py" "$d" <<'PY'
import sys, datetime, types
src = open(sys.argv[1]).read().split("import hashlib", 1)[0]      # only the guard prelude
fake = types.SimpleNamespace(datetime=types.SimpleNamespace(now=lambda tz: datetime.datetime.fromisoformat(sys.argv[2] + "T12:00:00+00:00")), timezone=datetime.timezone)
src = src.replace("import datetime as _guard_dt, sys as _guard_sys", "import sys as _guard_sys")
try:
    exec(compile(src, "guard", "exec"), {"_guard_dt": fake, "__name__": "guard"}); print("run")
except SystemExit as e: print("exit", e.code)
PY
)
  print -r -- "$d  rehearsal: $r1 | suite: $(print -r -- $r2 | tail -1)"
done
