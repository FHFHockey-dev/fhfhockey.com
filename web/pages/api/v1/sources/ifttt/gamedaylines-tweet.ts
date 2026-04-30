import { createLineSourceIftttReceiver } from "lib/sources/lineSourceIftttReceiver";

export default createLineSourceIftttReceiver({
  sourceGroup: "gdl_suite",
  sourceKey: "gamedaylines",
  sourceAccount: "GameDayLines",
  secretEnvVar: "IFTTT_GAMEDAYLINES_WEBHOOK_SECRET",
  processorPath: "/api/v1/db/update-line-sources",
});
