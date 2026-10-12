import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Header Content', () => {
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

  test('testing in header content: add new header, toggle header, fast type value, and remove header', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(
      { type: 'component', description: 'RequestHeader.tsx' },
      { type: 'component', description: 'tabs.tsx' },
      { type: 'component', description: 'RequestConfig/index.tsx' },
      { type: 'component', description: 'HeadersContent.tsx' },
      { type: 'component', description: 'VariableInput.tsx' },
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

    // 3. Switch to Headers tab
    const headersTab = window.getByRole('tab', { name: 'Headers', exact: true });
    await expect(headersTab).toBeVisible({ timeout: 15000 });
    await headersTab.click({ force: true });

    // Locate the Add Header inputs and button
    const addKeyInput = window.locator('input[placeholder="header key"]');
    const addValueInput = window.locator('input[placeholder="header value"]');
    await expect(addKeyInput).toBeVisible({ timeout: 10000 });
    await expect(addValueInput).toBeVisible({ timeout: 10000 });

    const addRow = window.locator('.grid.grid-cols-12').filter({ has: addKeyInput });
    const addBtn = addRow.locator('button');
    await expect(addBtn).toBeVisible();

    // 4. Add new header item
    const testHeaderKey = 'X-Custom-Test';
    const initialHeaderValue = 'initial-value';
    await addKeyInput.fill(testHeaderKey);
    await addValueInput.fill(initialHeaderValue);
    await addBtn.click({ force: true });

    // Verify row appears in Headers tab
    const headerRow = window.locator('.grid.grid-cols-12').filter({ has: window.locator(`input[value="${testHeaderKey}"]`) });
    await expect(headerRow).toBeVisible({ timeout: 10000 });

    const headerValInput = headerRow.locator('input').nth(1);
    await expect(headerValInput).toHaveValue(initialHeaderValue);

    // Verify add inputs are reset
    await expect(addKeyInput).toHaveValue('');
    await expect(addValueInput).toHaveValue('');

    // 5. Toggle header item
    const toggleBtn = headerRow.locator('button').first();
    // Toggle off (disabled)
    await toggleBtn.click({ force: true });
    await expect(headerRow).toHaveClass(/opacity-50/);
    await expect(headerValInput).toBeDisabled();
    await expect(headerRow.locator('svg.lucide-toggle-left')).toBeVisible();

    // Toggle on (enabled)
    await toggleBtn.click({ force: true });
    await expect(headerRow).not.toHaveClass(/opacity-50/);
    await expect(headerValInput).toBeEnabled();
    await expect(headerRow.locator('svg.lucide-toggle-right')).toBeVisible();

    // 6. Try type value at header item: fast type "my name is jhon doe"
    // The value appeared at input field after that should be the same
    await headerValInput.click({ force: true });
    await headerValInput.fill('');
    const typedText = 'my name is jhon doe';
    await headerValInput.pressSequentially(typedText, { delay: 20 });
    await window.waitForTimeout(600);
    await expect(headerValInput).toHaveValue(typedText);

    // 7. Remove header item
    const deleteBtn = headerRow.locator('button').nth(1);
    await deleteBtn.click({ force: true });

    // Verify header item was removed
    await expect(window.locator(`input[value="${testHeaderKey}"]`)).toHaveCount(0);
  });
});
