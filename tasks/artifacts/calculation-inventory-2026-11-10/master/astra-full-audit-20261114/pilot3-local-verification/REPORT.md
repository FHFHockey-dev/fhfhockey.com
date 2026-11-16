# Pilot3 local custody verification — passed

TJ directly approved the local check in call_2beaf6a2f149491c99bee823cd9e74d4. Read only the retained pilot directory; no database or provider call.

OpenSSL4.1.0 independently returned **Verification: OK** for the retained timestamp token over the exact witness-statement bytes, against the DigiCert G4 public root pinned at candidate29451c57304866d54abd2a3302625f0696472ab0. The exact candidate verifier also validated nonce, imprint, signer, policy and conservative time bound. Raw/canonical packet hashes, statement hash, byte length, claim/game/policy/row-version/candidate bindings match the retained evidence. Full digests and the local probe are in result.json/check.cjs. No private packet content was copied into audit output.

Conservative bound:2026-11-15T20:11:33Z; inside the retained T−60 deadline. This supports the retained cryptographic custody claim. A fresh database read, present-day stored-row equality, native-input completeness beyond the reviewed contract, model correctness, release acceptance and new execution remain separate/unverified.
