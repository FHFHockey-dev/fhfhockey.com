# User-run read-only schedule inspection

This script has not been executed by the agent. It sends at most one authenticated POST with dryRun=true to the verified production endpoint, with the approved57-game/114-side scope. It cannot submit a write request, repin, retry or follow a redirect. It saves no files, credentials, cookies, headers or raw response.

On your Mac, open a private unrecorded Terminal and run:

```sh
python3 /Users/tim/Code/fhfhockey.com/tasks/artifacts/rso-consumer-checkpoint-2026-10-13/inspect-approved-schedule.py
```

Do not add an argument, environment variable, shell header, redirect, tee or trace flag containing authentication. The command above contains no credential and is safe in shell history. The private bearer prompt is not echoed or entered into shell history. If terminal echo cannot be disabled, the script stops before reading a credential. Do not use a recorded/shared terminal or screen-sharing session while supplying authentication.

First confirm the PUBLIC deployed NEXT_PUBLIC_SUPABASE_URL from your existing operator configuration and enter only its URL. It must equal https://fyhftlxokyjtpndbkfse.supabase.co. The prepared Supabase project and production route/source were verified, but this deployed environment override remains an unresolved precondition; the agent has not read it from a secret-bearing store. Do not enter a key at this prompt.

At the hidden prompt, privately supply an existing admin-session bearer or cron bearer from your trusted operator client, token value only (without the word Bearer). This is not your website password. Do not paste it into chat, the shell command, a file or a screenshot. If you do not have that existing authentication, cancel with Ctrl-C; signing into the website alone does not provide this script a token. The script does not inspect session/browser storage, read .env files or create access.

It passes authentication to system curl through an in-memory stdin pipe, never process arguments or a saved config. curl's user config is disabled; normal TLS verification is retained. Fixed endpoint/HTTPS only, no redirects/cookies/verbose logs/retries,10-second connect limit and245-second request limit. Do not rerun automatically on failure.

Share only the printed sanitized JSON result: HTTP status, exact scope checks, fresh content hash, planned count and zero-write facts. Do not share terminal input or request headers. The script suppresses raw response/error text. An unsuccessful request stops; it never retries or changes to dryRun=false. No audit insert occurs on the route's inspection branch.

The original stopped drift attempt remains intact. A successful current inspection may produce a separate packet within the already-approved identities/dates/114-side/audit scope. Return that output for review; do not execute a write yourself from this script. Actual write access and same-scope guarded execution remain coordinated separately.
