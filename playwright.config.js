const { defineConfig } = require("@playwright/test");
const baseURL = process.env.TEST_BASE_URL || "http://127.0.0.1:5512";

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "browser-smoke.spec.js",
  respectGitIgnore: false,
  workers: 1,
  timeout: 30000,
  webServer: {
    command: "node dev-server.js",
    env: { ...process.env, PORT: "5512" },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 15000
  },
  use: {
    trace: "retain-on-failure"
  }
});
