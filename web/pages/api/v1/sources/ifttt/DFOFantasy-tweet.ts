import { createLineSourceIftttReceiver } from "lib/sources/lineSourceIftttReceiver";

export default createLineSourceIftttReceiver({
  sourceGroup: "dfo",
  sourceKey: "dfofantasy",
  sourceAccount: "DFOFantasy",
  enforceSourceAccount: true,
  secretEnvVar: "IFTTT_DFOFANTASY_WEBHOOK_SECRET",
  processorPath: "/api/v1/db/update-line-sources",
});
