import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Headers Tab - Variable Input and Variable Dialog', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['dist-electron/main.js'] });
    window = await electronApp.firstWindow();
    window.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await window.waitForLoadState('domcontentloaded');
    await electronApp.evaluate(async ({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.maximize();
      }
    });
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should handle variable inputs in headers tab: dropdown selection, found variable, not found variable, and mock variable', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(
      { type: 'component', description: 'RequestHeader.tsx' },
      { type: 'component', description: 'tabs.tsx' },
      { type: 'component', description: 'RequestConfig/index.tsx' },
      { type: 'component', description: 'HeadersContent.tsx' },
      { type: 'component', description: 'VariableInput.tsx' },
      { type: 'component', description: 'VariableDialog.tsx' },
      { type: 'component', description: 'input.tsx' },
      { type: 'component', description: 'button.tsx' },
      { type: 'component', description: 'tooltip.tsx' }
    );

    // 1. Open Collection Manager and select active collection
    const cmButton = window.locator('button[title="Collection manager"]');
    await expect(cmButton).toBeVisible({ timeout: 15000 });
    await cmButton.click();

    const modal = window.locator('div[role="alertdialog"]');
    await expect(modal).toBeVisible();

    const collectionRow = modal.locator('.grid.grid-cols-12.border-t.border-border').first();
    await expect(collectionRow).toBeVisible();
    await collectionRow.click();
    await expect(modal).toBeHidden();

    // 2. Create a new request directly via New Tab button
    const newTabBtn = window.locator('button').filter({ hasText: 'New Tab' }).first();
    await expect(newTabBtn).toBeVisible({ timeout: 15000 });
    await newTabBtn.click({ force: true });

    const newRequestMenuItem = window.locator('[role="menuitem"]').filter({ hasText: 'New Request' });
    await expect(newRequestMenuItem).toBeVisible();
    await newRequestMenuItem.click({ force: true });

    // Wait for request editor to load
    const methodSelect = window.locator('button[role="combobox"]').nth(0);
    await expect(methodSelect).toBeVisible({ timeout: 10000 });

    // 3. Navigate to Headers tab in Request Configuration
    const headersTab = window.getByRole('tab', { name: 'Headers', exact: true });
    await expect(headersTab).toBeVisible({ timeout: 15000 });
    await headersTab.click({ force: true });

    // Locate the add header input fields
    const headerKeyInput = window.locator('input[placeholder="header key"]');
    const headerValueInput = window.locator('input[placeholder="header value"]');
    await expect(headerKeyInput).toBeVisible({ timeout: 10000 });
    await expect(headerValueInput).toBeVisible({ timeout: 10000 });

    // 4. Test dropdown list appearance and selection of desired variable
    // Focus header value input and type '{{' to trigger VariableDialog dropdown
    await headerValueInput.click();
    await headerValueInput.pressSequentially('{{');

    // Verify VariableDialog dropdown appears
    const variableDialog = window.locator('.fixed.z-50').filter({
      has: window.locator('input[placeholder="Search Variable"]')
    });
    await expect(variableDialog).toBeVisible({ timeout: 10000 });

    // Verify search input within VariableDialog
    const searchInput = variableDialog.locator('input[placeholder="Search Variable"]');
    await expect(searchInput).toBeVisible();

    // Verify variable items with badges ('variable' or 'mock') are listed in the dropdown
    const userIdOption = variableDialog.locator('button').filter({ hasText: 'userId' });
    await expect(userIdOption).toBeVisible({ timeout: 10000 });
    await expect(userIdOption.locator('text=variable')).toBeVisible();

    // Click the desired variable (userId) from the dropdown list
    await userIdOption.click();

    // The dropdown dialog should close after selection
    await expect(variableDialog).toBeHidden();

    // 5. Verify found variable behavior
    // Input value should now have '{{userId}}'
    await expect(headerValueInput).toHaveValue('{{userId}}');

    // Overlay should display the found variable badge with emerald/green styling (bg-emerald-500/70)
    const foundBadge = window.locator('span').filter({ hasText: '{{userId}}' }).first();
    await expect(foundBadge).toBeVisible({ timeout: 5000 });
    await expect(foundBadge).toHaveClass(/bg-emerald-500/);

    // Hover over the badge to display tooltip showing real variable value
    await foundBadge.hover();
    const tooltipFound = window.locator('[role="tooltip"]');
    await expect(tooltipFound).toBeVisible({ timeout: 5000 });
    await expect(tooltipFound).toContainText('userId:');
    await expect(tooltipFound).toContainText('testing');

    // Move cursor away to close tooltip
    await window.mouse.move(0, 0);
    await window.waitForTimeout(300);

    // 6. Test input variable name that is not found
    // Enter an unknown/non-existent variable into header value
    await headerValueInput.fill('{{unknown_variable_xyz}}');

    // Overlay should display the not-found variable badge with rose/red styling (bg-rose-500/70)
    const notFoundBadge = window.locator('span').filter({ hasText: '{{unknown_variable_xyz}}' }).first();
    await expect(notFoundBadge).toBeVisible({ timeout: 5000 });
    await expect(notFoundBadge).toHaveClass(/bg-rose-500/);

    // Hover over the not-found badge to verify 'Variable not found' tooltip
    await notFoundBadge.hover();
    const tooltipNotFound = window.locator('[role="tooltip"]');
    await expect(tooltipNotFound).toBeVisible({ timeout: 5000 });
    await expect(tooltipNotFound).toContainText('Variable not found');

    // Move cursor away to close tooltip
    await window.mouse.move(0, 0);
    await window.waitForTimeout(300);

    // 7. Test input variable name that is mock
    // Fill with mock variable directly, or trigger dropdown to pick mock
    await headerValueInput.fill('{{mock.uuid}}');

    // Overlay should display the mock variable badge with emerald/green styling (bg-emerald-500/70)
    const mockBadge = window.locator('span').filter({ hasText: '{{mock.uuid}}' }).first();
    await expect(mockBadge).toBeVisible({ timeout: 5000 });
    await expect(mockBadge).toHaveClass(/bg-emerald-500/);

    // Hover over the mock badge to verify 'calculate during send request' tooltip
    await mockBadge.hover();
    const tooltipMock = window.locator('[role="tooltip"]');
    await expect(tooltipMock).toBeVisible({ timeout: 5000 });
    await expect(tooltipMock).toContainText('mock.uuid:');
    await expect(tooltipMock).toContainText('calculate during send request');

    // Move cursor away to close tooltip
    await window.mouse.move(0, 0);
    await window.waitForTimeout(300);

    // 8. Test selecting mock variable via dropdown in Header Key input
    await headerKeyInput.click();
    await headerKeyInput.pressSequentially('{{');
    await expect(variableDialog).toBeVisible({ timeout: 10000 });

    // Filter dropdown for mock
    await searchInput.fill('mock.firstName');
    const mockOption = variableDialog.locator('button').filter({ hasText: 'mock.firstName' });
    await expect(mockOption).toBeVisible({ timeout: 5000 });
    await expect(mockOption.getByText('mock', { exact: true })).toBeVisible();

    // Select the mock variable
    await mockOption.click();
    await expect(variableDialog).toBeHidden();
    await expect(headerKeyInput).toHaveValue('{{mock.firstName}}');

    // Verify mock badge in header key input
    const headerKeyMockBadge = window.locator('span').filter({ hasText: '{{mock.firstName}}' }).first();
    await expect(headerKeyMockBadge).toBeVisible({ timeout: 5000 });
    await expect(headerKeyMockBadge).toHaveClass(/bg-emerald-500/);

    // 9. Add the new header to table and verify persistence in table row
    const addHeaderRow = window.locator('.grid.grid-cols-12').filter({ has: headerKeyInput });
    const addBtn = addHeaderRow.locator('button');
    await addBtn.click();

    // Verify added header row exists with variable badges rendered
    const tableHeaderKey = window.locator('input[value="{{mock.firstName}}"]');
    await expect(tableHeaderKey).toBeVisible({ timeout: 10000 });

    const tableRow = window.locator('.grid.grid-cols-12').filter({ has: tableHeaderKey });
    const tableMockValBadge = tableRow.locator('span').filter({ hasText: '{{mock.uuid}}' }).first();
    await expect(tableMockValBadge).toBeVisible({ timeout: 5000 });
    await expect(tableMockValBadge).toHaveClass(/bg-emerald-500/);
  });
});
