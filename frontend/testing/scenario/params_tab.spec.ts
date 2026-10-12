import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Params Tab', () => {
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

  test('should synchronize query params with request header endpoint when adding, toggling, and deleting params', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(
      { type: 'component', description: 'RequestHeader.tsx' },
      { type: 'component', description: 'tabs.tsx' },
      { type: 'component', description: 'RequestConfig/index.tsx' },
      { type: 'component', description: 'ParamsContent.tsx' },
      { type: 'component', description: 'VariableInput.tsx' },
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

    // 3. Set endpoint path in request header
    const endpointInput = window.getByLabel('Endpoint path');
    await expect(endpointInput).toBeVisible({ timeout: 15000 });
    await endpointInput.fill('/api/v1/users');
    await endpointInput.blur();
    await window.waitForTimeout(500);
    await expect(endpointInput).toHaveValue('/api/v1/users');

    // 4. Ensure Params tab is selected in RequestConfig
    const paramsTab = window.getByRole('tab', { name: 'Params', exact: true });
    await expect(paramsTab).toBeVisible({ timeout: 15000 });
    await paramsTab.click({ force: true });

    // Locate the Add Query Param inputs and button
    const addRow = window.locator('.grid.grid-cols-12').filter({ has: window.locator('input[placeholder="key"]') });
    await expect(addRow).toBeVisible({ timeout: 10000 });
    const addKeyInput = addRow.locator('input[placeholder="key"]');
    const addValueInput = addRow.locator('input[placeholder="value"]');
    const addDescInput = addRow.locator('input[placeholder="description"]');
    const addBtn = addRow.locator('button');

    // 5. Add first query param: page=1
    await addKeyInput.fill('page');
    await addValueInput.fill('1');
    await addDescInput.fill('page number');
    await addBtn.click();

    // Verify row appears in Params tab
    const pageRow = window.locator('.grid.grid-cols-12').filter({ has: window.locator('input[value="page"]') });
    await expect(pageRow).toBeVisible({ timeout: 10000 });
    const pageValInput = pageRow.locator('input').nth(1);
    await expect(pageValInput).toHaveValue('1');

    // Verify request header endpoint reflects added param
    await expect(endpointInput).toHaveValue('/api/v1/users?page=1');

    // 6. Add second query param: limit=20
    await addKeyInput.fill('limit');
    await addValueInput.fill('20');
    await addDescInput.fill('items limit');
    await addBtn.click();

    // Verify second row appears in Params tab
    const limitRow = window.locator('.grid.grid-cols-12').filter({ has: window.locator('input[value="limit"]') });
    await expect(limitRow).toBeVisible({ timeout: 10000 });
    const limitValInput = limitRow.locator('input').nth(1);
    await expect(limitValInput).toHaveValue('20');

    // Verify request header endpoint reflects both params
    await expect(endpointInput).toHaveValue('/api/v1/users?page=1&limit=20');

    // 7. Add third query param: sort=desc
    await addKeyInput.fill('sort');
    await addValueInput.fill('desc');
    await addDescInput.fill('sort order');
    await addBtn.click();

    // Verify third row appears in Params tab
    const sortRow = window.locator('.grid.grid-cols-12').filter({ has: window.locator('input[value="sort"]') });
    await expect(sortRow).toBeVisible({ timeout: 10000 });
    const sortValInput = sortRow.locator('input').nth(1);
    await expect(sortValInput).toHaveValue('desc');

    // Verify request header endpoint reflects all three params
    await expect(endpointInput).toHaveValue('/api/v1/users?page=1&limit=20&sort=desc');

    // 8. Toggle disable on 'limit' param
    const limitToggleBtn = limitRow.locator('button').first();
    await limitToggleBtn.click();
    await expect(limitRow.locator('svg.lucide-toggle-left')).toBeVisible({ timeout: 10000 });

    // Verify request header endpoint excludes the disabled param
    await expect(endpointInput).toHaveValue('/api/v1/users?page=1&sort=desc');

    // 9. Toggle disable on 'page' param
    const pageToggleBtn = pageRow.locator('button').first();
    await pageToggleBtn.click();
    await expect(pageRow.locator('svg.lucide-toggle-left')).toBeVisible({ timeout: 10000 });

    // Verify request header endpoint excludes both disabled params
    await expect(endpointInput).toHaveValue('/api/v1/users?sort=desc');

    // 10. Toggle enable back on for 'page'
    await pageToggleBtn.click();
    await expect(pageRow.locator('svg.lucide-toggle-right')).toBeVisible({ timeout: 10000 });

    // Verify request header endpoint includes re-enabled 'page' param
    await expect(endpointInput).toHaveValue('/api/v1/users?page=1&sort=desc');

    // 11. Toggle enable back on for 'limit'
    await limitToggleBtn.click();
    await expect(limitRow.locator('svg.lucide-toggle-right')).toBeVisible({ timeout: 10000 });

    // Verify request header endpoint includes all three enabled params
    await expect(endpointInput).toHaveValue('/api/v1/users?page=1&limit=20&sort=desc');

    // 12. Delete 'sort' query param
    const sortDeleteBtn = sortRow.locator('button:has(svg.lucide-trash-2)');
    await sortDeleteBtn.click();
    await expect(sortRow).toBeHidden({ timeout: 10000 });

    // Verify request header endpoint updates after deleting 'sort'
    await expect(endpointInput).toHaveValue('/api/v1/users?page=1&limit=20');

    // 13. Delete 'page' query param
    const pageDeleteBtn = pageRow.locator('button:has(svg.lucide-trash-2)');
    await pageDeleteBtn.click();
    await expect(pageRow).toBeHidden({ timeout: 10000 });

    // Verify request header endpoint updates after deleting 'page'
    await expect(endpointInput).toHaveValue('/api/v1/users?limit=20');

    // 14. Delete 'limit' query param (last remaining param)
    const limitDeleteBtn = limitRow.locator('button:has(svg.lucide-trash-2)');
    await limitDeleteBtn.click();
    await expect(limitRow).toBeHidden({ timeout: 10000 });

    // Verify request header endpoint has no query string left
    await expect(endpointInput).toHaveValue('/api/v1/users');
  });
});
