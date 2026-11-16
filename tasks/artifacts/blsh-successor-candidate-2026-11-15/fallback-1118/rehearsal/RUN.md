Fallback v5-1118 rehearsal (offline; empty scratch dir; sockets, TLS connect, DNS and fetch blocked in-process; env -i).
rehearse.ts, verify-packet.mjs and run-rehearsal.sh are byte copies of ../../rehearsal/ (v5). Only expected-pins.json differs (_bootstrapSHA256 849009ee…).

    REHEARSAL_WEB=<fresh git archive of 348a122d6 + FALLBACK.patch>/web REHEARSAL_DATE=2026-11-11 CLOCK=2026-11-18T14:05:30.000Z \
      EXTRA_SCENARIOS="tls_missing_admission tls_missing_nst tls_resumed_ok tls_keepalive_ok tls_resumed_no_prior tls_resumed_unauthorized lifecycle_key_false ca_store_swap_during ca_store_swap_between dispatcher_swap_before_start dispatcher_swap_between dispatcher_swap_during" \
      EXTRA_TAMPERS="tls_strip strip_runtime runtime_bootstrap_edit runtime_openssl_flip runtime_lifecycle_flip runtime_extra_key settled_ca_edit runtime_dispatcher_flip settled_dispatcher_edit" \
      RESULTS_OUT=$PWD/RESULTS.jsonl ./run-rehearsal.sh <empty scratch>

Result: 41 lines, outcome-identical to ../../rehearsal/RESULTS.jsonl (0 differences). The one "Killed: 9" in run-stderr.log is the deliberate `interrupted` scenario.
CROSS-PINS.txt: the fallback happy packet is vetoed with the v5 pins (runtime_bootstrap_not_candidate) and accepted with these pins.
