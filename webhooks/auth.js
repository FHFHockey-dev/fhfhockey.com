import { timingSafeEqual } from "node:crypto";

export function hasValidBearerToken(authorization, expectedToken) {
  if (typeof expectedToken !== "string" || expectedToken.trim() === "") {
    return false;
  }

  if (typeof authorization !== "string") {
    return false;
  }

  const match = authorization.match(/^Bearer ([^\s]+)$/);
  if (!match) {
    return false;
  }

  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(expectedToken);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}
