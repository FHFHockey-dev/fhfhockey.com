import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../web',import.meta.url));
export default { root, resolve:{alias:{lib:`${root}/lib`}}, test:{environment:'node',maxWorkers:1,
  include:[fileURLToPath(new URL('./rules-adapter.test.ts',import.meta.url))]}};
