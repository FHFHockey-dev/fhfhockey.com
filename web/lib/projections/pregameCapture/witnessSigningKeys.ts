/**
 * Pinned Ed25519 public keys of the independent FORGE witness (the Supabase Edge Function forge-witness-verify), as
 * keyId → base64url of the raw 32-byte key. keyId = first 16 hex of sha256(raw key). This file is the ONLY trust root
 * for signed verdicts: a key stored in the database, Vault or env is never trusted.
 *
 * Pinned keys (fail closed for any other key):
 *   469bc6093b6ffc11: generated 2026-11-20 ~00:23Z on TJ's Mac with TJ's approval; public-key sha256
 *     469bc6093b6ffc1193818639185de8fb4781fe43965f9ee292b0e62d16b11a47. The private key was written once to a 0600 file
 *     for the Edge secret FORGE_WITNESS_SIGNING_KEY and never printed. Rotate with witness_signing_keygen.mjs.
 */
export const WITNESS_SIGNING_KEYS: Record<string, string> = {
  "469bc6093b6ffc11": "VYVqYwX4rW-wgYtCc5PAvWrXZy8RAc06E6U96R3eGc4",
};
