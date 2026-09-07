import { retryDraftProRefundEmails } from "../lib/draft-pro/account/refunds";

const sendFlags = process.argv.slice(2).filter((arg) => arg === "--send");
const send = sendFlags.length === 1;
const positional = process.argv.slice(2).filter((arg) => arg !== "--send");
const usage = "Usage: npm exec ts-node scripts/retry-draft-pro-refund-emails.ts [1-100] [--send]";
const limitArg = Number(positional[0] ?? "25");
if (sendFlags.length > 1 || positional.length > 1 || process.argv.slice(2).some((arg) => arg !== "--send" && arg !== positional[0])) {
  throw new Error(usage);
}
if (!Number.isInteger(limitArg) || limitArg < 1 || limitArg > 100) {
  throw new Error(usage);
}

void retryDraftProRefundEmails({ limit: limitArg, dryRun: !send })
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => {
    console.error("Refund email retry failed.");
    process.exitCode = 1;
  });
