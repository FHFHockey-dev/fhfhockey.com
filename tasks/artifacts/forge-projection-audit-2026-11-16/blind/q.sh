#!/bin/zsh
# usage: q.sh "sql" [maxcols]  -> CSV; saves query and output under blind/sql/NN.{sql,csv}
D=/Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-11-16/blind/sql
n=$(( $(ls $D/*.sql 2>/dev/null | wc -l) + 20 ))
f=$D/$(printf '%03d' $n)
print -r -- "$1" > $f.sql
print -r -- "$1" | RO_SQL_CSV=1 python3 -I /Users/tim/Code/fhfhockey.com/tasks/artifacts/forge-projection-audit-2026-11-16/ro_sql.py > $f.csv 2>&1
echo "[$f]"; cut -c1-${2:-3000} $f.csv
