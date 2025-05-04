import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer"; // email lib

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1) Grab all your jobs’ last run from cron.job_run_details
  const { data: runs, error: runErr } = await supabase
    .from("cron.job_run_details")
    .select("jobname, scheduled_time, start_time, end_time, status, result")
    .gte(
      "scheduled_time",
      new Date(new Date().setDate(new Date().getDate() - 1))
    )
    .order("scheduled_time", { ascending: true });

  if (runErr) return res.status(500).json({ error: runErr.message });

  // 2) Grab your audit rows (rows_affected) from cron_job_audit
  const { data: audits, error: auditErr } = await supabase
    .from("cron_job_audit")
    .select("job_name, run_time, status, rows_affected")
    .gte("run_time", new Date(new Date().setDate(new Date().getDate() - 1)))
    .order("run_time", { ascending: true });

  if (auditErr) return res.status(500).json({ error: auditErr.message });

  // 3) Build an HTML/plain-text summary
  let html = `<h1>Cron Job Report — last 24h</h1><table border="1" cellpadding="4">
    <tr><th>Job</th><th>Scheduled</th><th>Status</th><th>Rows</th></tr>`;
  for (let r of runs) {
    const a = audits.find(
      (a) =>
        a.job_name === r.jobname &&
        Math.abs(
          new Date(a.run_time).getTime() - new Date(r.scheduled_time).getTime()
        ) <
          5 * 60 * 1000
    );
    html += `<tr>
      <td>${r.jobname}</td>
      <td>${new Date(r.scheduled_time).toLocaleString()}</td>
      <td>${r.status}</td>
      <td>${a ? a.rows_affected : "—"}</td>
    </tr>`;
  }
  html += `</table>`;

  // 4) Send yourself an email
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +process.env.SMTP_PORT!,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: '"FHFH Crons" <cron@fhfhockey.com>',
    to: "timBranson515@gmail.com",
    subject: "✅ Daily Cron Job Report",
    html
  });

  return res.status(200).json({ success: true });
}
