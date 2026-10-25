import { createLineSourceIftttReceiver } from "lib/sources/lineSourceIftttReceiver";

export default createLineSourceIftttReceiver({
  sourceGroup: "nhl_rosters",
  sourceKey: "nhl_rosters",
  sourceAccount: "NHL_Rosters",
  enforceSourceAccount: true,
  secretEnvVar: "IFTTT_NHL_ROSTERS_WEBHOOK_SECRET",
  processorPath: "/api/v1/db/update-line-sources",
});
