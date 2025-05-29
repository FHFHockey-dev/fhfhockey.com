// web/pages/api/v1/db/cron-report.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { CronReportEmail } from "components/CronReportEmail/CronReportEmail"; // For job run details
import { CronAuditEmail } from "components/CronReportEmail/CronAuditEmail";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const emailRecipient = process.env.CRON_REPORT_EMAIL_RECIPIENT!;

  let jobRunDetailsEmailResult: any = null;
  let auditEmailResult: any = null;
  const errors: string[] = [];

  // 1. Fetch data for job_run_details (cron_job_report)
  const { data: runs, error: runErr } = await supabase
    .from("cron_job_report")
    .select("jobname, scheduled_time, status")
    .gte("scheduled_time", since)
    .order("scheduled_time", { ascending: true });

  if (runErr) {
    console.error("Error fetching cron_job_report:", runErr.message);
    // Not returning immediately, to allow audit email to proceed if desired
    errors.push(`Failed to fetch job run details: ${runErr.message}`);
  }

  // 2. Fetch data for cron_job_audit
  const { data: audits, error: auditErr } = await supabase
    .from("cron_job_audit")
    .select("job_name, run_time, rows_affected")
    .gte("run_time", since)
    .order("run_time", { ascending: true });

  if (auditErr) {
    console.error("Error fetching cron_job_audit:", auditErr.message);
    errors.push(`Failed to fetch cron job audit: ${auditErr.message}`);
  }

  // 3. Send Cron Job Audit Email
  if (audits && audits.length > 0) {
    const formattedAudits = audits.map((a) => ({
      job_name: a.job_name,
      run_time: a.run_time, // Keep as ISO string, component can format
      rows_affected: a.rows_affected
    }));

    try {
      const { data, error } = await resend.emails.send({
        from: "audit-report@fhfhockey.com",
        to: emailRecipient,
        subject: "✅ Cron Job Audit",
        react: CronAuditEmail({ audits: formattedAudits, sinceDate: since })
      });

      if (error) {
        console.error("Resend error for audit email:", error.message);
        errors.push(`Audit email failed: ${error.message}`);
        auditEmailResult = { success: false, error: error.message };
      } else {
        auditEmailResult = { success: true, emailId: data?.id };
      }
    } catch (e: any) {
      console.error("Exception sending audit email:", e.message);
      errors.push(`Audit email exception: ${e.message}`);
      auditEmailResult = { success: false, error: e.message };
    }
  } else if (!auditErr) {
    auditEmailResult = { success: true, message: "No audit data to send." };
  }

  // 4. Prepare and Send Job Run Details Email (similar to your original logic)
  if (runs && runs.length > 0) {
    const jobRunDetailsRows = (runs ?? []).map((r) => {
      // You can choose to link with audits here if needed, or keep it purely run data
      const match = (audits ?? []).find(
        // This links runs to audits
        (a) =>
          a.job_name === r.jobname &&
          Math.abs(
            new Date(a.run_time).getTime() -
              new Date(r.scheduled_time).getTime()
          ) <
            5 * 60 * 1000 // 5 minutes tolerance
      );
      return {
        jobname: r.jobname,
        scheduled: new Date(r.scheduled_time).toLocaleString(),
        status: r.status,
        rowsAffected: match?.rows_affected ?? null
      };
    });

    try {
      const { data, error } = await resend.emails.send({
        from: "job-status@fhfhockey.com", // Can be a different 'from' address
        to: emailRecipient,
        subject: "🥅 Daily Job Runs",
        react: CronReportEmail({ rows: jobRunDetailsRows }) // Using your existing component
      });

      if (error) {
        console.error("Resend error for job run details email:", error.message);
        errors.push(`Job run details email failed: ${error.message}`);
        jobRunDetailsEmailResult = { success: false, error: error.message };
      } else {
        jobRunDetailsEmailResult = { success: true, emailId: data?.id };
      }
    } catch (e: any) {
      console.error("Exception sending job run details email:", e.message);
      errors.push(`Job run details email exception: ${e.message}`);
      jobRunDetailsEmailResult = { success: false, error: e.message };
    }
  } else if (!runErr) {
    jobRunDetailsEmailResult = {
      success: true,
      message: "No job run data to send."
    };
  }

  // 5. Return the result
  if (
    errors.length > 0 &&
    (!auditEmailResult?.success || !jobRunDetailsEmailResult?.success)
  ) {
    return res.status(500).json({
      message: "One or more operations failed.",
      errors,
      auditEmailResult,
      jobRunDetailsEmailResult
    });
  }

  return res.status(200).json({
    success: true,
    auditEmailResult,
    jobRunDetailsEmailResult
  });
}
