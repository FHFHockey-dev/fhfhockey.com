#!/bin/bash
# one.sh <label> <base> <path> <cap_s>  — exactly one request; prints status/time/bytes/cache.
label=$1; url="$2$3"; cap=$4
r=$(curl -s -o out/$label.json -D out/$label.hdr -m $cap -w '%{http_code} %{time_total} %{size_download}' "$url")
c=$(grep -i '^x-vercel-cache' out/$label.hdr | tr -d '\r')
echo "$(date -u +%FT%TZ) $label $r [$c] $3" | tee -a out/timings.log
