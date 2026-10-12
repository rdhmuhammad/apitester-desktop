import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Authorization Tab', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    // Ensure parent collection has bearer auth configured
    try {
      const response = await fetch('http://localhost:8990/api/v1/collection/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'bearer',
          bearer: [{ key: 'token', value: 'parent-bearer-token-123' }]
        })
      });
      console.log('Collection auth setup status:', response.status);
    } catch (e) {
      console.log('Failed to pre-set collection auth:', e);
    }

    electronApp = await electron.launch({ args: ['dist-electron/main.js'] });
    window = await electronApp.firstWindow();
    window.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Intercept test endpoint so requests return immediately with 200 OK
    await window.route('**/test-auth-endpoint*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          success: true,
          message: 'Authenticated successfully'
        }
      });
    });

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

  test('should update headers tab and request console when changing auth to Bearer Token and Inherit From Parent', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(
      { type: 'component', description: 'RequestHeader.tsx' },
      { type: 'component', description: 'tabs.tsx' },
      { type: 'component', description: 'RequestConfig/index.tsx' },
      { type: 'component', description: 'AuthContent.tsx' },
      { type: 'component', description: 'HeadersContent.tsx' },
      { type: 'component', description: 'ResponseView.tsx' },
      { type: 'component', description: 'select.tsx' },
      { type: 'component', description: 'input.tsx' },
      { type: 'component', description: 'button.tsx' }
    );

    // 1. Open Collection Manager and select collection
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

    // 3. Set endpoint path
    const endpointInput = window.getByLabel('Endpoint path');
    await expect(endpointInput).toBeVisible({ timeout: 15000 });
    await endpointInput.fill('/test-auth-endpoint');
    await endpointInput.blur();
    await window.waitForTimeout(400);

    // 4. Open the Authorization tab in Request Configuration
    const authTab = window.getByRole('tab', { name: 'Authorization', exact: true });
    await expect(authTab).toBeVisible({ timeout: 15000 });
    await authTab.click({ force: true });

    // 5. Change auth type to "Bearer Token"
    const authTabPanel = window.locator('[role="tabpanel"]').filter({ hasText: 'Auth Type' });
    await expect(authTabPanel).toBeVisible();

    const authSelectTrigger = authTabPanel.locator('button[role="combobox"]').first();
    await expect(authSelectTrigger).toBeVisible();
    await authSelectTrigger.click({ force: true });

    const bearerOption = window.getByRole('option', { name: 'Bearer Token' });
    await expect(bearerOption).toBeVisible();
    await bearerOption.click({ force: true });

    // 6. Input bearer token value
    const tokenInput = window.getByPlaceholder('Enter bearer token...');
    await expect(tokenInput).toBeVisible();
    await tokenInput.fill('my-custom-bearer-token');

    // Wait for debounced update (400ms debounce in AuthContent.tsx)
    await window.waitForTimeout(600);

    // 7. Verify at the Headers tab: Authorization header should appear with bearer token
    const headersTab = window.getByRole('tab', { name: 'Headers', exact: true });
    await expect(headersTab).toBeVisible();
    await headersTab.click({ force: true });

    const authHeaderKeyInput = window.locator('input[value="Authorization"]');
    await expect(authHeaderKeyInput).toBeVisible({ timeout: 10000 });

    const authHeaderRow = window.locator('.grid.grid-cols-12').filter({ has: authHeaderKeyInput });
    const authHeaderValInput = authHeaderRow.locator('input').nth(1);
    await expect(authHeaderValInput).toHaveValue('Bearer my-custom-bearer-token');

    // 8. Hit the endpoint and verify at the Console tab: header appended to request raw
    const sendBtn = window.getByRole('button', { name: /Send Request/i });
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click({ force: true });

    // Wait for response to arrive and switch to Console tab
    const consoleTab = window.getByRole('tab', { name: 'Console', exact: true });
    await expect(consoleTab).toBeVisible({ timeout: 15000 });
    await consoleTab.click({ force: true });

    const requestRawPre = window.locator('pre').filter({ hasText: 'Authorization:' });
    await expect(requestRawPre).toBeVisible({ timeout: 10000 });
    await expect(requestRawPre).toContainText('Authorization: Bearer my-custom-bearer-token');

    // 9. Change auth type to "Inherit From Parent"
    await authTab.click({ force: true });
    await authSelectTrigger.click({ force: true });

    const inheritOption = window.getByRole('option', { name: 'Inherit From Parent' });
    await expect(inheritOption).toBeVisible();
    await inheritOption.click({ force: true });

    // Verify inherit information is rendered in auth tab
    await expect(window.locator('text=Using token from parent collection')).toBeVisible();
    await expect(window.locator('input[value="****************************"]')).toBeVisible();

    // 10. Verify at the Headers tab: Authorization header should have parent token
    await headersTab.click({ force: true });
    await expect(authHeaderValInput).toHaveValue('Bearer parent-bearer-token-123');

    // 11. Hit the endpoint again and verify at the Console tab: parent token header appended
    await sendBtn.click({ force: true });
    await consoleTab.click({ force: true });
    await expect(requestRawPre).toContainText('Authorization: Bearer parent-bearer-token-123');
  });
});
