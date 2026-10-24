import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'web');
export default {
  root, envDir:path.join(root,'empty-env'), cacheDir:path.join(root,'cache'),
  resolve:{alias:{lib:path.join(root,'lib'),pages:path.join(root,'pages'),utils:path.join(root,'utils')}},
  test:{environment:'jsdom',setupFiles:[path.join(root,'__tests__/vitest.setup.js')],pool:'threads',maxWorkers:1,minWorkers:1,
    include:['lib/player-forecasts/servedForecastLedger.test.ts','tests/api/forge-scoreboard.test.ts','review/*.test.ts']}
};
