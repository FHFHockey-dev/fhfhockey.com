import base from "../../../web/vitest.config.mts";

export default {
  ...base,
  envDir: false,
  server: { host: "127.0.0.1" },
  test: { ...base.test, maxWorkers: 1, minWorkers: 1 },
};
