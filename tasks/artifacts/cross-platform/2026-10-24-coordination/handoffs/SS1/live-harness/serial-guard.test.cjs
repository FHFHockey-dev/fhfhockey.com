const test = require("node:test"), assert = require("node:assert");
const { createSerialGuard } = require("./serial-guard.cjs");
test("allows sequential requests up to the cap", () => {
  const guard = createSerialGuard(2);
  const a = guard.begin("page", "/social-share/game-grid"); guard.end(a);
  const b = guard.begin("api", "/api/v1/social-share/game-grid"); guard.end(b, { status: 200 });
  assert.equal(guard.started, 2); assert.deepEqual(guard.violations, []); assert.equal(guard.log.length, 2);
  assert.equal(guard.begin("api", "/x"), null); assert.equal(guard.violations[0].type, "cap");
});
test("rejects a second request while one is in flight (strict-mode double fetch)", () => {
  const guard = createSerialGuard(5);
  const first = guard.begin("api", "/api/v1/social-share/game-grid?weekStart=2026-10-19");
  assert.equal(guard.begin("api", "/api/v1/social-share/game-grid?weekStart=2026-10-19"), null);
  assert.deepEqual(guard.violations.map(item => item.type), ["overlap"]);
  guard.end(first); assert.equal(guard.started, 1);
  assert.throws(() => guard.end(first), /matching begin/);
});
