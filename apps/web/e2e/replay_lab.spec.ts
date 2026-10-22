import { test, expect } from '@playwright/test';

test.describe('RIFT Phase 5: Counterfactual Replay & Failure Verification Engine E2E', () => {
  test('Test 1 — Replay Lab Navigation & Sandbox Capabilities Banner', async ({ page }) => {
    // 1. Navigate to /replay
    await page.goto('/replay');
    await expect(page.locator('h1', { hasText: 'Counterfactual Replay Lab' }).first()).toBeVisible();

    // 2. Verify Capabilities Banner & Security Controls
    await expect(
      page.getByText(/Secure replay is unavailable in this environment|Secure Container Sandbox Active/i)
    ).toBeVisible({ timeout: 15000 });

    await expect(page.getByText('Privileges:')).toBeVisible();
    await expect(page.getByText('Network:')).toBeVisible();

    // 3. Verify Stats Counter Cards
    await expect(page.getByText('Total Replay Sessions')).toBeVisible();
    await expect(page.getByText('Completed Runs')).toBeVisible();
  });

  test('Test 2 — Configuration, Security Preview & Explicit Approval Modal', async ({ page }) => {
    await page.goto('/replay');
    await expect(page.locator('h1', { hasText: 'Counterfactual Replay Lab' }).first()).toBeVisible();

    // 1. Verify Original Failing Action vs Counterfactual Correction cards
    await expect(page.getByText(/Original Failing Action/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Counterfactual Correction', { exact: true })).toBeVisible();

    // 2. Open Security Preview modal
    const previewBtn = page.getByRole('button', { name: /Preview Replay & Security Boundary/i });
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    // 3. Verify Security Preview modal contents
    await expect(page.getByText('Security Preview & Replay Authorization')).toBeVisible();
    await expect(page.getByText('Mandatory Sandbox Isolation Controls')).toBeVisible();

    // 4. Verify explicit approval checkbox is unchecked by default
    const confirmBtn = page.getByRole('button', { name: /Confirm & Execute Replay/i });
    await expect(confirmBtn).toBeDisabled();

    // 5. Close modal
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await cancelBtn.click();
    await expect(page.getByText('Security Preview & Replay Authorization')).not.toBeVisible();
  });

  test('Test 3 — End-to-End Accidental Deletion Replay Execution & Comparison', async ({ page }) => {
    await page.goto('/replay');
    await expect(page.locator('h1', { hasText: 'Counterfactual Replay Lab' }).first()).toBeVisible();

    // 1. Click Preview button
    const previewBtn = page.getByRole('button', { name: /Preview Replay & Security Boundary/i });
    await expect(previewBtn).toBeVisible({ timeout: 15000 });
    await previewBtn.click();

    // 2. Check the approval checkbox
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.check();

    // 3. Click Confirm & Execute Replay
    const confirmBtn = page.getByRole('button', { name: /Confirm & Execute Replay/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // 4. Verify execution finishes and Deterministic Comparison panel renders
    await expect(
      page.getByText(/Deterministic Replay Conclusion/i)
    ).toBeVisible({ timeout: 20000 });

    await expect(
      page.getByText(/Verified: Counterfactual Correction Succeeded/i)
    ).toBeVisible();

    // 5. Verify Original Validation FAILED vs Counterfactual Validation PASSED
    await expect(page.getByText('Original Execution')).toBeVisible();
    await expect(page.getByText('Counterfactual Correction', { exact: true }).first()).toBeVisible();

    // 6. Verify Filesystem Mutation & Invariant Inspector
    await expect(page.getByText('Filesystem Mutation & Invariant Inspector')).toBeVisible();
    await expect(page.locator('span.truncate', { hasText: 'tmp/cache.json' }).first()).toBeVisible();

    // 7. Verify Audit Manifest can be opened
    const manifestBtn = page.getByRole('button', { name: /Audit Manifest/i });
    await expect(manifestBtn).toBeVisible();
    await manifestBtn.click();

    await expect(page.getByText('Machine-Readable Audit Manifest')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy JSON' })).toBeVisible();
  });

  test('Test 4 — Investigation Workspace Links to Replay Lab', async ({ page }) => {
    // 1. Open the investigation workspace
    await page.goto('/investigations/trace-accidental-deletion-001');
    await expect(page.locator('header')).toBeVisible({ timeout: 15000 });

    // 2. Verify Replay Lab link in header
    const replayLink = page.getByRole('button', { name: /Replay/i }).first();
    await expect(replayLink).toBeVisible({ timeout: 15000 });
  });
});
