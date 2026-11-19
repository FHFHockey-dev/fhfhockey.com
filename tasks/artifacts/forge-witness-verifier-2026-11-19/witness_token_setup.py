#!/usr/bin/env python3
"""Operator-only (with TJ's approval): mint the verifier's Data API token and pipe it to psql, never printing it.

The project's legacy HS256 JWT secret is read from stdin, and from nowhere else. The script signs
{"role": "forge_witness_api", "iat": now, "exp": now + hours} with hours capped at 12 and writes ONLY the token to
stdout, which must be a pipe (into set-witness-credential.sql). The token is never put in Vercel env, Vault, argv or a
file: the FORGE writer can read Vercel env and Vault. --dry-run sends it to a sink and reports only its claims.

Example (from web/):
  pbpaste | python3 -I ../tasks/artifacts/forge-witness-verifier-2026-11-19/witness_token_setup.py --hours 11 --stdout \\
    | psql "<postgres connection>" -X -q -f ../tasks/artifacts/forge-witness-verifier-2026-11-19/set-witness-credential.sql
The token expires; mint a new one before any later run.
"""
import argparse
import base64
import hashlib
import hmac
import json
import subprocess
import sys
import time


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--hours", type=float, default=11)
    ap.add_argument("--stdout", action="store_true", help="write the token to stdout (must be a pipe)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not 0 < args.hours <= 12:
        ap.error("--hours must be in (0, 12]")
    secret = sys.stdin.read().strip()
    if len(secret) < 32:
        raise SystemExit("expected the project JWT secret on stdin")
    now = int(time.time())
    claims = {"role": "forge_witness_api", "iat": now, "exp": now + int(args.hours * 3600)}
    b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=")
    body = b".".join([b64(b'{"alg":"HS256","typ":"JWT"}'), b64(json.dumps(claims, separators=(",", ":")).encode())])
    token = body + b"." + b64(hmac.new(secret.encode(), body, hashlib.sha256).digest())
    del secret
    if args.dry_run:
        subprocess.run(["cat"], input=token, stdout=subprocess.DEVNULL, check=True)
        print(f"forge_witness_api token: dry run, {len(token)} bytes; claims {json.dumps(claims)}")
        return
    if not args.stdout or sys.stdout.isatty():
        raise SystemExit("refusing: pass --stdout and pipe stdout into psql -f set-witness-credential.sql")
    sys.stdout.buffer.write(token + b"\n")
    sys.stdout.flush()
    print(f"forge_witness_api token: {len(token)} bytes piped; claims {json.dumps(claims)}", file=sys.stderr)

if __name__ == "__main__":
    main()
