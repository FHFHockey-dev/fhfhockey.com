/**
 * Pinned Ed25519 public keys of the independent FORGE witness (the Supabase Edge Function forge-witness-verify), as
 * keyId → base64url of the raw 32-byte key. keyId = first 16 hex of sha256(raw key). This file is the ONLY trust root
 * for signed verdicts: a key stored in the database, Vault or env is never trusted.
 *
 * EMPTY until the operator runs tasks/artifacts/forge-witness-signed-2026-11-19/witness_signing_keygen.mjs (which sets
 * the private key as an Edge secret without printing it) and a reviewed commit pins the printed public key here. While
 * empty, every signed verdict is refused (fail closed).
 */
export const WITNESS_SIGNING_KEYS: Record<string, string> = {};
