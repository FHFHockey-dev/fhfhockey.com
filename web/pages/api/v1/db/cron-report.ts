// web/pages/api/v1/db/cron-report.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { CronReportEmail } from "components/CronReportEmail/CronReportEmail";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Make sure you’ve set RESEND_API_KEY in .env.local
const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1) Fetch last 24h runs
  const { data: runs, error: runErr } = await supabase
    .from("cron.job_run_details")
    .select("jobname, scheduled_time, status")
    .gte("scheduled_time", new Date(Date.now() - 24 * 60 * 60 * 1000))
    .order("scheduled_time", { ascending: true });

  if (runErr) return res.status(500).json({ error: runErr.message });

  // 2) Fetch your audit rows
  const { data: audits, error: auditErr } = await supabase
    .from("cron_job_audit")
    .select("job_name, run_time, rows_affected")
    .gte("run_time", new Date(Date.now() - 24 * 60 * 60 * 1000))
    .order("run_time", { ascending: true });

  if (auditErr) return res.status(500).json({ error: auditErr.message });

  // 3) Build the array for your React template
  const rows = (runs ?? []).map((r) => {
    const match = (audits ?? []).find(
      (a) =>
        a.job_name === r.jobname &&
        Math.abs(
          new Date(a.run_time).getTime() - new Date(r.scheduled_time).getTime()
        ) <
          5 * 60 * 1000
    );
    return {
      jobname: r.jobname,
      scheduled: new Date(r.scheduled_time).toLocaleString(),
      status: r.status,
      rowsAffected: match?.rows_affected ?? null
    };
  });

  // 4) Send it via Resend
  const { data, error } = await resend.emails.send({
    from: "cron@fhfhockey.com",
    to: "timBranson515@gmail.com",
    subject: "✅ Daily Cron Job Report",
    react: CronReportEmail({ rows })
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // 5) Return the result
  return res.status(200).json({
    success: true,
    emailId: data?.id
  });
}
