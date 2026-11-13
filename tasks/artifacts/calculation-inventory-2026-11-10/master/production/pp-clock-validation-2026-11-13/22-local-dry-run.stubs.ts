// Decision 152 local dry run (F11): stand-ins for the three request wrappers around the candidate routes, so the
// bundle never builds a Supabase client or reads a service key. The route and writer code itself is unchanged.
//   esbuild --alias:utils/adminOnlyMiddleware=<this file> --alias:lib/cron/withCronJobAudit=<this file>
//           --alias:lib/cron/nhlOffSeason=<this file>
const passThrough = (handler: any) => handler;
export default passThrough;
export const withCronJobAudit = passThrough;
export const withNhlOffSeasonSkip = passThrough;
