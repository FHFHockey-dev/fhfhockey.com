import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { requireApiUser } from "lib/api/requireApiUser";
import { createDraftProRefundRequest, getPublicDraftProRefundFailure } from "lib/draft-pro/account/refunds";
import { createDraftProRefundRequestSchema } from "lib/draft-pro/contracts";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "method_not_allowed" } });
  }
  const user = await requireApiUser(req, res, {
    onUnauthorized: (message) => res.status(401).json({ error: { code: "authentication_required", message } }),
  });
  if (!user) return;
  try {
    const input = createDraftProRefundRequestSchema.parse(req.body ?? {});
    const data = await createDraftProRefundRequest({ userId: user.id, accountEmail: user.email ?? "Unavailable", input });
    return res.status(201).json({ data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: { code: "validation_error", message: "Invalid refund request." } });
    }
    const failure = getPublicDraftProRefundFailure(error);
    if (failure) {
      return res.status(failure.statusCode).json({ error: { code: failure.code, message: failure.message } });
    }
    return res.status(500).json({ error: { code: "refund_request_failed", message: "Refund request could not be submitted." } });
  }
}
