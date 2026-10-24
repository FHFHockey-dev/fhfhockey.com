#!/bin/zsh
# Usage: unity.sh <receipt-name> <executeMethod> [quit]  — bounded batch Unity run on the isolated Q2 project only.
Q=/Users/tim/Code/fhfhockey.com/tasks/artifacts/cross-platform/2026-10-24-coordination/handoffs/Q2
P=/Users/tim/Documents/Codex/2026-10-11/task-12/Resume20261023B/V12ValidationProject
if pgrep -f "Unity.app/Contents/MacOS/Unity" >/dev/null; then echo "Unity already running; refusing"; exit 3; fi
extra=()
[[ "$3" == "quit" ]] && extra=(-quit)
exec python3 -I $Q/v17/tools/run_bounded.py --name "$1" --cwd "$P" --timeout 600 -- /usr/bin/nice -n 15 /Applications/Unity/Hub/Editor/6000.6.5f1/Unity.app/Contents/MacOS/Unity -batchmode $extra -job-worker-count 2 -projectPath "$P" -executeMethod "$2" -logFile "$Q/v17/evidence/$1.log"
