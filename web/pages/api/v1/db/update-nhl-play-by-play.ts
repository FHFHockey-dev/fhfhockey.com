import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { createNhlRawGamecenterRoute } from "lib/supabase/Upserts/nhlRawGamecenterRoute";
import adminOnly from "utils/adminOnlyMiddleware";

const handler = createNhlRawGamecenterRoute({
  routeName: "/api/v1/db/update-nhl-play-by-play",
  routeAlias: "play-by-play",
});

export default withCronJobAudit(adminOnly(handler), {
  jobName: "/api/v1/db/update-nhl-play-by-play",
});
