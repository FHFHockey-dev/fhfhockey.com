# Accepted S03-R1 local preview handoff

**Refresh http://127.0.0.1:3125/player-cards to load the exact accepted R1 fixture preview.** No new source, renderer, visual iteration or application integration was introduced in this handoff.

## What is served

- Exact reviewed HTML:318626bytes, SHA256`6c29f6eb3dc6ffc9a6a8a546423f78ac3e6e5e1e7265129475724422d3aad9b5`.
- Canonical reviewed artifact remains `tasks/artifacts/player-cards-2026-10-24/slice-03-r1/preview.html`; the served file is a byte-identical copy in this handoff folder. The static server is a byte-identical copy of the existing bounded S03 server.
- Missing-source/short-sample explanations, known-undefined wording and GP-unverified accessible name are the accepted PC-S03-02/01 correction. Scout accepted that bounded correction from `slice-03-r1-review/REVIEW.md`:8focused tests,4offline browser groups and161unchanged pins. No calculation or design acceptance was broadened.
- Returned bytes retain “SYNTHETIC FIXTURE,” fabricated-data wording and “Live data and premium activation remain off.” The artifact has no shared app/auth/provider access; only the existing static GET routes on loopback3125 are served.

## Current process and lifecycle

Current recorded PID: **81978**, command `/usr/local/bin/node .../slice-03-r1-preview-handoff/serve-preview.mjs`; loopback `127.0.0.1:3125` only. There is **no current unified-exec session** for this process.

Parent asked for a persistent workflow after earlier previews disappeared. `start-persistent-preview.py` launched a plain background process with `subprocess.Popen(start_new_session=True)`, stdin disconnected and stdout/stderr in `server.log`. The launcher returned exit0. A separate later tool invocation observed **PPID1 / PGID81978 / no controlling TTY**, and lsof confirmed the sole loopback listener. This verifies independence from the launching shell/session.

**Post-turn survival has not yet been observed.** The coordinator was asked to check once after this handoff turn ends. Host shutdown, execution-environment cleanup or explicit termination can stop the process. There is no auto-restart, launch daemon, login item, cron, security/configuration change or claim of reboot persistence. If it disappears, report that lifecycle limit; do not silently start another instance or touch another listener.

## Ownership actions and checks

1. Read the accepted independent R1 review, checked the exact candidate hash/source pins and current resource reservation; coordinated the accepted content transition.
2. Initial fresh lsof found no3125listener. Historical76261 was not found or killed. The guarded first start served exactR1 asPID81671/session93754; first staticGET matched reviewed bytes.
3. On the parent's persistent-lifecycle steer, a fresh lsof/session check found81671 still alive. The persistent handoff revalidated its exact owned command, stopped **only that own PID81671**, verified the port free, then launched81978 once. No unowned or unrelated process was controlled.
4. Separate post-launch metadata/lsof check passed. One post-launch credential-free staticGET returned200,318626bytes, exact reviewed SHA/byte equality and synthetic/inactive labels. Two worker-issued local GETs total in this handoff; zero production/provider/service requests. No additional browser, tests or builds were needed for byte-identical serving.
5. All161 independent re-review pins remain unchanged. No reviewed/frozen source, report, failure evidence or existing packet was edited. Startup/process/readback receipts retain the first and final lifecycle states.

Evidence: `startup.json`, `initial-runtime.json`, `initial-readback.json`, `persistent-startup.json`, `persistent-process.json`, `persistent-readback.json`, `runtime.json`, `OWNERSHIP.json`, and `EVIDENCE.json`. `server.log` is an operational log and may grow after the checkpoint.

## Remaining gates

- TJ's design direction/reference response and phone/share-size readability feedback are still pending. No new visual iteration.
- Real observed-source/history/completion/model/strength/full all-NHL population/rights proof remains unverified. The18-player pool and all game/source proof data are synthetic.
- Canonical app route, real player search/shared auth and entitlement integration, exact metric/paywall allocation and premium protected data/export/comparison remain inactive/unapproved.
- No live data, production operation, publication/deployment, Library retry/workaround, dependency/permission change, Git action or new worker.
- Current availability is verified only at the recorded checks; the explicit post-turn lifecycle check remains with the coordinator.
