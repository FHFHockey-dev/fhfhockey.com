import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const routeSources = [
  "ingest-projection-inputs.ts",
  "build-projection-derived-v2.ts",
  "run-rolling-forge-pipeline.ts",
].map((fileName) => ({
  fileName,
  source: readFileSync(
    resolve(process.cwd(), "pages/api/v1/db", fileName),
    "utf8",
  ),
}));

describe("projection materialization route authorization", () => {
  it.each(routeSources)(
    "keeps $fileName behind the shared cron/admin boundary inside auditing",
    ({ source }) => {
      expect(source).toContain(
        'import adminOnly from "utils/adminOnlyMiddleware"',
      );
      expect(source).toMatch(
        /export default withCronJobAudit\(adminOnly\(handler as any\), \{/,
      );
    },
  );
});
