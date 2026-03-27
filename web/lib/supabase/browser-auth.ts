import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_STORAGE_KEY_PATTERNS = [
  /^sb-.*auth-token/i,
  /^sb-.*code-verifier/i,
  /^fhfh-public-readonly-supabase$/i,
  /^fhfh:post-password-reset-next$/i,
];

function clearMatchingStorage(storage: Storage | undefined) {
  if (!storage) {
    return;
  }

  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (
      key &&
      SUPABASE_STORAGE_KEY_PATTERNS.some((pattern) => pattern.test(key))
    ) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = window.setTimeout(() => {
      reject(new Error("Timed out while resetting the local auth session."));
    }, timeoutMs);

    promise
      .then((value) => {
        window.clearTimeout(timeoutHandle);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

export async function resetSupabaseBrowserAuthState(
  supabase: SupabaseClient,
  timeoutMs = 5000
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await withTimeout(supabase.auth.signOut({ scope: "local" }), timeoutMs);
  } catch {
    // Fall through to storage cleanup even if the auth client is already wedged.
  }

  clearMatchingStorage(window.localStorage);
  clearMatchingStorage(window.sessionStorage);
}
