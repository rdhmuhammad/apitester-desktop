import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Request Editor', () => {
  let electronApp;
  let window;

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['dist-electron/main.js'] });
    window = await electronApp.firstWindow();
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

  test('should load correct value in request editor when a request is selected', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(
      { type: 'component', description: 'TitleBar.tsx' },
      { type: 'component', description: 'CollectionManage.tsx' },
      { type: 'component', description: 'collectionManager/index.tsx' },
      { type: 'component', description: 'alert-dialog.tsx' },
      { type: 'component', description: 'dialog.tsx' },
      { type: 'component', description: 'SidebarLayout.tsx' },
      { type: 'component', description: 'DragNode.tsx' },
      { type: 'component', description: 'RequestHeader.tsx' },
      { type: 'component', description: 'select.tsx' },
      { type: 'component', description: 'tabs.tsx' },
      { type: 'component', description: 'button.tsx' },
      { type: 'component', description: 'RequestConfig/index.tsx' }
    );
    // 1. Open Collection Manager
    const cmButton = window.locator('button[title="Collection manager"]');
    await expect(cmButton).toBeVisible();
    await cmButton.click();

    // 2. Select first collection
    const modal = window.locator('div[role="alertdialog"]');
    await expect(modal).toBeVisible();

    const collectionRow = modal.locator('.grid.grid-cols-12.border-t.border-border').first();
    await expect(collectionRow).toBeVisible();
    await collectionRow.click();

    // 3. Ensure dialog closes
    await expect(modal).toBeHidden();

    // Expand all folders to make sure we find a request
    let collapsedFoldersCount = await window.locator('button:has(svg.lucide-chevron-right)').count();
    while (collapsedFoldersCount > 0) {
      const folderBtn = window.locator('button:has(svg.lucide-chevron-right)').first();
      await folderBtn.click({ force: true });
      await window.waitForTimeout(200);
      collapsedFoldersCount = await window.locator('button:has(svg.lucide-chevron-right)').count();
    }

    // 4. Find the first request button
    const requestBtn = window.locator('button:has(svg.lucide-file-code-2)').first();
    await expect(requestBtn).toBeVisible();

    // Get the method and name from the sidebar node to verify later
    const methodSpan = requestBtn.locator('span').nth(0);
    const methodText = await methodSpan.innerText();
    
    const nameSpan = requestBtn.locator('span').nth(1);
    const nameText = await nameSpan.innerText();

    // Click the request to open it
    await requestBtn.click({ force: true });

    // 5. Verify the request editor loads the correct value
    await window.waitForTimeout(1000);
    // Active tab should have the request name
    const activeTab = window.locator('button[role="tab"][data-state="active"].h-11').first();
    await expect(activeTab).toBeVisible({ timeout: 10000 });
    await expect(activeTab).toContainText(nameText);

    // Method select should have the request method
    const methodSelect = window.locator('button[role="combobox"]').nth(0);
    await expect(methodSelect).toHaveText(methodText);
  });
});
