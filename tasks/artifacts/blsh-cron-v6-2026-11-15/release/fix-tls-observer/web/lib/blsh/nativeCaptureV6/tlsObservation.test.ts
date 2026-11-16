// @vitest-environment node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TLS_OBSERVATION_CHANNEL, withTlsObservation } from "./tlsObservation";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const COPY = readFileSync(resolve(__dirname, "tlsObservation.ts"), "utf8");
const block = () => {
  const begin = "// ---- BEGIN VERBATIM v5 nativeProcessCaptureAdapter.ts lines 14-73 (348a122d6) ----\n", end = "// ---- END VERBATIM v5 ----";
  return COPY.slice(COPY.indexOf(begin) + begin.length, COPY.indexOf(end));
};
const V5 = resolve(__dirname, "../../../scripts/blsh/nativeProcessCaptureAdapter.ts");

describe("v6 TLS observer is the reviewed v5 observer, verbatim", () => {
  it("pins the copied block to v5 lines 14-73 (sha256 c01da6d8...)", () => {
    expect(sha(block())).toBe("c01da6d830bb66b0e9bb89bc0b60bdeac368a68f81664e8f8a0cfcadc2c292b9");
    expect(TLS_OBSERVATION_CHANNEL).toBe("undici:client:sendHeaders");
    expect(typeof withTlsObservation).toBe("function");
  });

  const v5Bytes = existsSync(V5) ? readFileSync(V5, "utf8") : null;
  it.skipIf(!v5Bytes || sha(v5Bytes) !== "aa6237bdb8d977cbd21f3ed769d9f5c7f9028e23a921965f41e278e021947be0")(
    "equals the v5 adapter's own lines 14-73 where that file is present at aa6237bd", () => {
      expect(block()).toBe(v5Bytes!.split("\n").slice(13, 73).join("\n") + "\n");
    });
});
