import { createLineSourceIftttReceiver } from "lib/sources/lineSourceIftttReceiver";

export default createLineSourceIftttReceiver({
  sourceGroup: "gdl_suite",
  sourceKey: "gamedaynewsnhl",
  sourceAccount: "GameDayNewsNHL",
  secretEnvVar: "IFTTT_GAMEDAYNEWSNHL_WEBHOOK_SECRET",
  processorPath: "/api/v1/db/update-line-sources",
});
