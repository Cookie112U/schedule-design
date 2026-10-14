const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "browser-smoke.spec.js",
  respectGitIgnore: false,
  workers: 1,
  timeout: 30000,
  use: {
    trace: "retain-on-failure"
  }
});
