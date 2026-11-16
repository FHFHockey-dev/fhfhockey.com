"""BLSH pilot: write OPERATOR-ATTESTATION.json from the day's actual output files, and apply the conversion rule
(RUNTIME-RECEIPT-PLAN §3c). Offline; reads only the attestation directory; never reads an env file.

    /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I operator-attestation.py write --candidate v5-1117 --dir <attestation dir>
    /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I operator-attestation.py check --candidate v5-1117 <OPERATOR-ATTESTATION.json>
--candidate is v5-1117 (launcher 31c370c3..., G3 baseline 4534fd65..., 2026-11-17) or v5-1118 (the fallback: launcher
nst-pilot-launcher-1118.py, baseline DEPENDENCY-TREE-BASELINE-1118.json, 2026-11-18). `check` takes the candidate from
its own argument, never from the file, and rejects a file written for another candidate.
`check` binds the exec line to the real capture: argv0 /usr/local/bin/node, cwd the canonical web/, and an exec time
inside the candidate's 14:05:00-14:05:50Z exec window. It also requires T-0 G3 to end at or before the exec atUTC and T+0 G3 to start at or after capture.endedAtUTC.
The CLI has no way to relax that; the dress rehearsal uses the
check() function with an explicit `expect` override (a test seam) for its stub node and fake web/.

Inputs in --dir (all written by the RUNBOOK commands):
  g3-T-0.{stdout,exit,shell-start-utc,shell-end-utc,inputs-sha256}   T-0 G3 (§3c command, P=T-0)
  g3-T+0.{stdout,exit,shell-start-utc,shell-end-utc,inputs-sha256}   T+0 G3 (same command, P=T+0)
  shell-dyld-devdir.count     output of the zsh builtin `export -p | grep -c -E 'DYLD_|DEVELOPER_DIR'` at the start
  launcher.log                the launcher's stdout/stderr (its g3 line, its exec or refuse line, then the capture's)
  capture.exit, capture.ended-utc   exit code reported for the background launcher command, and `date -u` after it
`write` refuses if any input is missing. It creates OPERATOR-ATTESTATION.json with O_EXCL (never overwrites).
`check` recomputes every verdict from the verbatim stdouts and log lines (it does not trust the stored booleans) and
prints {"conversion":"accept"} (exit 0) or {"conversion":"reject","reasons":[...]} (exit 1).
"""
import datetime
import hashlib
import json
import os
import sys

G3_TOOL = "tools/dependency-tree-hash.mjs"
G3_TOOL_SHA256 = "912041a513f0dabf034797d6c4d93fcb2a22ded6d2019f44463ce82f56103bf4"
TREE = "76c7d466725ea13208b87adfb5ac6688a42454b66382996fbd9a7ab36432473a"
CANDIDATES = {
    "v5-1117": {"launcher": "31c370c3110ddb5d4cf90e730e9650639e36bd442959f7a7c791bbc28926197b",
                "baselinePath": "evidence/DEPENDENCY-TREE-BASELINE.json",
                "baseline": "4534fd65c30d7c6e86ac84fd0664074074c039980ba207d5f5928277a52c1bb3", "date": "2026-11-17"},
    "v5-1118": {"launcher": "2670353dff80d47a642fd657cfa22449a703acdbc6068a33971692f2621cd444",
                "baselinePath": "evidence/DEPENDENCY-TREE-BASELINE-1118.json",
                "baseline": "e9c7ec5a8afc627c231331a7c7ace6488064ee414244947a078325b7a4ccd7e9", "date": "2026-11-18"},
}
EXPECT = {"argv0": "/usr/local/bin/node", "cwd": "/Users/tim/Code/fhfhockey.com/web"}
PYTHON = "/Library/Developer/CommandLineTools/usr/bin/python3"
ALLOW = sorted(["PATH", "TMPDIR", "NODE_PATH", "DISABLE_V8_COMPILE_CACHE", "TS_NODE_COMPILER_OPTIONS",
                "NEXT_PUBLIC_SUPABASE_URL", "NST_KEY", "SUPABASE_SERVICE_ROLE_KEY"])
LOADED = {"files": 256, "roles": 9, "bootstrap": 1, "packageFiles": 245, "packages": 34, "builtins": 15, "uncovered": []}
CUSTODY = "G3 and the DYLD check ran outside the capture process; operator-attested, not bridge-verifiable."


class Refuse(Exception):
    pass


def read(d, name):
    path = os.path.join(d, name)
    if not os.path.isfile(path) or os.path.islink(path):
        raise Refuse("missing_input:" + name)
    with open(path, encoding="utf-8") as handle:
        return handle.read()


def g3_run(d, phase):
    stdout = read(d, "g3-%s.stdout" % phase)
    inputs = {}
    for line in read(d, "g3-%s.inputs-sha256" % phase).splitlines():
        digest, _, path = line.partition("  ")
        inputs[path.strip()] = digest.strip()
    return {
        "shellStartUTC": read(d, "g3-%s.shell-start-utc" % phase).strip(),
        "shellEndUTC": read(d, "g3-%s.shell-end-utc" % phase).strip(),
        "exitCode": int(read(d, "g3-%s.exit" % phase).strip()),
        "stdout": stdout,
        "stdoutSHA256": hashlib.sha256(stdout.encode("utf-8")).hexdigest(),
        "toolSHA256": next((v for k, v in inputs.items() if k.endswith(G3_TOOL)), None),
        "baselineSHA256": next((v for k, v in inputs.items() if "/evidence/DEPENDENCY-TREE-BASELINE" in k), None),
    }


def g3_reasons(run, phase, cand):
    """§3c 'Required, each time'."""
    r = []
    if run.get("exitCode") != 0:
        r.append("%s_g3_exit_%s" % (phase, run.get("exitCode")))
    lines = [l for l in (run.get("stdout") or "").split("\n") if l]
    if len(lines) != 1:
        return r + ["%s_g3_not_one_line" % phase]
    try:
        o = json.loads(lines[0])
    except ValueError:
        return r + ["%s_g3_unparsed" % phase]
    want = {"dependencyTree": "match", "treeSHA256": TREE, "baselineTreeSHA256": TREE, "checkerTypeScript": "verified_before_load",
            "dyldKeysPresent": False, "loaded": LOADED, "differences": []}
    r += ["%s_g3_%s" % (phase, k) for k, v in want.items() if o.get(k) != v]
    if run.get("toolSHA256") != G3_TOOL_SHA256:
        r.append("%s_g3_tool_not_pinned" % phase)
    if run.get("baselineSHA256") != cand["baseline"]:
        r.append("%s_g3_baseline_not_pinned" % phase)
    return r


def launcher_lines(log_text):
    out = {"g3": None, "exec": None, "refuse": None}
    for line in log_text.split("\n"):
        if not line.startswith("{"):
            continue
        try:
            o = json.loads(line)
        except ValueError:
            continue
        kind = o.get("launcher")
        if kind in out and out[kind] is None:
            out[kind] = line
    return out


def launcher_reasons(launcher, cand, expect):
    r = []
    if launcher.get("refuseLine"):
        r.append("launcher_refused:" + json.loads(launcher["refuseLine"]).get("code", "?"))
    if not launcher.get("execLine"):
        return r + ["launcher_no_exec_line"]
    e = json.loads(launcher["execLine"])
    if e.get("launcherSHA256") != cand["launcher"]:
        r.append("launcher_not_pinned")
    if e.get("argv0") != expect["argv0"]:
        r.append("launcher_argv0_not_real_node")
    if e.get("cwd") != expect["cwd"]:
        r.append("launcher_cwd_not_canonical_web")
    at = e.get("atUTC") or ""
    if not (at.startswith(cand["date"] + "T14:05:") and "T14:05:00" <= at[10:19] < "T14:05:50"):
        r.append("launcher_exec_time_outside_%s_window" % cand["date"])
    if e.get("dyldKeysPresent") is not False:
        r.append("launcher_dyld_keys_present")
    if e.get("envKeys") != ALLOW:
        r.append("launcher_env_not_allowlist")
    if e.get("pythonIsolated") is not True or e.get("pythonExecutable") != PYTHON:
        r.append("launcher_interpreter")
    if launcher.get("operatorShellDyldCount") != 0:
        r.append("operator_shell_dyld_or_developer_dir_present")
    g = launcher.get("g3Line")
    if not g:
        r.append("launcher_no_g3_line")
    else:
        go = json.loads(g)
        r += ["launcher_" + x for x in g3_reasons({"exitCode": go.get("exitCode"), "stdout": go.get("stdout", ""),
                                                   "toolSHA256": G3_TOOL_SHA256, "baselineSHA256": cand["baseline"]}, "gate7", cand)]
    return r


def write(d, name):
    cand = CANDIDATES[name]
    t0, t1 = g3_run(d, "T-0"), g3_run(d, "T+0")
    lines = launcher_lines(read(d, "launcher.log"))
    shell_count = int(read(d, "shell-dyld-devdir.count").strip())
    execd = lines["exec"] is not None
    refuse_code = json.loads(lines["refuse"]).get("code", "") if lines["refuse"] else None
    # The env file is never read here. Its DYLD state is known from the launcher: it execs only after its env-file and
    # own-env DYLD_* gates passed; a dyld_* refusal names the offending keys.
    dyld_file = [] if execd else (refuse_code.split(":", 1)[1].split(",") if refuse_code and refuse_code.startswith("dyld_key_in_env_file:") else None)
    dyld_env = [] if execd else (refuse_code.split(":", 1)[1].split(",") if refuse_code and refuse_code.startswith("dyld_key_in_launcher_env:") else None)
    exec_obj = json.loads(lines["exec"]) if execd else {}
    dyld_present = (False if execd and exec_obj.get("dyldKeysPresent") is False and shell_count == 0
                    else True if (dyld_file or dyld_env or shell_count) else None)
    launcher = {"sha256": exec_obj.get("launcherSHA256"), "execLine": lines["exec"], "g3Line": lines["g3"], "refuseLine": lines["refuse"],
                "dyldKeysPresent": dyld_present, "dyldKeysInEnvFile": dyld_file, "dyldKeysInLauncherEnv": dyld_env,
                "operatorShellDyldCount": shell_count}
    att = {
        "version": "fhfh.blsh.operator-attestation.v1",
        "operator": "claude-nst-operator.local_017907a3",
        "candidate": name,
        "g3": {"tool": {"path": G3_TOOL, "sha256": t0["toolSHA256"] if t0["toolSHA256"] == t1["toolSHA256"] else None},
               "baseline": {"path": cand["baselinePath"], "sha256": t0["baselineSHA256"] if t0["baselineSHA256"] == t1["baselineSHA256"] else None},
               "tMinus0": t0, "tPlus0": t1,
               "bothMatch": not g3_reasons(t0, "tMinus0", cand) and not g3_reasons(t1, "tPlus0", cand)},
        "launcher": launcher,
        "capture": {"exitCode": int(read(d, "capture.exit").strip()), "startedAtUTC": exec_obj.get("atUTC"),
                    "endedAtUTC": read(d, "capture.ended-utc").strip()},
        "custodyNote": CUSTODY,
    }
    data = (json.dumps(att, indent=1, sort_keys=True) + "\n").encode("utf-8")
    out = os.path.join(d, "OPERATOR-ATTESTATION.json")
    try:
        fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except FileExistsError:
        raise Refuse("attestation_exists")
    with os.fdopen(fd, "wb") as handle:
        handle.write(data)
    return {"attestation": "written", "path": out, "sha256": hashlib.sha256(data).hexdigest(),
            "bothMatch": att["g3"]["bothMatch"], "dyldKeysPresent": dyld_present}


def utc(text):
    """'2026-11-17T14:05:05Z' or with fractional seconds -> aware datetime; None if unparseable."""
    try:
        return datetime.datetime.strptime(text.replace("Z", "+0000") if "." in text else text.replace("Z", ".000000+0000"), "%Y-%m-%dT%H:%M:%S.%f%z")
    except (AttributeError, TypeError, ValueError):
        return None


def order_reasons(att):
    """RECHECK-11 B2: T-0 G3 must end before the exec, and T+0 G3 must start after the capture ended."""
    g3, launcher, capture = att.get("g3") or {}, att.get("launcher") or {}, att.get("capture") or {}
    try:
        exec_at = utc(json.loads(launcher.get("execLine") or "{}").get("atUTC"))
    except ValueError:
        exec_at = None
    t0_end, t1_start = utc((g3.get("tMinus0") or {}).get("shellEndUTC")), utc((g3.get("tPlus0") or {}).get("shellStartUTC"))
    cap_end = utc(capture.get("endedAtUTC"))
    if None in (exec_at, t0_end, t1_start, cap_end):
        return ["order_times_unparseable"]
    r = []
    if not t0_end <= exec_at:
        r.append("tMinus0_g3_not_before_exec")
    if not cap_end <= t1_start:
        r.append("tPlus0_g3_not_after_capture_end")
    return r


def check(path, name, expect=None):
    """expect: test seam only (the dress rehearsal's stub node and fake web/); the CLI always uses EXPECT."""
    cand, expect = CANDIDATES[name], expect or EXPECT
    with open(path, encoding="utf-8") as handle:
        att = json.load(handle)
    r = []
    if att.get("version") != "fhfh.blsh.operator-attestation.v1":
        r.append("attestation_version")
    if att.get("candidate") != name:
        r.append("attestation_candidate_mismatch")
    g3 = att.get("g3") or {}
    r += g3_reasons(g3.get("tMinus0") or {}, "tMinus0", cand) + g3_reasons(g3.get("tPlus0") or {}, "tPlus0", cand)
    if g3.get("bothMatch") is not True:
        r.append("stored_bothMatch_not_true")
    launcher = att.get("launcher") or {}
    r += launcher_reasons(launcher, cand, expect)
    if launcher.get("execLine"):
        r += order_reasons(att)
    if launcher.get("dyldKeysPresent") is not False:
        r.append("stored_dyldKeysPresent_not_false")
    return {"conversion": "reject" if r else "accept", "reasons": r}


def main(argv):
    try:
        if len(argv) == 5 and argv[0] == "write" and argv[1] == "--candidate" and argv[2] in CANDIDATES and argv[3] == "--dir":
            result = write(os.path.abspath(argv[4]), argv[2])
            print(json.dumps(result, sort_keys=True))
            return 0
        if len(argv) == 4 and argv[0] == "check" and argv[1] == "--candidate" and argv[2] in CANDIDATES:
            result = check(argv[3], argv[2])
            print(json.dumps(result, sort_keys=True))
            return 0 if result["conversion"] == "accept" else 1
        raise Refuse("usage")
    except Refuse as refusal:
        print(json.dumps({"attestation": "refuse", "code": str(refusal)}))
        return 2
    except Exception as error:
        print(json.dumps({"attestation": "refuse", "code": "unexpected_" + type(error).__name__}))
        return 2


if __name__ == "__main__":
    if not sys.flags.isolated:
        sys.stdout.write('{"attestation": "refuse", "code": "not_isolated"}\n')
        sys.exit(2)
    sys.exit(main(sys.argv[1:]))
