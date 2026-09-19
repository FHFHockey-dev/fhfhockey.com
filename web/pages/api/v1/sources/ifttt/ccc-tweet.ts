import { createLineSourceIftttReceiver } from "lib/sources/lineSourceIftttReceiver";

export default createLineSourceIftttReceiver({
  sourceGroup: "ccc", sourceKey: "ccc", sourceAccount: "CcCMiddleton",
  secretEnvVar: "IFTTT_CCC_WEBHOOK_SECRET",
  processorPath: "/api/v1/db/update-lines-ccc",
  eventTable: "lines_ccc_ifttt_events",
});
