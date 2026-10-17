"""First Load JS per Pages Router route, computed the way `next build` reports it.

Usage (after an isolated compile build, see ../BASELINE.md):
    python3 -I first_load.py /Users/tim/Code/fhfhockey.com/web/.next-playwright > first-load-by-route.tsv

First Load JS = gzip(level 9) of the route's JS chunks plus the `/_app` entry chunks
(webpack runtime, framework, main, _app), each file counted once. CSS is excluded.
"""
import gzip
import json
import os
import sys

root = sys.argv[1]
manifest = json.load(open(os.path.join(root, "build-manifest.json")))
cache = {}


def gz(path):
    if path not in cache:
        data = open(os.path.join(root, path), "rb").read()
        cache[path] = (len(gzip.compress(data, 9)), len(data))
    return cache[path]


app = [f for f in manifest["pages"]["/_app"] if f.endswith(".js")]
shared = sum(gz(f)[0] for f in app)
print("route\tfirst_load_gz_kB\tpage_own_gz_kB\tpage_own_raw_kB\tpage_chunks")
rows = []
for page, files in manifest["pages"].items():
    if page.startswith("/_"):
        continue
    own = [f for f in files if f.endswith(".js") and f not in app]
    own_gz = sum(gz(f)[0] for f in own)
    rows.append((shared + own_gz, own_gz, sum(gz(f)[1] for f in own), page, len(own)))
for total, own_gz, own_raw, page, n in sorted(rows, reverse=True):
    print("%s\t%.1f\t%.1f\t%.1f\t%d" % (page, total / 1000, own_gz / 1000, own_raw / 1000, n))
print("# shared /_app JS gz kB: %.1f" % (shared / 1000), file=sys.stderr)
