# RECHECK-6: offline provenance of the G3 closure. For each baseline package, take package-lock's sha512 integrity, open
# the content-addressed tarball in the local npm cache (~/.npm/_cacache/content-v2, read-only, in memory, nothing
# executed or extracted to disk), and compare every regular file with the installed copy under web/ (nested
# node_modules excluded, as G3 does). Run: python3 -I provenance.py
import base64, hashlib, io, json, os, sys, tarfile
WEB = "/Users/tim/Code/fhfhockey.com/web"
base = json.load(open("/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15/evidence/DEPENDENCY-TREE-BASELINE.json"))
lock = json.load(open(os.path.join(WEB, "package-lock.json")))["packages"]
cache = os.path.expanduser("~/.npm/_cacache/content-v2/sha512")
sha = lambda b: hashlib.sha256(b).hexdigest()
out = []
for p in base["packages"]:
    integ = lock[p["path"]]["integrity"]; algo, b64 = integ.split("-", 1)
    hx = base64.b64decode(b64).hex(); f = os.path.join(cache, hx[:2], hx[2:4], hx[4:])
    if algo != "sha512" or not os.path.exists(f): out.append({"path": p["path"], "result": "tarball_not_cached"}); continue
    raw = open(f, "rb").read()
    if hashlib.sha512(raw).hexdigest() != hx: out.append({"path": p["path"], "result": "cache_integrity_mismatch"}); continue
    tar = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as t:
        for m in t.getmembers():
            if m.isfile(): tar[m.name.split("/", 1)[1]] = sha(t.extractfile(m).read())
    inst = {}; root = os.path.join(WEB, p["path"])
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x != "node_modules"]
        for n in files:
            q = os.path.join(d, n)
            if os.path.isfile(q) and not os.path.islink(q): inst[os.path.relpath(q, root)] = sha(open(q, "rb").read())
    changed = sorted(k for k in inst if k in tar and tar[k] != inst[k]); extra = sorted(set(inst) - set(tar)); missing = sorted(set(tar) - set(inst))
    out.append({"path": p["path"], "version": p["version"], "files": len(inst), "result": "identical" if not (changed or extra or missing) else "differs",
                "changed": changed, "extraInstalled": extra, "missingFromInstall": missing})
summary = {"packages": len(out), "identical": sum(o["result"] == "identical" for o in out), "notIdentical": [o for o in out if o["result"] != "identical"]}
print(json.dumps(summary, indent=1))
