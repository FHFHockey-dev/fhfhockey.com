import type { NextApiRequest, NextApiResponse } from "next";

import {
  buildPatreonAccountRedirect,
  exchangePatreonAuthorizationCode,
  PatreonApiError,
  verifyPatreonOAuthState,
} from "lib/integrations/patreon/oauth";
import { connectPatreonAccount } from "lib/integrations/patreon/sync";
import { PATREON_CONNECT_DEFAULT_NEXT } from "lib/integrations/patreon/config";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let next = PATREON_CONNECT_DEFAULT_NEXT;
  try {
    const state = verifyPatreonOAuthState(req.query.state);
    next = state.next;
    if (req.query.error) {
      const providerError = Array.isArray(req.query.error)
        ? req.query.error[0]
        : req.query.error;
      return res.redirect(
        buildPatreonAccountRedirect(
          next,
          "error",
          `Patreon authorization failed: ${providerError}`,
        ),
      );
    }

    const code = Array.isArray(req.query.code)
      ? req.query.code[0]
      : req.query.code;
    if (!code) {
      return res.redirect(
        buildPatreonAccountRedirect(
          next,
          "error",
          "Patreon did not return an authorization code.",
        ),
      );
    }
    const token = await exchangePatreonAuthorizationCode(req, code);
    const result = await connectPatreonAccount({ userId: state.userId, token });
    const message = result.snapshot.isEligibleSupporter
      ? "Patreon linked and supporter eligibility is active."
      : "Patreon linked. No active paid supporter entitlement was found for the configured campaign.";
    return res.redirect(
      buildPatreonAccountRedirect(next, "connected", message),
    );
  } catch (error) {
    // The message lands in the account page URL, so only Patreon's own 4xx
    // text (state and authorization problems) is passed through.
    const isPatreonClientError =
      error instanceof PatreonApiError && error.statusCode < 500;
    if (!isPatreonClientError) {
      console.error("Patreon callback failed", error);
    }
    const message = isPatreonClientError
      ? (error as PatreonApiError).message
      : "Patreon connection could not be completed.";
    return res.redirect(buildPatreonAccountRedirect(next, "error", message));
  }
}
