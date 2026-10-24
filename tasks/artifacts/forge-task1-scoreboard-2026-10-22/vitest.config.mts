import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({root:'/Users/tim/Code/fhfhockey.com/web',envDir:'/tmp/fhfh-task1-scoreboard',plugins:[tsconfigPaths({projects:['/Users/tim/Code/fhfhockey.com/web/tsconfig.json']})],cacheDir:'/tmp/fhfh-task1-scoreboard/vite-cache',test:{environment:'jsdom',setupFiles:['/Users/tim/Code/fhfhockey.com/web/__tests__/vitest.setup.js'],pool:'threads',maxWorkers:1,minWorkers:1}});
