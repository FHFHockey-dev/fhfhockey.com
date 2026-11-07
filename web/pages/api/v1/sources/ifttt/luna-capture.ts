import type { NextApiRequest, NextApiResponse } from "next";
import serviceRoleClient from "lib/supabase/server";
import type { IftttRpcClient } from "lib/sources/iftttRpcDeadline";
import { createIsolatedLunaCaptureHandler } from "lib/sources/lunaHosted/capture";
import { createLunaArchiveStore } from "lib/sources/lunaHosted/archiveStore";
import { captureRuntimeStillEnabled, readCaptureRuntimeConfig } from "lib/sources/lunaHosted/runtimeConfig";

// Raw bytes are read only after the default-off gate and dedicated header auth.
export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const policy = readCaptureRuntimeConfig(process.env);
  return createIsolatedLunaCaptureHandler({
    enabled: () => captureRuntimeStillEnabled(process.env, policy),
    secret: () => process.env.IFTTT_LUNA_CAPTURE_SECRET,
    scope: () => policy?.scope,
    store: () => createLunaArchiveStore(serviceRoleClient as unknown as IftttRpcClient),
  })(req, res);
}
