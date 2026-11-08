# BLSH native capture preparation

- Scope: local-only offline plan and retention packet for one current-season NST date; no network, provider/database requests, credentials, holdout, scoring, or production changes.
- Where: canonical octoberBranch at 45386c9a26178b33adc816daae8d479152085fa1. Own new nativeProcessCapture files and tasks/artifacts/blsh-native-capture-preparation-2026-11-07 only; preserve existing dirty tree.
- Start: inspected AGENTS, existing authenticated client and closed current-process evidence consumer. The client invokes shared global admission and consumes response.clone().text() without a streaming byte bound. No live executable can safely run under this scope.
- Decision: implement a concrete offline plan/packet retention seam, with unverified original observations explicitly separated from proof. No success receipt or accepted policy is minted. Document the exact minimal frozen-client patch needed before later execution.
- Checks: not run yet. Next: coordinate existing receipt intake, add narrow tests that prevent network/client/budget calls, inspect focused lint/types.
- Blocker: future live capture requires bounded body consumption inside the established client plus separately authorized shared admission writes; neither is performed here.

## Isolated client patch checkpoint

- Parent expanded the scope to an isolated, default-preserving optional bounded-body patch against pinned canonical client bytes. Latest CODEX-TO-CLAUDE mailbox was read; canonical client is clean at SHA256 48d82fc40ca06d9abe4675f4a1896add55c4e53d4dee661bbe082d424c944e4f. Claude NST custody remains; no canonical integration or live operation.
- Candidate source and unified diff are under the owned artifact directory. Opt-in reads the original body without a clone, caps accepted decoded bytes, aborts/cancels on overflow, preserves timeout/admission, and uses the uncached existing route for a bounded cache call. The OS/HTTP implementation can prefetch bytes/chunks; this is not an exact wire-byte ceiling.
- One initial focused-test invocation found no test because its creation command used the wrong owning-directory prefix; no test executed. Correcting the path before verification.

## Review correction and final verification

- Parent review corrected candidate-test placement: candidate-only tests/config/socket-block setup now live solely in the owned artifact directory. Ordinary web discovery lists only the independent preparation test. No canonical test/config file changed.
- Clarified accepted/retained decoded bytes versus already-delivered chunks/wire bytes. Plan now labels two provider attempts separately from uncapped-count, deadline-bounded shared-admission RPC polling. No claim of two ledger writes.
- Fixed actual Buffer/Uint8Array compatibility with explicit byte-preserving Uint8Array copies, not casts. Corrected harness mocking/module resolution; final 27 preparation + 37 candidate/legacy tests pass. Focused virtual-source repository-options types pass; scoped source lint passes. Artifact config has one non-blocking anonymous-default-export lint warning.
- Next: parent review of frozen manifest/HANDOFF. Live capture, shared-client integration and provider/DB authorization remain pending; no canonical frozen source or external state changed. No owned process/heavy lock remains after commands complete.
