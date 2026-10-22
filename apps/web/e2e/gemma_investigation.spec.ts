import { test, expect } from '@playwright/test';

test.describe('RIFT Phase 4: Gemma AI Incident Investigation Engine E2E', () => {
  test('Test 1 — Settings Page: Gemma Model Connectivity & Health Inspection', async ({ page }) => {
    // 1. Navigate to Settings page
    await page.goto('/settings');
    await expect(page.locator('h2', { hasText: 'Platform Settings' })).toBeVisible();

    // 2. Locate Google Gemma Inference Engine section
    await expect(page.getByText(/Google Gemma.*Inference Engine/i)).toBeVisible();
    await expect(page.getByText('Inference Provider')).toBeVisible();
    await expect(page.getByText('Model Selection')).toBeVisible();

    // 3. Test Gemma Connection button
    const testBtn = page.getByRole('button', { name: /Test (Inference|Gemma)/i });
    await expect(testBtn).toBeVisible();
    await testBtn.click();

    // 4. Verify test result banner
    await expect(
      page.getByText(/Inference Test: FAILED|Inference Test: PASSED|Inference test completed|Healthy|Ready/i).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('Test 2 — Incident Detail: Gemma Investigation Panel & Setup Instructions', async ({ page }) => {
    // 1. Navigate to Incidents list
    await page.goto('/incidents');
    await expect(page.getByText('Incident Management')).toBeVisible();

    // 2. Open accidental deletion incident detail
    const incidentLink = page.getByText("Unsafe Deletion of 'src/config.ts'").first();
    await expect(incidentLink).toBeVisible({ timeout: 15000 });
    await incidentLink.click();

    // 3. Verify Incident Detail page displays rule-based summary and Gemma AI panel
    await expect(page.getByText('Rule-Based Detection Summary')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Gemma AI Investigation')).toBeVisible();
    await expect(page.getByText('Root-Cause Hypothesis & Telemetry Verification Engine')).toBeVisible();

    // 4. Verify model status or action button is visible
    await expect(page.getByText(/Local Gemma Model Inference Unavailable|Investigate with Gemma|Gemma 4/i)).toBeVisible();
  });

  test('Test 3 — Investigation Workspace: View Mode Toggling & Telemetry Integration', async ({ page }) => {
    // 1. Open the investigation workspace for accidental deletion
    await page.goto('/investigations/trace-accidental-deletion-001');
    await expect(page.locator('header')).toBeVisible();

    // Wait for workspace data and DAG to load
    await expect(page.getByText('No Event Selected')).toBeVisible({ timeout: 15000 });

    // 2. Verify View Mode controls in header
    const execGraphBtn = page.getByRole('button', { name: 'Execution Graph', exact: true });
    const evidenceBtn = page.getByRole('button', { name: 'Investigation Evidence', exact: true });
    const intentBtn = page.getByRole('button', { name: 'Intent vs Execution', exact: true });

    await expect(execGraphBtn).toBeVisible();
    await expect(evidenceBtn).toBeVisible();
    await expect(intentBtn).toBeVisible();

    // 3. Switch to Investigation Evidence view
    await evidenceBtn.click();
    await expect(page.getByText('Gemma AI Investigation')).toBeVisible();

    // 4. Switch to Intent vs Execution view
    await intentBtn.click();
    await expect(page.getByText('Intent vs Execution Analysis')).toBeVisible();

    // 5. Switch back to Execution Graph view
    await execGraphBtn.click();
    await expect(page.getByText('No Event Selected')).toBeVisible();
  });
});
