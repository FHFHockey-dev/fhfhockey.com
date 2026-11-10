import base from "../../../web/playwright.config";
export default { ...base, testDir: "/Users/tim/Code/fhfhockey.com/web/e2e", timeout: 120000, retries: 0, workers: 1,
 use: { ...base.use, baseURL: "http://127.0.0.1:3186" },
 webServer: { command: "npm run dev:stable -- -H 127.0.0.1 -p 3186", cwd: "/Users/tim/Code/fhfhockey.com/web",
 env: { PLAYWRIGHT_ISOLATED_NEXT: "1" }, url: "http://127.0.0.1:3186/privacy", reuseExistingServer: false, timeout: 120000 },
};
