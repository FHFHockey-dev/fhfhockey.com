import { createHash } from "node:crypto";

export type CanonicalJson =
  | null
  | boolean
  | number
  | string
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

function canonicalize(value: unknown, path: string): CanonicalJson {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Canonical JSON contains a non-finite number at ${path}`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => canonicalize(item, `${path}[${index}]`));
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`Canonical JSON contains a non-plain object at ${path}`);
    }
    const result: Record<string, CanonicalJson> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      result[key] = canonicalize(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
      );
    }
    return result;
  }
  throw new Error(
    `Canonical JSON contains an unsupported ${typeof value} at ${path}`,
  );
}

export function canonicalizeJson(value: unknown): CanonicalJson {
  return canonicalize(value, "$");
}

export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(canonicalizeJson(value));
}

export function sha256CanonicalJson(value: unknown): string {
  return createHash("sha256").update(stableJsonStringify(value)).digest("hex");
}
