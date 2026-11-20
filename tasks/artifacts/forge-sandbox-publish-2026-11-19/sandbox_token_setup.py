#!/usr/bin/env python3
"""Operator-only (with TJ's approval): mint FORGE_SANDBOX_API_TOKEN and hand it to Vercel without printing it.

The project's legacy HS256 JWT secret is read from stdin, and from nowhere else. The script signs
{"role": "forge_sandbox_api", "iat": now, "exp": now + hours} with hours capped at 12, then pipes the token on stdin
into `vercel env add FORGE_SANDBOX_API_TOKEN production --sensitive`. Neither the secret nor the token is printed,
written or put in argv; the app never sees the secret. --dry-run sends the token to a sink and reports only its claims.
If the project signs with asymmetric JWT signing keys instead, mint the token with Supabase's tooling for that key and
pipe it to the same command.

Example (from web/):
  pbpaste | python3 -I ../tasks/artifacts/forge-sandbox-publish-2026-11-19/sandbox_token_setup.py --hours 11 \\
    --vercel ../functions/node_modules/.bin/vercel
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
    ap.add_argument("--vercel", default="vercel")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not 0 < args.hours <= 12:
        ap.error("--hours must be in (0, 12]")
    secret = sys.stdin.read().strip()
    if len(secret) < 32:
        raise SystemExit("expected the project JWT secret on stdin")
    now = int(time.time())
    claims = {"role": "forge_sandbox_api", "iat": now, "exp": now + int(args.hours * 3600)}
    b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=")
    body = b".".join([b64(b'{"alg":"HS256","typ":"JWT"}'), b64(json.dumps(claims, separators=(",", ":")).encode())])
    token = body + b"." + b64(hmac.new(secret.encode(), body, hashlib.sha256).digest())
    del secret
    command = ["cat"] if args.dry_run else [args.vercel, "env", "add", "FORGE_SANDBOX_API_TOKEN", "production", "--sensitive"]
    done = subprocess.run(command, input=token, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if done.returncode:
        raise SystemExit(f"command failed ({done.returncode}): {done.stderr.decode()[-500:]}")
    print(f"FORGE_SANDBOX_API_TOKEN: {'dry run, ' if args.dry_run else ''}{len(token)} bytes sent on stdin; claims {json.dumps(claims)}")


if __name__ == "__main__":
    main()
