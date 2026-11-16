Reproduce the successor rehearsal (offline; empty scratch dir; sockets, TLS, DNS and fetch are blocked in-process; env -i):

    REHEARSAL_WEB=<fresh export with SUCCESSOR.patch>/web REHEARSAL_DATE=2026-11-11 CLOCK=2026-11-13T01:00:00.000Z \
      EXTRA_SCENARIOS="tls_missing_admission tls_missing_nst tls_resumed_ok tls_keepalive_ok tls_resumed_no_prior tls_resumed_unauthorized" \
      EXTRA_TAMPERS="tls_strip strip_runtime" RESULTS_OUT=$PWD/RESULTS.jsonl ./run-rehearsal.sh <empty scratch>

expected-pins.json holds the nine runtime roles of the successor. verify-packet.mjs always requires the TLS observations, their bindings and RUNTIME.json. Earlier harnesses and results are in ../superseded/.
