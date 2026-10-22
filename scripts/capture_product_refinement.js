const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const ARTIFACTS_DIR = '/Users/oggy/.gemini/antigravity-ide/brain/5dee060e-a561-4b9b-9edd-6734b749c4dc';
const BASE_URL = 'http://127.0.0.1:5173';

async function run() {
  console.log('Launching Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1. Overview Page
  console.log('1. Visiting Overview...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'overview_editorial.png'),
    fullPage: false,
  });
  console.log('Captured overview_editorial.png');

  // 2. Click "Explore Demo"
  console.log('2. Clicking Explore Demo...');
  const exploreDemoBtn = page.getByRole('button', { name: /Explore Demo|Launch Demo Incident/i }).first();
  if (await exploreDemoBtn.isVisible()) {
    await exploreDemoBtn.click();
    await page.waitForTimeout(2000);
  }

  // 3. Incident Detail Page
  console.log('3. Checking Incident Detail Page...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'incident_detail.png'),
    fullPage: false,
  });
  console.log('Captured incident_detail.png');

  // 4. Traces Explorer Page
  console.log('4. Visiting Traces Explorer...');
  await page.goto(`${BASE_URL}/traces`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'traces_explorer.png'),
    fullPage: false,
  });
  console.log('Captured traces_explorer.png');

  // 5. Open Full Investigation Workspace
  console.log('5. Visiting Investigation Workspace...');
  await page.goto(`${BASE_URL}/investigations/trace-accidental-deletion-001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'investigation_workspace.png'),
    fullPage: false,
  });
  console.log('Captured investigation_workspace.png');

  // Click on span-demo-006 (the delete_file event)
  console.log('6. Selecting suspicious span-demo-006...');
  const span006 = page.locator('text=tool:delete_file').first();
  if (await span006.isVisible()) {
    await span006.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'investigation_event_selected.png'),
      fullPage: false,
    });
    console.log('Captured investigation_event_selected.png');
  }

  // 7. Counterfactual Replay Lab
  console.log('7. Visiting Replay Lab...');
  await page.goto(`${BASE_URL}/replay`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'replay_lab.png'),
    fullPage: false,
  });
  console.log('Captured replay_lab.png');

  // 8. Settings Page
  console.log('8. Visiting Settings Page...');
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'settings_diagnostics.png'),
    fullPage: false,
  });
  console.log('Captured settings_diagnostics.png');

  // 9. Mobile Viewport Responsive Audit (390x844)
  console.log('9. Checking Mobile Viewport (390x844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, 'overview_mobile_390px.png'),
    fullPage: false,
  });
  console.log('Captured overview_mobile_390px.png');

  await browser.close();
  console.log('Browser verification completed successfully.');
}

run().catch((err) => {
  console.error('Error during browser capture:', err);
  process.exit(1);
});
