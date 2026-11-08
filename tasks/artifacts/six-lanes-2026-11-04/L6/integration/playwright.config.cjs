const path = require('node:path');
const web = '/Users/tim/Code/fhfhockey.com/web';
module.exports = {
 testDir: path.join(web, 'e2e'),
 testMatch: 'wigo-one-page.spec.ts',
 outputDir: path.join(__dirname, 'browser-results'),
 timeout: 120000,
 expect: {timeout:15000},
 workers:1, retries:0, maxFailures:1,
 reporter: [['list'], ['json',{outputFile:path.join(__dirname,'browser-results.json')}]],
 use:{baseURL:'http://127.0.0.1:3186',browserName:'chromium',headless:true,serviceWorkers:'block',screenshot:'only-on-failure',trace:'off'},
};
