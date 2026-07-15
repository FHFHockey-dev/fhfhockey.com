export type ConsumedAuthCallbackLocation = {
  nextValue: string | null;
  hasProviderError: boolean;
  code: string | null;
  tokenHash: string | null;
  verificationType: string;
  accessToken: string | null;
  refreshToken: string | null;
};

type NextHistoryState = Record<string, unknown> & {
  url?: unknown;
  as?: unknown;
};

const AUTH_QUERY_KEYS_TO_SCRUB = new Set([
  "access_token",
  "id_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
  "expires_at",
  "expires_in",
  "token_type",
  "code",
  "token_hash",
  "state",
  "error",
  "error_code",
  "error_description",
  "type"
]);

export function navigateToAuthFallback(
  replaceRoute: (url: string) => unknown,
  currentWindow: Window = window
) {
  try {
    const navigation = replaceRoute("/auth");
    void Promise.resolve(navigation)
      .then((didNavigate) => {
        if (didNavigate === false) {
          currentWindow.location.replace("/auth");
        }
      })
      .catch(() => {
        currentWindow.location.replace("/auth");
      });
  } catch {
    currentWindow.location.replace("/auth");
  }
}

function sanitizeHistoryState(state: unknown, safeRelativeUrl: string) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return state;
  }

  const nextState: NextHistoryState = { ...(state as NextHistoryState) };
  if (typeof nextState.url === "string") {
    nextState.url = safeRelativeUrl;
  }
  if (typeof nextState.as === "string") {
    nextState.as = safeRelativeUrl;
  }

  return nextState;
}

export function sanitizeAuthReturnPath(nextValue: string | null | undefined, fallback = "/") {
  if (!nextValue || !nextValue.startsWith("/") || nextValue.startsWith("//")) {
    return fallback;
  }

  try {
    const returnUrl = new URL(nextValue, "https://fhfh.invalid");
    const decodedPathname = decodeURIComponent(returnUrl.pathname);
    if (
      returnUrl.origin !== "https://fhfh.invalid" ||
      /^\/auth\/(?:callback|reset-password)(?:\/|$)/i.test(decodedPathname)
    ) {
      return fallback;
    }

    returnUrl.hash = "";
    for (const key of Array.from(returnUrl.searchParams.keys())) {
      if (AUTH_QUERY_KEYS_TO_SCRUB.has(key.toLowerCase())) {
        returnUrl.searchParams.delete(key);
      }
    }

    return `${returnUrl.pathname}${returnUrl.search}`;
  } catch {
    return fallback;
  }
}

/**
 * Capture callback credentials once, then immediately remove them from the
 * browser-visible URL before any asynchronous session exchange begins.
 */
export function consumeAuthCallbackLocation(
  currentWindow: Window = window
): ConsumedAuthCallbackLocation {
  const url = new URL(currentWindow.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
  const safeUrl = new URL(url.pathname, url.origin);

  const currentRelativeUrl = `${url.pathname}${url.search}${url.hash}`;
  const safeRelativeUrl = `${safeUrl.pathname}${safeUrl.search}`;
  const historyState = currentWindow.history.state as NextHistoryState | null;
  const historyStateNeedsScrub = Boolean(
    historyState &&
    ((typeof historyState.url === "string" && historyState.url !== safeRelativeUrl) ||
      (typeof historyState.as === "string" && historyState.as !== safeRelativeUrl))
  );

  if (safeRelativeUrl !== currentRelativeUrl || historyStateNeedsScrub) {
    currentWindow.history.replaceState(
      sanitizeHistoryState(historyState, safeRelativeUrl),
      "",
      safeRelativeUrl
    );
  }

  return {
    nextValue: url.searchParams.get("next") || hashParams.get("next"),
    hasProviderError: Boolean(
      url.searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      url.searchParams.get("error") ||
      hashParams.get("error")
    ),
    code: url.searchParams.get("code"),
    tokenHash: url.searchParams.get("token_hash") || hashParams.get("token_hash"),
    verificationType: url.searchParams.get("type") || hashParams.get("type") || "",
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token")
  };
}
