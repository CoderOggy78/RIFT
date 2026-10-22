import { test, expect } from '@playwright/test';

test.describe('RIFT Phase 3: Investigation Workspace & Execution Graph', () => {
  const traceId = 'trace-accidental-deletion-001';
  const deletionEventId = 'span-demo-006';

  test('Test A — Timeline to Graph Selection & Inspector Updates', async ({ page }) => {
    // 1. Open the investigation workspace for the accidental deletion trace
    await page.goto(`/investigations/${traceId}`);

    // Wait for the workspace header to be visible
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByText(traceId)).toBeVisible();

    // 2. Select the deletion event from the timeline
    const timelineEntry = page.locator(`[data-testid="timeline-event-${deletionEventId}"]`).or(
      page.getByText('tool:delete_file').first()
    );
    await expect(timelineEntry).toBeVisible({ timeout: 10000 });
    await timelineEntry.click();

    // 3. Verify URL is updated with query param
    await expect(page).toHaveURL(new RegExp(`event=${deletionEventId}`));

    // 4. Verify the Evidence Inspector panel displays the event details and inputs
    await expect(page.getByText('Event Inspector')).toBeVisible();
    await expect(page.getByText('tool:delete_file').first()).toBeVisible();

    // 5. Click the Inputs tab and verify structured arguments
    const inputsTab = page.getByRole('button', { name: 'Inputs' });
    await inputsTab.click();
    await expect(page.getByText('src/config.ts').first()).toBeVisible();
  });

  test('Test B — Evidence Reference Deep Navigation', async ({ page }) => {
    // 1. Navigate to Incidents list
    await page.goto('/incidents');
    await expect(page.getByText('Incident Management')).toBeVisible();

    // 2. Locate incident in table and click it
    const incidentLink = page.getByText("Unsafe Deletion of 'src/config.ts'").first();
    await expect(incidentLink).toBeVisible({ timeout: 15000 });
    await incidentLink.click();

    // 3. Verify Incident Detail page loaded
    await expect(page.getByText('Rule-Based Detection Summary')).toBeVisible({ timeout: 15000 });

    // 4. Click the "Investigation Workspace" action button
    const workspaceBtn = page.getByRole('button', { name: /Investigation Workspace/i });
    await expect(workspaceBtn).toBeVisible();
    await workspaceBtn.click();

    // 5. Verify navigation into /investigations/:traceId with event deep link
    await expect(page).toHaveURL(new RegExp(`/investigations/`));
    await expect(page.getByText('Execution Graph')).toBeVisible();
    await expect(page.getByText('Event Inspector')).toBeVisible();
  });

  test('Test C — Intent vs Execution Comparison Mode', async ({ page }) => {
    // 1. Open the investigation workspace
    await page.goto(`/investigations/${traceId}`);

    // 2. Switch to Intent vs Execution comparison view
    const intentToggle = page.getByRole('button', { name: 'Intent vs Execution' });
    await expect(intentToggle).toBeVisible();
    await intentToggle.click();

    // 3. Verify Intent vs Execution view header and comparison columns
    await expect(page.getByText('Intent vs Execution Analysis')).toBeVisible();
    await expect(page.getByText('Agent Intent')).toBeVisible();
    await expect(page.getByText('Observed Execution')).toBeVisible();

    // 4. Verify Original User Objective is displayed on the Intent side
    await expect(page.getByText('Clean temporary files from my project').first()).toBeVisible();

    // 5. Verify Destructive Operations on Observed side displays the targeted file
    await expect(page.getByText('src/config.ts').first()).toBeVisible();

    // 6. Verify deterministic incident finding RULE-001 is displayed
    await expect(page.getByText(/RULE-001/i).first()).toBeVisible();
    await expect(page.getByText(/Unsafe Deletion/i).first()).toBeVisible();
  });
});
