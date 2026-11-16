#!/bin/zsh
# RECHECK-11 B1: hard date guard, checked FIRST. On a slot date (2026-11-17 or 2026-11-18 UTC) a rehearsal could put a
# real launcher inside its window, take the real lock and read the real .env.local. It refuses to run at all.
case $(/bin/date -u +%Y-%m-%d) in 2026-11-17|2026-11-18) print -r -- "REFUSE: slot date (UTC 2026-11-17/18): no dress rehearsal on a slot date"; exit 3;; esac
# BLSH pilot: dress rehearsal of RUNBOOK.md end to end. Offline.
#   zsh dress-rehearsal.sh <empty scratch dir>          the 2026-11-17 plan (candidate v5-1117)
#   zsh dress-rehearsal.sh <empty scratch dir> 1118     the 2026-11-18 fallback (RUNBOOK §8 delta, candidate v5-1118)
# - Never reads web/.env.local values (one stat, metadata only), never runs the real bootstrap --run, never runs the
#   egress block (it would reach the real hosts), no network, never creates anything at the real output, receipt,
#   lock, attestation or evidence paths.
# - The RUNBOOK's fenced command blocks are EXTRACTED and run verbatim. Substitutions: attestation folder, receipt and
#   snapshot output paths -> scratch; the receipt's <...> placeholders -> rehearsal IDs; for 1118 the §8 delta table;
#   and, for 1118 only while FALLBACK.patch is not applied to canonical web/, --sources/--bootstrap pointing at a
#   scratch export of 348a122d6 + FALLBACK.patch.
# - Probe v2 runs through a seam (parse() -> fake env file; open() refuses the real path); its children are real.
# - The launcher at a fake 14:04:00Z runs through launch(): fake clock, fake 0600 env file, node stub as the exec target.
#   Its gate-7 G3 is the real pinned G3 (1117), or the real G3 with --sources at the fallback export (1118, pre-apply).
# - The attestation's real CLI check must REJECT the rehearsal's own attestation (stub argv0, fake cwd); it is accepted
#   only through the explicit seam check(path, candidate, expect={stub, fake web}).
# - The RUNBOOK start line (L.1) runs against a scratch COPY of the launcher whose only two changed lines are ENV_FILE
#   and LOCK_PATH (both into scratch), so no rehearsal step can use the real lock or the real env file (RECHECK-11 B1).
# - Not scratch-only: G3 makes empty mkdtemp folders under the shell's temp folder or /tmp.
# Exit 0 only if every step behaved as expected.
set -u
S=${1:?scratch}; V=${2:-1117}; mkdir -p "$S"; S=$(cd "$S" && pwd)
[[ $V == 1117 || $V == 1118 ]] || { print "variant must be 1117 or 1118"; exit 2; }
R=/Users/tim/Code/fhfhockey.com; O=$R/tasks/artifacts/blsh-pilot-operator-2026-11-15; W=$R/web; T=$O/tools
FB=$R/tasks/artifacts/blsh-successor-candidate-2026-11-15/fallback-1118
PY=(/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I)
FAILS=0
ok()   { print -r -- "PASS  $1"; }
bad()  { print -r -- "FAIL  $1"; FAILS=$((FAILS+1)); }
skip() { print -r -- "SKIP  $1"; }
hdr()  { print -r -- ""; print -r -- "== $1"; }
if [[ $V == 1117 ]]; then
  DAY=17; CAND=v5-1117; OTHER=v5-1118; LAUNCHER=$T/nst-pilot-launcher.py; BASE=$O/evidence/DEPENDENCY-TREE-BASELINE.json
  SOURCES=""; BOOT=$W/scripts/blsh/nativeProcessCaptureBootstrap.ts; BOOT_TEST=$W/scripts/blsh/nativeProcessCaptureBootstrap.test.ts
else
  DAY=18; CAND=v5-1118; OTHER=v5-1117; LAUNCHER=$T/nst-pilot-launcher-1118.py; BASE=$O/evidence/DEPENDENCY-TREE-BASELINE-1118.json
  # FALLBACK.patch is not applied to canonical web/ yet: build the patched sources in scratch (git archive is read-only).
  (cd $R && git archive 348a122d6 web/scripts/blsh web/lib web/package.json web/tsconfig.json) | tar -x -C $S
  (cd $S && env -u GIT_DIR git apply $FB/FALLBACK.patch) && ln -s $W/node_modules $S/web/node_modules
  SOURCES=$S/web; BOOT=$SOURCES/scripts/blsh/nativeProcessCaptureBootstrap.ts; BOOT_TEST=$SOURCES/scripts/blsh/nativeProcessCaptureBootstrap.test.ts
  [[ $(shasum -a 256 $BOOT | cut -d' ' -f1) == 849009ee3b68527858f93512c050ef5d0c01c20ef740c9e62addec4df21b4465 ]] \
    && ok "fallback export: 348a122d6 + FALLBACK.patch, bootstrap 849009ee (scratch; canonical web/ untouched)" || bad "fallback export bootstrap hash"
fi
A=$S/attestation; RECEIPT=$S/fhfh-blsh-authorization-202611${DAY}T140500Z.json
OUTPUT="/Users/tim/Library/Application Support/fhfh-blsh-native-20261117T140500Z"
FAKEWEB=$S/fakeweb; mkdir -p $FAKEWEB
SEAMCOPY=$S/launcher-seam-copy.py
/usr/bin/python3 -I - $LAUNCHER $SEAMCOPY $S/seam/.env.local $S/seam/lock/launcher.lock $DAY <<'PYEOF2'
import sys
src_path, dst, env, lock, day = sys.argv[1:6]
src = open(src_path).read()
e = 'ENV_FILE = os.path.join(WEB, ".env.local")'
l = 'LOCK_PATH = os.path.join(os.path.dirname(TOOLS), "attestation", "launcher-202611%sT1405Z.lock")' % day
assert src.count(e) == 1 and src.count(l) == 1
out = src.replace(e, "ENV_FILE = %r  # REHEARSAL SEAM" % env).replace(l, "LOCK_PATH = %r  # REHEARSAL SEAM" % lock)
a, b = src.split("\n"), out.split("\n")
assert len(a) == len(b) and sum(x != y for x, y in zip(a, b)) == 2
open(dst, "w").write(out)
PYEOF2
[[ -s $SEAMCOPY ]] && ok "seam: scratch launcher copy differs from $(basename $LAUNCHER) only in ENV_FILE and LOCK_PATH (both scratch)" || bad "seam copy"
g3ok() { [[ $(cat "$1/g3-$2.exit") == 0 ]] && grep -q '"dependencyTree":"match"' "$1/g3-$2.stdout" && grep -q '"uncovered":\[\]' "$1/g3-$2.stdout"; }

# Node stub standing in for /usr/local/bin/node: prints argv, cwd, env key NAMES and value digests only.
STUB=$S/stub-node
cat > $STUB <<'EOF'
#!/usr/local/bin/node
const c = require("node:crypto"), d = v => c.createHash("sha256").update(v).digest("hex");
const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NST_KEY", "SUPABASE_SERVICE_ROLE_KEY"].filter(k => k in process.env);
console.log(JSON.stringify({ stub: "capture-stand-in", argv: process.argv.slice(2), cwd: process.cwd(), envKeys: Object.keys(process.env).sort(),
  digests: Object.fromEntries(keys.map(k => [k, d(process.env[k])])) }));
EOF
chmod 755 $STUB
# Seam driver: the real launch() with a fake clock. Gate 7 is the real default G3, or (sources given) the real G3 tool
# run with --sources <fallback export>, logged and judged exactly like default_g3.
DRIVER=$S/driver.py
cat > $DRIVER <<'EOF'
import datetime, hashlib, importlib.util, json, os, subprocess, sys, tempfile
launcher, env_file, start, lock, node, receipt, web, sources = sys.argv[1:9]
spec = importlib.util.spec_from_file_location("launcher", launcher); L = importlib.util.module_from_spec(spec); spec.loader.exec_module(L)
UTC = datetime.timezone.utc
class Clock:
    def __init__(self, iso): self.t = datetime.datetime.fromisoformat(iso).replace(tzinfo=UTC)
    def now(self): return self.t
    def sleep(self, s): self.t += datetime.timedelta(seconds=s)
c = Clock(start)
def log(o): print(json.dumps(o, sort_keys=True), flush=True)
def g3_sources(log_):
    if L.sha256_file(L.G3_TOOL) != L.G3_TOOL_SHA256: raise L.Refuse("g3_tool_not_pinned")
    if L.sha256_file(L.G3_BASELINE) != L.G3_BASELINE_SHA256: raise L.Refuse("g3_baseline_not_pinned")
    out = subprocess.run([L.NODE, L.G3_TOOL, "--sources", sources, "--baseline", L.G3_BASELINE, "--loaded"], cwd=L.WEB,
                         env={"PATH": "/usr/bin:/bin", "TMPDIR": tempfile.mkdtemp(prefix="blsh-g3-") + "/"}, capture_output=True, text=True, timeout=60)
    log_({"launcher": "g3", "exitCode": out.returncode, "stdout": out.stdout.strip()})
    r = json.loads(out.stdout)
    if not (out.returncode == 0 and r.get("dependencyTree") == "match" and r.get("treeSHA256") == L.G3_TREE and r.get("differences") == []
            and (r.get("loaded") or {}).get("uncovered") == [] and r.get("dyldKeysPresent") is False): raise L.Refuse("g3_not_match")
try:
    L.launch(receipt, own_env=dict(os.environ), env_file=env_file, web=web, node=node, now=c.now, sleep=c.sleep, log=log,
             launcher_sha256=hashlib.sha256(open(launcher, "rb").read()).hexdigest(), lock_path=lock,
             **({"g3": g3_sources} if sources != "-" else {}))
except L.Refuse as r:
    log({"launcher": "refuse", "code": str(r)}); sys.exit(2)
EOF
seamcheck() { "${PY[@]}" -c 'import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("a", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
r = m.check(sys.argv[2], sys.argv[3], expect={"argv0": sys.argv[4], "cwd": sys.argv[5]}); print(json.dumps(r, sort_keys=True)); sys.exit(0 if r["conversion"] == "accept" else 1)' \
  $T/operator-attestation.py "$1" "$2" $STUB $FAKEWEB; }

# Extract the RUNBOOK's fenced bash blocks and apply only the documented substitutions.
NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
B=$S/blocks; mkdir -p $B
/usr/bin/python3 -I - $O/RUNBOOK.md $B $A $S/literal-start $RECEIPT $NOW $V "${SOURCES:--}" $BOOT $S $SEAMCOPY > $S/blocks.list <<'PYEOF'
import re, sys
runbook, out, att, start_att, receipt, now, variant, sources, boot, scratch, seamcopy = sys.argv[1:12]
blocks = re.findall(r"```bash\n(.*?)```", open(runbook).read(), re.S)
names = {"probe": "env-presence-probe-v2.py", "snapshot": "preapproval-runtime-snapshot.cjs", "interp": "print(sys.executable)",
         "stat": "stat -f '%HT", "egress": "egress-connect-check.mjs", "git": "git log --since", "receipt": "write-authorization-receipt.py",
         "g3t0": "P=T-0", "shell": "export -p", "start": "nst-pilot-launcher.py", "g3t1": "P=T+0", "attest": "operator-attestation.py write",
         "fallbackstop": "abandoned-20261117/launcher-20261117T1405Z.lock"}
assert len(blocks) == len(names), len(blocks)
O = "/Users/tim/Code/fhfhockey.com/tasks/artifacts/blsh-pilot-operator-2026-11-15"
day = "17" if variant == "1117" else "18"
prev = "16" if variant == "1117" else "17"
for text in blocks:
    hits = [n for n, m in names.items() if m in text]
    assert len(hits) == 1, hits
    name = hits[0]
    if variant == "1118":  # RUNBOOK §8 substitution table, exactly
        text = (text.replace("tools/nst-pilot-launcher.py", "tools/nst-pilot-launcher-1118.py")
                    .replace("evidence/DEPENDENCY-TREE-BASELINE.json", "evidence/DEPENDENCY-TREE-BASELINE-1118.json")
                    .replace("v5-1117", "v5-1118")
                    .replace("fhfh-blsh-authorization-20261117T140500Z.json", "fhfh-blsh-authorization-20261118T140500Z.json")
                    .replace("evidence/PREAPPROVAL-RUNTIME-EVIDENCE.json", "evidence/PREAPPROVAL-RUNTIME-EVIDENCE-1118.json")
                    .replace("evidence/PREAPPROVAL-RUNTIME-SNAPSHOT.json", "evidence/PREAPPROVAL-RUNTIME-SNAPSHOT-1118.json"))
        if sources != "-":  # pre-apply only: the patched bootstrap lives in the scratch export
            text = text.replace("dependency-tree-hash.mjs --baseline", "dependency-tree-hash.mjs --sources %s --baseline" % sources)
            text = text.replace("--candidate v5-1118 --approved-at", "--candidate v5-1118 --bootstrap %s --approved-at" % boot)
    if name == "start":  # B1: the start line runs the scratch seam copy, never the real ENV_FILE/LOCK_PATH
        text = re.sub(re.escape(O) + r"/tools/nst-pilot-launcher(-1118)?\.py", seamcopy, text)
        assert seamcopy in text
    text = text.replace(O + "/attestation", start_att if name == "start" else att)
    text = re.sub(r'"/Users/tim/Library/Application Support/fhfh-blsh-authorization-202611\d\dT140500Z\.json"', '"%s"' % receipt, text)
    text = re.sub(re.escape(O) + r"/evidence/(PREAPPROVAL-RUNTIME-(?:EVIDENCE|SNAPSHOT)(?:-1118)?\.json)", lambda m: "%s/%s" % (scratch, m.group(1)), text)
    text = re.sub(r"<A2 time[^>]*>", now, text).replace("<A2 reference>", "REHEARSAL.not-an-approval")
    text = text.replace("<T−1.2 ID>", "blsh-preapproval-runtime-202611%s.rehearsal" % prev).replace("<13:58 ID>", "blsh-slot-202611%sT1405Z.tminus.rehearsal" % day)
    text = text.replace("<T−1.1 ID>", "blsh-admission-historical-5e854308.unverified")
    if name == "receipt":
        assert not re.search(r"<(A2|T−|13:58)", text), "unfilled receipt placeholder"
    assert O + "/evidence/PREAPPROVAL" not in text and O + "/attestation" not in text, name
    open("%s/%s.sh" % (out, name), "w").write(text)
    print(name)
PYEOF
[[ $(wc -l < $S/blocks.list | tr -d ' ') == 13 ]] && ok "RUNBOOK ($V): 13 fenced command blocks extracted, substitutions applied" || bad "RUNBOOK block extraction: $(cat $S/blocks.list)"
blk() { [[ $1 == egress ]] && { bad "refusing to run the egress block"; return; }; zsh $B/$1.sh > $S/$1.out 2>&1; echo $? > $S/$1.rc; }

FAKE_NST=rehearsal-nst-7c1e0b2d9a; FAKE_SRK=rehearsal-srk-4f8a6e3c1b
fakeenv() { print -r -- "NEXT_PUBLIC_SUPABASE_URL=https://fyhftlxokyjtpndbkfse.supabase.co
NST_KEY=$FAKE_NST
SUPABASE_SERVICE_ROLE_KEY=$FAKE_SRK
OTHER_KEY=dropped${2:-}" > $1; chmod 600 $1; }

if [[ $V == 1118 ]]; then
  hdr "§8 first: did the 11-17 launcher start? (M2)"
  blk fallbackstop; [[ $(cat $S/fallbackstop.out) == 0 ]] && ok "§8 [RUNBOOK block] stop check: 0 (no 11-17 lock, launcher.log, capture.exit or output, also not in abandoned-20261117/)" || bad "§8 stop check: $(cat $S/fallbackstop.out)"
  mkdir -p $S/neg-stop/abandoned-20261117 && : > $S/neg-stop/abandoned-20261117/launcher-20261117T1405Z.lock
  sed "s|$A|$S/neg-stop|" $B/fallbackstop.sh > $B/fallbackstop-neg.sh; zsh $B/fallbackstop-neg.sh > $S/fallbackstop-neg.out 2>&1
  [[ $(cat $S/fallbackstop-neg.out) == 1 ]] && ok "§8 stop check negative: an 11-17 lock moved into abandoned-20261117/ is still found (1 -> stop)" || bad "§8 stop negative: $(cat $S/fallbackstop-neg.out)"
fi

hdr "T-1 ($V)"
skip "T-1.1 approval 0: admission recheck SQL (ADMISSION-CONTROL §4) - external DB read, needs TJ's approval"
fakeenv $S/probe.env.local
/usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I - $T/env-presence-probe-v2.py $S/probe.env.local $BOOT $CAND > $S/probe.out 2>&1 <<'PYEOF'
import builtins, importlib.util, os, sys
probe, fake, boot, cand = sys.argv[1:5]
REAL = "/Users/tim/Code/fhfhockey.com/web/.env.local"
real_open = builtins.open
def guarded_open(path, *a, **k):
    if os.path.abspath(str(path)) == REAL: raise PermissionError("rehearsal never opens the real env file")
    return real_open(path, *a, **k)
builtins.open = guarded_open
spec = importlib.util.spec_from_file_location("probe", probe); P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
real_parse = P.parse
def parse(path):
    assert path == REAL, path
    return real_parse(fake)
P.parse = parse
os.chdir(P.WEB)
sys.argv = [probe, ".env.local", boot, cand]
P.main()
PYEOF
PV=$(/usr/bin/python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); r=d["predictedRuntimeCheck"]; print(d["pass"], d["candidate"], d["dependencyTreeCheck"].get("dependencyTree"), r.get("checkRuntime"), r.get("bridge",{}).get("code","-"), d["dyldKeysPresent"], d["valueShapeSuspectKeys"]==[])' $S/probe.out 2>&1)
if [[ $V == 1117 ]]; then
  [[ $PV == "True v5-1117 match pass - False True" ]] && ok "T-1.2 probe v2 (seam, fake env file; children real): pass true, G3 match, checkRuntime pass" || bad "T-1.2 probe: $PV $(cut -c1-300 $S/probe.out)"
else
  [[ $PV == "False v5-1118 match veto runtime_bootstrap_not_candidate False True" ]] \
    && ok "T-1.2 probe v2 1118 pre-apply: only veto runtime_bootstrap_not_candidate (prediction reads canonical v5); G3 vs 1118 baseline match" || bad "T-1.2 probe 1118: $PV"
fi
blk snapshot; SN=$(/usr/bin/python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d["noOverrides"], d["versions"]["npmUndiciResolvedFromCheerio"]["version"], d["tls"]["defaultMinVersion"], d["tls"]["defaultMaxVersion"], d["tls"]["caCounts"]["default"]==d["tls"]["caCounts"]["bundled"])' $S/PREAPPROVAL-RUNTIME-SNAPSHOT*.json 2>&1)
[[ $(cat $S/snapshot.rc) == 0 && $SN == "True 7.29.0 TLSv1.2 TLSv1.3 True" ]] && ok "T-1.2b [RUNBOOK block] runtime snapshot: noOverrides, undici 7.29.0, TLSv1.2-1.3, default CA = bundled" || bad "T-1.2b snapshot: $SN $(cat $S/snapshot.out)"
blk interp; [[ $(cat $S/interp.out) == /Library/Developer/CommandLineTools/usr/bin/python3 ]] && ok "T-1.3 [RUNBOOK block] interpreter" || bad "T-1.3 interpreter: $(cat $S/interp.out)"
blk stat; [[ $(cat $S/stat.out) == "Regular File|600|$(id -u)|1" ]] && ok "T-1.4 [RUNBOOK block] .env.local stat only (no read): $(cat $S/stat.out)" || bad "T-1.4 stat: $(cat $S/stat.out)"
grep -q 'egress-connect-check.mjs --run' $B/egress.sh && ok "T-1.5 egress block extracted and NOT run (real hosts); loopback tests: tools/test-egress-connect-check.mjs" || bad "T-1.5 egress block"

hdr "T-0 ($V, 13:45-14:03Z)"
blk git; [[ $(cat $S/git.out) == end ]] && ok "T-0.1 [RUNBOOK block] activity: no cron-file commits since 11-15, no uncommitted cron edits" || bad "T-0.1 git: $(cat $S/git.out)"
skip "T-0.1b activity: mailboxes + list_sessions + owner confirmations (SLOT-CLEARANCE §5) - agent steps on the day"
blk receipt; [[ $(cat $S/receipt.rc) == 0 && $(stat -f %Lp $RECEIPT) == 600 ]] && grep -q '"receipt": "written"' $S/receipt.out && ok "T-0.2 [RUNBOOK block] receipt written 0600 ($CAND)" || bad "T-0.2 receipt: $(cat $S/receipt.out)"
/usr/bin/python3 -I - $RECEIPT $BOOT $BOOT_TEST > $S/receipt.check <<'PYEOF'
import hashlib, json, os, re, sys
p, b, t = sys.argv[1:4]; src = open(b).read(); st = os.lstat(p); r = json.load(open(p))
const = {n: re.search(r'^const %s = "([^"]+)";$' % n, src, re.M).group(1) for n in ("SLOT", "OUTPUT", "ORIGIN")}
fields = sorted(["version", "approvedBy", "approvedAtUTC", "approvalReference", "operator", "bootstrapSHA256", "slotStartUTC", "outputDirectory",
  "supabaseOrigin", "lifecycleMode", "maximumHTTPAttempts", "coordinationReceipt", "runtimeReceipt", "admissionReceipt"])
ok = (st.st_mode & 0o777 == 0o600 and 0 < st.st_size <= 16384 and sorted(r) == fields and r["version"] == "fhfh.blsh.native-pilot-authorization.v1"
  and r["approvedBy"] == "TJ" and r["bootstrapSHA256"] == hashlib.sha256(open(b, "rb").read()).hexdigest() and r["slotStartUTC"] == const["SLOT"]
  and r["outputDirectory"] == const["OUTPUT"] and r["supabaseOrigin"] == const["ORIGIN"] and r["lifecycleMode"] == "disabled"
  and r["maximumHTTPAttempts"] == 5 and all(re.match(r"^[A-Za-z0-9._:-]{1,200}$", r[k]) for k in ("approvalReference", "operator", "coordinationReceipt", "runtimeReceipt", "admissionReceipt"))
  and re.match(r"^2026-11-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$", r["approvedAtUTC"]))
fx = re.search(r"const receipt = \(\) => \(\{(.*?)\}\);", open(t).read(), re.S).group(1)
fx_keys = sorted(re.findall(r"(\w+):", re.sub(r'"[^"]*"', '""', fx)))
fx_fixed = dict(re.findall(r'(version|approvedBy|lifecycleMode): "([^"]+)"', fx)); fx_max = re.search(r"maximumHTTPAttempts: (\d+)", fx).group(1)
same = fx_keys == fields and all(r[k] == v for k, v in fx_fixed.items()) and str(r["maximumHTTPAttempts"]) == fx_max and "slotStartUTC: SLOT" in fx and "outputDirectory: OUTPUT" in fx
print(("contract_ok" if ok else "contract_FAIL") + " " + ("fixture_same" if same else "fixture_DIFF") + " " + r["slotStartUTC"])
PYEOF
[[ $(cat $S/receipt.check) == "contract_ok fixture_same 2026-11-${DAY}T14:05:00.000Z" ]] && ok "T-0.2b receipt meets readAuthorization's contract, matches the bootstrap test fixture, slot 2026-11-$DAY" || bad "T-0.2b: $(cat $S/receipt.check)"
blk receipt; grep -q receipt_exists $S/receipt.out && ok "T-0.2c the same block again refuses (receipt_exists)" || bad "T-0.2c: $(cat $S/receipt.out)"
blk g3t0; g3ok $A T-0 && ok "T-0.3 [RUNBOOK block] G3 --loaded vs $(basename $BASE): match, 256 loaded, uncovered []" || bad "T-0.3 G3: $(cat $S/g3t0.out)"
blk shell; [[ $(head -1 $S/shell.out) == 0 && $(grep -c 'No such file or directory' $S/shell.out) == 2 && $(tail -1 $S/shell.out) == "700|$(id -u)" ]] \
  && ok "T-0.4 [RUNBOOK block] shell builtin count 0; both output dirs absent; parent 700" || bad "T-0.4 shell/output: $(cat $S/shell.out)"

hdr "~14:04Z ($V): the launcher"
mkdir -p $S/literal-start
blk start; grep -qx '{"code": "outside_start_window", "launcher": "refuse"}' $S/literal-start/launcher.log && [[ $(cat $S/literal-start/capture.exit) == 2 && -s $S/literal-start/capture.ended-utc && ! -e $O/attestation ]] \
  && [[ ! -e $S/seam/lock/launcher.lock ]] \
  && ok "L.1 [RUNBOOK block] the start line (seam copy of $(basename $LAUNCHER), real clock, today): outside_start_window; no lock, no env-file open" || bad "L.1 start line: $(cat $S/literal-start/launcher.log 2>&1)"
fakeenv $S/fake.env.local
(cd $S && "${PY[@]}" $DRIVER $LAUNCHER $S/fake.env.local 2026-11-${DAY}T14:04:00 $A/launcher-202611${DAY}T1405Z.lock $STUB $RECEIPT $FAKEWEB "${SOURCES:--}" \
   > $A/launcher.log 2>&1; echo $? > $A/capture.exit); date -u +%Y-%m-%dT%H:%M:%SZ > $A/capture.ended-utc
grep -q '"launcher": "exec"' $A/launcher.log && grep -q '"stub":"capture-stand-in"' $A/launcher.log && [[ $(cat $A/capture.exit) == 0 ]] \
  && ok "L.2 launcher at fake 2026-11-$DAY 14:04:00Z (seam): real G3 gate match, one exec of the stub, 8 allowlisted keys" || bad "L.2 launcher: $(cat $A/launcher.log)"
[[ -e $A/launcher-202611${DAY}T1405Z.lock ]] && ok "L.3 lock taken (scratch), never removed" || bad "L.3 lock"

hdr "T+0 ($V)"
blk g3t1; g3ok $A T+0 && ok "T+0.1 [RUNBOOK block] G3 rerun: match, uncovered []" || bad "T+0.1 G3: $(cat $S/g3t1.out)"
blk attest
REASONS=$(tail -1 $S/attest.out | /usr/bin/python3 -I -c 'import json,sys; print(",".join(sorted(json.load(sys.stdin)["reasons"])))')
grep -q '"bothMatch": true' $S/attest.out && grep -q '"dyldKeysPresent": false' $S/attest.out && [[ $(cat $S/attest.rc) == 1 && $REASONS == "launcher_argv0_not_real_node,launcher_cwd_not_canonical_web" ]] \
  && ok "T+0.2 [RUNBOOK block] attestation written; the real CLI check REJECTS the rehearsal (stub argv0, fake cwd) and nothing else" || bad "T+0.2 attest: $(cat $S/attest.out)"
seamcheck $A/OPERATOR-ATTESTATION.json $CAND > $S/seam.out && grep -q '"accept"' $S/seam.out && ok "T+0.3 explicit rehearsal seam check(expect={stub, fake web}): accept" || bad "T+0.3 seam: $(cat $S/seam.out)"
grep -q -e $FAKE_NST -e $FAKE_SRK -r $S --exclude=fake.env.local --exclude=dyld.env.local --exclude=probe.env.local && bad "secret value found in scratch outputs" || ok "T+0.4 no fake secret value in any output, log or attestation file"

hdr "Negative ($V): the conversion rule must reject"
N=$S/neg-tplus0; cp -R $A $N; rm -f $N/OPERATOR-ATTESTATION.json $N/g3-T+0.*
C=$S/closure/web; mkdir -p $C/node_modules $C/scripts $C/lib; cp $W/package.json $W/tsconfig.json $C/; cp -R $W/scripts/blsh $C/scripts/; cp -R $W/lib/nst $W/lib/cron $C/lib/
/usr/bin/python3 -I -c "import json;[print(p['path']) for p in json.load(open('$BASE'))['packages']]" | while read p; do
  mkdir -p "$C/$p"; (cd "$W/$p" && find . -path ./node_modules -prune -o \( -type f -o -type l \) -print | cpio -pdm "$C/$p" 2>/dev/null); done
print -r -- "// changed after T-0" >> $C/node_modules/undici/index.js
shasum -a 256 $T/dependency-tree-hash.mjs $BASE > $N/g3-T+0.inputs-sha256; date -u +%Y-%m-%dT%H:%M:%SZ > $N/g3-T+0.shell-start-utc
(cd $C && env -i PATH=/usr/bin:/bin TMPDIR="$(mktemp -d $S/tmp.XXXXXX)/" /usr/local/bin/node $T/dependency-tree-hash.mjs --web $C --baseline $BASE --loaded > $N/g3-T+0.stdout; echo $? > $N/g3-T+0.exit)
date -u +%Y-%m-%dT%H:%M:%SZ > $N/g3-T+0.shell-end-utc
"${PY[@]}" $T/operator-attestation.py write --candidate $CAND --dir $N > /dev/null
seamcheck $N/OPERATOR-ATTESTATION.json $CAND > $S/neg1.out; [[ $? == 1 ]] && grep -q tPlus0_g3_dependencyTree $S/neg1.out && ok "N.1 T+0 mismatch (real G3 refusal on a changed closure) rejected" || bad "N.1: $(cat $S/neg1.out)"
/usr/bin/python3 -I -c "import json,sys;p=sys.argv[1];a=json.load(open(p));a['g3']['bothMatch']=True;open(p,'w').write(json.dumps(a))" $N/OPERATOR-ATTESTATION.json
seamcheck $N/OPERATOR-ATTESTATION.json $CAND > $S/neg1b.out; [[ $? == 1 ]] && ok "N.1b hand-set bothMatch:true still rejected" || bad "N.1b: $(cat $S/neg1b.out)"
N=$S/neg-dyld; mkdir -p $N; cp $A/g3-T* $A/shell-dyld-devdir.count $N/
fakeenv $S/dyld.env.local $'\nDYLD_INSERT_LIBRARIES=/tmp/x.dylib'
(cd $S && "${PY[@]}" $DRIVER $LAUNCHER $S/dyld.env.local 2026-11-${DAY}T14:04:00 $N/launcher-202611${DAY}T1405Z.lock $STUB $RECEIPT $FAKEWEB "${SOURCES:--}" \
   > $N/launcher.log 2>&1; echo $? > $N/capture.exit); date -u +%Y-%m-%dT%H:%M:%SZ > $N/capture.ended-utc
"${PY[@]}" $T/operator-attestation.py write --candidate $CAND --dir $N > $S/neg2w.out
seamcheck $N/OPERATOR-ATTESTATION.json $CAND > $S/neg2.out; RC=$?
[[ $RC == 1 ]] && grep -q dyld_key_in_env_file $S/neg2.out && grep -q '"dyldKeysPresent": true' $S/neg2w.out && ! grep -q capture-stand-in $N/launcher.log \
  && ok "N.2 DYLD in env file: launcher refused, no exec; dyldKeysPresent:true; rejected" || bad "N.2: $(cat $S/neg2w.out $S/neg2.out)"
N=$S/neg-shell; cp -R $A $N; rm -f $N/OPERATOR-ATTESTATION.json; print 1 > $N/shell-dyld-devdir.count
"${PY[@]}" $T/operator-attestation.py write --candidate $CAND --dir $N > /dev/null
seamcheck $N/OPERATOR-ATTESTATION.json $CAND > $S/neg3.out; [[ $? == 1 ]] && grep -q operator_shell_dyld $S/neg3.out && ok "N.3 operator shell DYLD_/DEVELOPER_DIR count 1: rejected" || bad "N.3: $(cat $S/neg3.out)"
seamcheck $A/OPERATOR-ATTESTATION.json $OTHER > $S/neg4.out; [[ $? == 1 ]] && grep -q attestation_candidate_mismatch $S/neg4.out && grep -q launcher_not_pinned $S/neg4.out \
  && ok "N.4 the $CAND attestation checked as $OTHER: rejected (candidate, launcher, baseline, date)" || bad "N.4: $(cat $S/neg4.out)"
orderneg() { local tag=$1 run=$2 field=$3 value=$4 want=$5
  cp $A/OPERATOR-ATTESTATION.json $S/order-$tag.json
  /usr/bin/python3 -I -c "import json,sys;p,r,f,v=sys.argv[1:5];a=json.load(open(p));a['g3'][r][f]=v;open(p,'w').write(json.dumps(a))" $S/order-$tag.json $run $field $value
  seamcheck $S/order-$tag.json $CAND > $S/order-$tag.out; [[ $? == 1 ]] && grep -q $want $S/order-$tag.out && ok "$tag $run.$field=$value: rejected ($want)" || bad "$tag: $(cat $S/order-$tag.out)"; }
orderneg N.5 tMinus0 shellEndUTC 2026-11-${DAY}T14:06:00Z tMinus0_g3_not_before_exec
orderneg N.6 tPlus0 shellStartUTC 2000-01-01T00:00:00Z tPlus0_g3_not_after_capture_end
rm -rf $S/closure

hdr "Result ($V)"
[[ ! -e $OUTPUT && ! -e "${OUTPUT/20261117/20261118}" && ! -e $O/attestation && ! -e $O/evidence/PREAPPROVAL-RUNTIME-SNAPSHOT.json && ! -e $O/evidence/PREAPPROVAL-RUNTIME-EVIDENCE.json ]] \
  && ok "no real output, attestation, lock, receipt or evidence path was created" || bad "a real path was created"
print -r -- "failures: $FAILS"
exit $(( FAILS > 0 ))
