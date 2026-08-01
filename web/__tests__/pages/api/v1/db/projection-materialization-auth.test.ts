import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const routeSources = [
  "ingest-projection-inputs.ts",
  "build-projection-derived-v2.ts",
  "run-rolling-forge-pipeline.ts",
  "update-PbP.ts",
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
        /export default withCronJobAudit\(\s*adminOnly\([A-Za-z][A-Za-z0-9]* as any\),\s*\{/,
      );
    },
  );

  it("keeps the update-PbP adapter on the named raw canonical handler", () => {
    const source = routeSources.find(
      ({ fileName }) => fileName === "update-PbP.ts",
    )?.source;

    expect(source).toContain("ingestProjectionInputsHandler,");
    expect(source).toContain('from "./ingest-projection-inputs"');
    expect(source).toContain("return ingestProjectionInputsHandler(");
    expect(source).not.toMatch(
      /import\s+ingestProjectionInputsHandler\s+from\s+["']\.\/ingest-projection-inputs["']/,
    );
  });
});
