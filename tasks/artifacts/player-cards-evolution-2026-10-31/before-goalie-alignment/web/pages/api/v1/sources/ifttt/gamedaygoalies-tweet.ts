import { createLineSourceIftttReceiver } from "lib/sources/lineSourceIftttReceiver";

export default createLineSourceIftttReceiver({
  sourceGroup: "gdl_suite",
  sourceKey: "gamedaygoalies",
  sourceAccount: "GameDayGoalies",
  secretEnvVar: "IFTTT_GAMEDAYGOALIES_WEBHOOK_SECRET",
  processorPath: "/api/v1/db/update-line-sources",
});
