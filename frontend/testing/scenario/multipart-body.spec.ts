import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Multipart Form Data Body Editor', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['dist-electron/main.js'] });
    window = await electronApp.firstWindow();
    window.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Mock API responses
    await window.route('**/collection/get-active', route => {
      route.fulfill({
        json: {
          success: true,
          data: {
            id: 'mock-col-1',
            name: 'Mocked Collection',
            is_selected: true,
            description: '',
            version: '1',
            path: ''
          }
        }
      });
    });

    await window.route('**/collection/list', route => {
      route.fulfill({ json: { success: true, data: [] } });
    });

    await window.route('**/restrequest/tree*', route => {
      route.fulfill({ json: { success: true, data: [] } });
    });

    await window.route('**/restrequest/create-request/*', route => {
      route.fulfill({
        json: {
          success: true,
          data: {
            id: 'mock-req-1',
            name: 'New Request',
            method: 'GET',
            body: { mode: 'raw', raw: '{}' }
          }
        }
      });
    });

    await window.route('**/restrequest/*/*', route => {
      route.fulfill({
        json: {
          success: true,
          data: {
            id: 'mock-req-1',
            name: 'New Request',
            method: 'GET',
            url: { path: '' },
            headers: [],
            query: [],
            body: { mode: 'raw', raw: '{}' },
            script: '',
            version: '1'
          }
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
    await electronApp.close();
  });

  test('should manipulate multipart form data fields', async () => {
    test.info().annotations.push(
      { type: 'component', description: 'RequestHeader.tsx' },
      { type: 'component', description: 'dropdown-menu.tsx' },
      { type: 'component', description: 'tabs.tsx' },
      { type: 'component', description: 'RequestConfig/index.tsx' },
      { type: 'component', description: 'BodyEditor.tsx' },
      { type: 'component', description: 'select.tsx' },
      { type: 'component', description: 'input.tsx' },
      { type: 'component', description: 'button.tsx' }
    );
    // 1. Create a new request
    const newTabBtn = window.locator('button').filter({ hasText: 'New Tab' }).first();
    await expect(newTabBtn).toBeVisible({ timeout: 15000 });
    await newTabBtn.click({ force: true });

    const newRequestMenuItem = window.locator('[role="menuitem"]').filter({ hasText: 'New Request' });
    await expect(newRequestMenuItem).toBeVisible();
    await newRequestMenuItem.click({ force: true });

    // 2. Wait for the Body tab in the new request
    const bodyTab = window.getByRole('tab', { name: 'Body', exact: true });
    await expect(bodyTab).toBeVisible({ timeout: 15000 });
    await bodyTab.click({ force: true });

    await window.waitForTimeout(1000);

    // In RequestConfig/index.tsx there's a Select for content type.
    // It initially shows 'JSON Payload' or 'Multipart Form'.
    const selectTrigger = window.locator('button[role="combobox"]').filter({ hasText: /JSON Payload|Multipart Form/i });
    await expect(selectTrigger).toBeVisible();
    await selectTrigger.focus();
    await window.keyboard.press('Space');
    
    // Wait for dropdown animation
    await window.waitForTimeout(500);

    // Select Multipart Form
    const multipartOption = window.getByRole('option', { name: 'Multipart Form' });
    await expect(multipartOption).toBeVisible();
    await window.keyboard.press('ArrowDown');
    await window.keyboard.press('Enter');

    // Wait for dropdown animation to close
    await window.waitForTimeout(500);

    // If body is disabled, enable it by clicking the toggle button
    const toggleLeftBtn = window.locator('button').filter({ has: window.locator('.lucide-toggle-left') });
    if (await toggleLeftBtn.count() > 0 && await toggleLeftBtn.first().isVisible()) {
      await toggleLeftBtn.first().click({ force: true });
    }

    // Wait for the body editor to render the multipart form data view.
    // It should have placeholders "key", "value", "description" for the new field row.
    const keyInput = window.getByPlaceholder('key', { exact: true }).last();
    const valueInput = window.getByPlaceholder('value', { exact: true }).last();
    
    await expect(keyInput).toBeVisible({ timeout: 15000 });
    
    // Add a new field
    await keyInput.fill('myFile');
    await valueInput.fill('testValue');
    
    // Click the Plus button (it's inside the body tab panel)
    const bodyTabPanel = window.locator('[role="tabpanel"]').filter({ hasText: 'Multipart Form' });
    const addButton = bodyTabPanel.locator('button').filter({ has: window.locator('svg.lucide-plus') }).first();
    await expect(addButton).toBeVisible();
    await addButton.click({ force: true });

    // Now a new row should be added. It will have value 'myFile'.
    const addedKeyInput = window.locator('input[value="myFile"]');
    await expect(addedKeyInput).toBeVisible();

    // The type toggle button for the added row is the first one in the body tab (the one in the 'add field' row is the second one)
    const typeButton = bodyTabPanel.locator('button').filter({ hasText: /^text|file$/i }).first();
    await expect(typeButton).toBeVisible();
    await typeButton.click({ force: true });

    // Delete the field (trash button is the only one with trash icon in this panel)
    const trashButton = bodyTabPanel.locator('button').filter({ has: window.locator('svg.lucide-trash-2') }).first();
    await expect(trashButton).toBeVisible();
    await trashButton.click({ force: true });

    // Verify it's deleted
    await expect(addedKeyInput).toHaveCount(0);
  });
});
