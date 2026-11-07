import type { NextApiRequest, NextApiResponse } from "next";
import serviceRoleClient from "lib/supabase/server";
import type { IftttRpcClient } from "lib/sources/iftttRpcDeadline";
import { createHostedLunaHandler } from "lib/sources/lunaHosted/handler";
import { createHostedLunaStore } from "lib/sources/lunaHosted/store";
import { bindWorkerRuntimeStore, readWorkerRuntimeConfig, workerRuntimeStillEnabled } from "lib/sources/lunaHosted/runtimeConfig";

export const config = { api: { bodyParser: { sizeLimit: "1kb" } } };

// Separate default-off activation; capture never dispatches this worker.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const policy = readWorkerRuntimeConfig(process.env);
  return createHostedLunaHandler({
    enabled: () => workerRuntimeStillEnabled(process.env, policy),
    workerSecret: () => process.env.IFTTT_LUNA_WORKER_SECRET,
    store: () => {
      if (!policy) throw new Error("runtime_disabled");
      return bindWorkerRuntimeStore(createHostedLunaStore(serviceRoleClient as unknown as IftttRpcClient), policy);
    },
    apiKey: () => process.env.OPENAI_API_KEY,
  })(req, res);
}
