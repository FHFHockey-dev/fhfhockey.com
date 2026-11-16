"""BLSH pilot: write the private authorization receipt that the v5 bootstrap's --run reads (readAuthorization in
web/scripts/blsh/nativeProcessCaptureBootstrap.ts, bootstrap sha256 dbf69c47...). Offline; no credentials; no values.

    /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/python3 -I write-authorization-receipt.py --candidate v5-1117 --out <absolute .json path> \
        --approved-at <2026-11-DDTHH:MM:SS.mmmZ> --approval-reference <id> --runtime-receipt <id> \
        --coordination-receipt <id> --admission-receipt <id> [--bootstrap <bootstrap .ts path>]

--candidate v5-1117 pins bootstrap dbf69c47...; v5-1118 (the 2026-11-18 fallback, FALLBACK.patch 209b34eb...) pins 849009ee....
It mirrors the bootstrap's contract and refuses anything the bootstrap would refuse:
- exactly the 14 fields; version fhfh.blsh.native-pilot-authorization.v1; approvedBy "TJ";
- bootstrapSHA256 = sha256 of the bootstrap file, which must be the pinned v5 candidate;
- slotStartUTC, outputDirectory and supabaseOrigin equal the bootstrap's own constants (read from its source);
- lifecycleMode "disabled", maximumHTTPAttempts 5, operator claude-nst-operator.local_017907a3;
- the five reference fields match ^[A-Za-z0-9._:-]{1,200}$; approvedAtUTC matches ^2026-11-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$
  and is not in the future;
- the file is created with O_CREAT|O_EXCL|O_NOFOLLOW, mode 0600, at most 16,384 bytes; an existing file refuses.
Prints one JSON line (no values exist in the receipt: it holds IDs, hashes and fixed constants only).
"""
import datetime
import hashlib
import json
import os
import re
import sys

BOOTSTRAP = "/Users/tim/Code/fhfhockey.com/web/scripts/blsh/nativeProcessCaptureBootstrap.ts"
CANDIDATES = {"v5-1117": "dbf69c474bedefd9c34fbd783d4beccc1840e8288fd2fa3435b5d89e8521bb46",
              "v5-1118": "849009ee3b68527858f93512c050ef5d0c01c20ef740c9e62addec4df21b4465"}
OPERATOR = "claude-nst-operator.local_017907a3"
REF = re.compile(r"^[A-Za-z0-9._:-]{1,200}$")
WHEN = re.compile(r"^2026-11-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")


def refuse(code):
    sys.stdout.write(json.dumps({"receipt": "refuse", "code": code}) + "\n")
    sys.exit(2)


def main(argv):
    names = ["--candidate", "--out", "--approved-at", "--approval-reference", "--runtime-receipt", "--coordination-receipt", "--admission-receipt"]
    args, i = {}, 0
    while i < len(argv):
        if argv[i] not in names + ["--bootstrap"] or i + 1 >= len(argv) or argv[i] in args:
            refuse("usage")
        args[argv[i]] = argv[i + 1]
        i += 2
    if any(n not in args for n in names) or args["--candidate"] not in CANDIDATES:
        refuse("usage")
    bootstrap = args.get("--bootstrap", BOOTSTRAP)
    with open(bootstrap, "rb") as handle:
        source = handle.read()
    digest = hashlib.sha256(source).hexdigest()
    if digest != CANDIDATES[args["--candidate"]]:
        refuse("bootstrap_not_pinned_candidate")
    text = source.decode("utf-8")
    consts = {}
    for name in ("SLOT", "OUTPUT", "ORIGIN"):
        m = re.search(r'^const %s = "([^"]+)";$' % name, text, re.M)
        if not m:
            refuse("bootstrap_constant_unparsed:" + name)
        consts[name] = m.group(1)
    out = args["--out"]
    if not os.path.isabs(out) or not out.endswith(".json"):
        refuse("receipt_path")  # bootstrap_authorization_path
    if os.path.realpath(os.path.dirname(out)).startswith(os.path.realpath(consts["OUTPUT"])):
        refuse("receipt_inside_output_directory")
    for key in names[3:]:
        if not REF.match(args[key]):
            refuse("reference_shape:" + key.lstrip("-"))
    approved = args["--approved-at"]
    if not WHEN.match(approved):
        refuse("approved_at_shape")
    when = datetime.datetime.strptime(approved, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=datetime.timezone.utc)
    if when > datetime.datetime.now(datetime.timezone.utc):
        refuse("approved_at_in_future")
    receipt = {
        "version": "fhfh.blsh.native-pilot-authorization.v1",
        "approvedBy": "TJ",
        "approvedAtUTC": approved,
        "approvalReference": args["--approval-reference"],
        "operator": OPERATOR,
        "bootstrapSHA256": digest,
        "slotStartUTC": consts["SLOT"],
        "outputDirectory": consts["OUTPUT"],
        "supabaseOrigin": consts["ORIGIN"],
        "lifecycleMode": "disabled",
        "maximumHTTPAttempts": 5,
        "coordinationReceipt": args["--coordination-receipt"],
        "runtimeReceipt": args["--runtime-receipt"],
        "admissionReceipt": args["--admission-receipt"],
    }
    if not REF.match(OPERATOR):
        refuse("reference_shape:operator")
    data = (json.dumps(receipt, indent=1, sort_keys=True) + "\n").encode("utf-8")
    if len(data) > 16384:
        refuse("receipt_too_large")
    try:
        fd = os.open(out, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    except FileExistsError:
        refuse("receipt_exists")
    except OSError:
        refuse("receipt_unwritable")
    with os.fdopen(fd, "wb") as handle:
        handle.write(data)
    os.chmod(out, 0o600)  # umask cannot widen it; this only guarantees exactly 0600 as the bootstrap requires
    st = os.lstat(out)
    sys.stdout.write(json.dumps({"receipt": "written", "path": out, "mode": oct(st.st_mode & 0o777), "bytes": len(data),
                                 "sha256": hashlib.sha256(data).hexdigest(), "bootstrapSHA256": digest}, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    if not sys.flags.isolated:
        sys.stdout.write('{"code": "not_isolated", "receipt": "refuse"}\n')
        sys.exit(2)
    sys.exit(main(sys.argv[1:]))
