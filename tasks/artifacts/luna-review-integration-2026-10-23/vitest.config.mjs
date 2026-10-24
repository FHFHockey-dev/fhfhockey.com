import { defineConfig } from '../../../web/node_modules/vitest/dist/config.js';
export default defineConfig({ root: new URL('../../../web', import.meta.url).pathname, envDir: false,
  server: { fs: { allow: [new URL('../../../', import.meta.url).pathname] } },
  resolve: { alias: Object.fromEntries(['lib', 'utils', 'components', 'pages', 'hooks', 'contexts'].map(name => [name, new URL(`../../../web/${name}`, import.meta.url).pathname])) },
  test: { environment: 'node', setupFiles: [], maxWorkers: 1, fileParallelism: false, pool: 'forks' } });
