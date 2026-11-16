#!/bin/bash
# Usage: run.sh <label> <path?query>  — one sequential request to the isolated local server (prod DB, read-only reader).
label=$1; url="http://localhost:3110$2"
out=resp-$label.json
w=$(curl -s -o "$out" -m 30 -w '%{http_code} %{time_total} %{size_download}' "$url")
echo "$(date -u +%FT%TZ) $label $w $2" | tee -a timings.log
