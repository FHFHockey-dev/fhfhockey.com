"""Approximate deployed serverless-function size per route from Next's output file traces.

Usage (after an isolated compile build, see ../BASELINE.md):
    python3 -I function_traces.py /Users/tim/Code/fhfhockey.com/web/.next-playwright/server

Sums on-disk bytes of every file listed in each `*.js.nft.json` and flags any traced
file under tasks/, docs/, output/ or web/scripts/output/.
"""
import collections
import json
import os
import statistics
import sys

root = sys.argv[1]
sizes = {}


def size(path):
    if path not in sizes:
        try:
            sizes[path] = os.path.getsize(path)
        except OSError:
            sizes[path] = 0
    return sizes[path]


rows = []
for dirpath, _dirs, files in os.walk(os.path.join(root, "pages")):
    for name in files:
        if not name.endswith(".js.nft.json"):
            continue
        trace = os.path.join(dirpath, name)
        listed = [os.path.normpath(os.path.join(dirpath, f)) for f in json.load(open(trace)).get("files", [])]
        flagged = [f for f in listed if any(s in f for s in ("/fhfhockey.com/tasks/", "/fhfhockey.com/docs/", "/fhfhockey.com/output/", "/web/scripts/output/"))]
        packages = collections.Counter()
        for f in listed:
            if "/node_modules/" in f:
                parts = f.split("/node_modules/")[-1].split("/")
                packages[parts[0] + ("/" + parts[1] if parts[0].startswith("@") else "")] += size(f)
        route = os.path.relpath(trace, os.path.join(root, "pages"))[: -len(".js.nft.json")]
        rows.append((sum(size(f) for f in listed), route, len(listed), flagged, packages.most_common(3)))

rows.sort(reverse=True)
print("traces:", len(rows), "median MB: %.1f" % (statistics.median(r[0] for r in rows) / 1e6))
for total, route, count, flagged, top in rows[:15]:
    print("%7.1f MB %5d files  %-55s %s" % (total / 1e6, count, route, ", ".join("%s %.0fMB" % (k, v / 1e6) for k, v in top)))
print("routes tracing tasks/docs/output files:", [(r[1], len(r[3])) for r in rows if r[3]])
