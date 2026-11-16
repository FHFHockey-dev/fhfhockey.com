Reproduce the successor rehearsal (offline; empty scratch dir; sockets, TLS connect, DNS and fetch are blocked in-process; env -i):

    REHEARSAL_WEB=<fresh export with SUCCESSOR.patch>/web REHEARSAL_DATE=2026-11-11 CLOCK=2026-11-13T01:00:00.000Z \
      EXTRA_SCENARIOS="tls_missing_admission tls_missing_nst tls_resumed_ok tls_keepalive_ok tls_resumed_no_prior tls_resumed_unauthorized lifecycle_key_false ca_store_swap_during ca_store_swap_between dispatcher_swap_before_start dispatcher_swap_between dispatcher_swap_during" \
      EXTRA_TAMPERS="tls_strip strip_runtime runtime_bootstrap_edit runtime_openssl_flip runtime_lifecycle_flip runtime_extra_key settled_ca_edit runtime_dispatcher_flip settled_dispatcher_edit" \
      RESULTS_OUT=$PWD/RESULTS.jsonl ./run-rehearsal.sh <empty scratch>

expected-pins.json holds the nine runtime roles plus _bootstrapSHA256. verify-packet.mjs always requires TLS observations, their bindings, the per-operation CA-store hash and dispatcher identity, and a complete RUNTIME.json; launch-by-bootstrap is required except with --synthetic-adapter-ok. Earlier harnesses and results are in ../superseded/.
