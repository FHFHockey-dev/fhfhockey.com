import { defineConfig } from '../../../../web/node_modules/vitest/dist/config.js';
import { fileURLToPath } from 'node:url';
const repo=fileURLToPath(new URL('../../../../',import.meta.url)),own=fileURLToPath(new URL('./',import.meta.url));
export default defineConfig({root:repo,resolve:{alias:{react:repo+'web/node_modules/react', 'react-dom':repo+'web/node_modules/react-dom',vitest:repo+'web/node_modules/vitest','@testing-library/react':repo+'web/node_modules/@testing-library/react',components:repo+'web/components',contexts:repo+'web/contexts',lib:repo+'web/lib'}},cacheDir:own+'.vite-cache',esbuild:{jsx:'automatic'},test:{environment:'jsdom',cache:false,maxWorkers:1,fileParallelism:false,setupFiles:[own+'offline.setup.ts'],include:[own+'probes.test.tsx']}});
