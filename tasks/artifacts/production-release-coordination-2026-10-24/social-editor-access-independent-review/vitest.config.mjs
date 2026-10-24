import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  esbuild: { jsx: 'automatic' },
  resolve: { alias: [
    { find: 'lib/supabase/client', replacement: root + 'mocks/browser.ts' },
    { find: 'lib/user-settings/ensureUserRecords', replacement: root + 'mocks/ensure.ts' },
    { find: 'contexts', replacement: root + 'snapshot/web/contexts' },
    { find: 'components', replacement: root + 'snapshot/web/components' },
    { find: 'lib', replacement: root + 'snapshot/web/lib' },
  ] },
  test: { include: ['security-controls.test.tsx'], environment: 'jsdom', setupFiles: ['./network-block.ts'], maxWorkers: 1, fileParallelism: false },
});
