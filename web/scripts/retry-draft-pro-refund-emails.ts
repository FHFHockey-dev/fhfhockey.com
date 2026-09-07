import { retryDraftProRefundEmails } from "../lib/draft-pro/account/refunds";

const send = process.argv.includes("--send");
const positional = process.argv.slice(2).filter((arg) => arg !== "--send");
const limitArg = Number(positional[0] ?? "25");
if (positional.length > 1) {
  throw new Error("Usage: npm exec ts-node scripts/retry-draft-pro-refund-emails.ts [1-100] [--send]");
}
if (!Number.isInteger(limitArg) || limitArg < 1 || limitArg > 100) {
  throw new Error("Usage: npm exec ts-node scripts/retry-draft-pro-refund-emails.ts [1-100] [--send]");
}

void retryDraftProRefundEmails({ limit: limitArg, dryRun: !send })
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
