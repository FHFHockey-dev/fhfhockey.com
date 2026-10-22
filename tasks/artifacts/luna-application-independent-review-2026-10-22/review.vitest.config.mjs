import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root:fileURLToPath(new URL('.',import.meta.url)), envDir:false,
  resolve:{alias:{lib:fileURLToPath(new URL('./lib',import.meta.url))}},
  cacheDir:fileURLToPath(new URL('./.review-cache',import.meta.url)),
  test:{environment:'node',include:['lib/sources/*.test.ts'],minWorkers:1,maxWorkers:1},
});
