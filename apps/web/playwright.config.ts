import { defineConfig, devices } from '@playwright/test'; // Playwright ke test chalane aur browser ka roop chunne ke helpers lete hain.

// TS mein config ka naksha hai; Playwright isi se app aur browser test chalata hai.
export default defineConfig({
  testDir: './e2e', // Browser test wali files e2e folder mein rakhi hain.
  testMatch: '**/*.spec.ts', // Sirf spec naam wali test files chalti hain.
  fullyParallel: false, // Ek hi nakli API ka data tests ke beech takrane se bachate hain.
  workers: 1, // Ek browser test ek waqt mein chalate hain, taaki result seedha samajh aaye.
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]], // Chhota terminal result aur baad mein dekhne layak report banate hain.
  use: {
    baseURL: 'http://127.0.0.1:3000', // Browser app ke local address ko base maanta hai.
    trace: 'retain-on-failure', // Fail hua test dobara samajhne ke liye browser ki recording bachate hain.
    launchOptions: { channel: 'chromium' }, // Full Chromium ko headless mode mein chalate hain; alag chhota browser file nahi chahiye.
    ...devices['Desktop Chrome'], // Desktop Chrome jaise screen aur browser ka istemal karte hain.
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }], // Is milestone mein Chrome-jaisi browser copy par chalate hain.
  webServer: [
    {
      command: 'node e2e/mock-api.mjs', // Test ke liye chhota nakli API server chalu karte hain.
      url: 'http://127.0.0.1:4001/health', // Is pata par jawab aaye to samajhte hain ki nakli server ready hai.
      reuseExistingServer: !process.env.CI, // Apne computer par pehle se chal raha test server dobara istemal kar sakte hain.
      timeout: 30_000, // Server ko shuru hone ke liye 30 second dete hain.
    },
    {
      command: 'npm run dev', // Next.js app ko test ke liye chalu karte hain.
      url: 'http://127.0.0.1:3000', // Is page ke khulne ko app ready hone ka nishaan maante hain.
      reuseExistingServer: !process.env.CI, // Apne computer par pehle se khula app phir istemal kar sakte hain.
      timeout: 120_000, // Pehli baar app taiyar hone ke liye zyada waqt dete hain.
      env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4001' }, // App ko test waali API ka pata dete hain.
    },
  ],
});
