import assert from "node:assert/strict";
import test from "node:test";

import { hasValidBearerToken } from "./auth.js";

test("fails closed when the expected secret is missing or blank", () => {
  assert.equal(hasValidBearerToken("Bearer secret", undefined), false);
  assert.equal(hasValidBearerToken("Bearer secret", ""), false);
  assert.equal(hasValidBearerToken("Bearer secret", "   "), false);
});

test("accepts only one exact bearer token", () => {
  assert.equal(hasValidBearerToken(undefined, "secret"), false);
  assert.equal(hasValidBearerToken("", "secret"), false);
  assert.equal(hasValidBearerToken("secret", "secret"), false);
  assert.equal(hasValidBearerToken("bearer secret", "secret"), false);
  assert.equal(hasValidBearerToken("Bearer  secret", "secret"), false);
  assert.equal(hasValidBearerToken("Bearer secret extra", "secret"), false);
  assert.equal(hasValidBearerToken("Bearer wrong", "secret"), false);
  assert.equal(hasValidBearerToken("Bearer secret", "secret"), true);
});
