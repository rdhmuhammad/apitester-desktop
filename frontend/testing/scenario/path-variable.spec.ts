import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Params Tab - Path Variables', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['dist-electron/main.js'] });
    window = await electronApp.firstWindow();

    // Intercept test endpoint so requests return immediately with 200 OK
    await window.route(/test-path-variable/, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        json: {
          success: true,
          message: 'Path variable request received'
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

  test('should synchronize path variables from endpoint, allow value editing, resolve variables on send, and reset or add variables on endpoint modification', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(
      { type: 'component', description: 'RequestHeader.tsx' },
      { type: 'component', description: 'tabs.tsx' },
      { type: 'component', description: 'RequestConfig/index.tsx' },
      { type: 'component', description: 'ParamsContent.tsx' },
      { type: 'component', description: 'VariableInput.tsx' },
      { type: 'component', description: 'ResponseView.tsx' },
      { type: 'component', description: 'input.tsx' },
      { type: 'component', description: 'button.tsx' }
    );

    // 1. Open Collection Manager and select collection to ensure active collection is loaded
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
    await window.waitForTimeout(600);

    // Wait for the Request editor to show up
    const methodSelect = window.locator('button[role="combobox"]').nth(0);
    await expect(methodSelect).toBeVisible({ timeout: 10000 });

    // 3. Ensure Params tab is selected
    const paramsTab = window.getByRole('tab', { name: 'Params', exact: true });
    await expect(paramsTab).toBeVisible({ timeout: 15000 });
    await paramsTab.click({ force: true });

    // Initially, before adding path variables, the "Path Variables" table should not exist
    const pathVarsHeading = window.locator('h3').filter({ hasText: 'Path Variables' });
    await expect(pathVarsHeading).toHaveCount(0);

    // 4. Input path variable at request header endpoint: /test-path-variable/:userId
    const endpointInput = window.getByLabel('Endpoint path');
    await expect(endpointInput).toBeVisible({ timeout: 15000 });
    await endpointInput.fill('/test-path-variable/:userId');
    await endpointInput.blur();

    // Wait for debounced sync with backend
    await window.waitForTimeout(600);

    // 5. It should appear at path variable table at the Params tab
    await expect(pathVarsHeading).toBeVisible({ timeout: 10000 });

    const userIdKeyInput = window.locator('input[value="userId"]');
    await expect(userIdKeyInput).toBeVisible({ timeout: 10000 });

    const userIdRow = window.locator('.grid.grid-cols-12').filter({ has: userIdKeyInput });
    const userIdValueInput = userIdRow.locator('input[placeholder="value"]');
    await expect(userIdValueInput).toBeVisible();
    await expect(userIdValueInput).toHaveValue('');

    // 6. Try to edit the value of the path variable
    await userIdValueInput.fill('user-12345');
    await userIdValueInput.blur();
    await window.waitForTimeout(600);
    await expect(userIdValueInput).toHaveValue('user-12345');

    // 7. Try to send request
    const sendBtn = window.getByRole('button', { name: /Send Request/i });
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click({ force: true });
    await window.waitForTimeout(1000);

    // 8. Check at the console the path variable should be using the value from the Params tab
    const consoleTab = window.getByRole('tab', { name: 'Console', exact: true });
    await expect(consoleTab).toBeVisible({ timeout: 15000 });
    await consoleTab.click({ force: true });
    await window.waitForTimeout(500);

    const requestRawPre = window.locator('pre').filter({ hasText: 'HTTP/1.1' });
    await expect(requestRawPre).toBeVisible({ timeout: 10000 });
    await expect(requestRawPre).toContainText('/test-path-variable/user-12345');

    // 9. Modify path variable at endpoint: modifying existing path variable should reset the field value at table
    await paramsTab.click({ force: true });
    await endpointInput.fill('/test-path-variable/:accountId');
    await endpointInput.blur();
    await window.waitForTimeout(600);

    // Old path variable key userId should be removed
    await expect(window.locator('input[value="userId"]')).toHaveCount(0);

    // New path variable key accountId should appear
    const accountIdKeyInput = window.locator('input[value="accountId"]');
    await expect(accountIdKeyInput).toBeVisible({ timeout: 10000 });

    // The field value for the new path variable should be reset / empty
    const accountIdRow = window.locator('.grid.grid-cols-12').filter({ has: accountIdKeyInput });
    const accountIdValueInput = accountIdRow.locator('input[placeholder="value"]');
    await expect(accountIdValueInput).toHaveValue('');

    // 10. Typing another path variable at endpoint adds new item to table path variable
    await endpointInput.fill('/test-path-variable/:accountId/orders/:orderId');
    await endpointInput.blur();
    await window.waitForTimeout(600);

    // Both accountId and orderId should now be in the path variable table
    await expect(window.locator('input[value="accountId"]')).toBeVisible({ timeout: 10000 });
    const orderIdKeyInput = window.locator('input[value="orderId"]');
    await expect(orderIdKeyInput).toBeVisible({ timeout: 10000 });

    const orderIdRow = window.locator('.grid.grid-cols-12').filter({ has: orderIdKeyInput });
    const orderIdValueInput = orderIdRow.locator('input[placeholder="value"]');
    await expect(orderIdValueInput).toHaveValue('');

    // 11. Edit both values and send request to verify resolution of multiple path variables
    await accountIdValueInput.fill('acc-999');
    await accountIdValueInput.blur();
    await orderIdValueInput.fill('ord-888');
    await orderIdValueInput.blur();
    await window.waitForTimeout(600);

    await expect(accountIdValueInput).toHaveValue('acc-999');
    await expect(orderIdValueInput).toHaveValue('ord-888');

    await sendBtn.click({ force: true });
    await window.waitForTimeout(1000);
    await consoleTab.click({ force: true });
    await expect(requestRawPre).toContainText('/test-path-variable/acc-999/orders/ord-888');
  });
});
