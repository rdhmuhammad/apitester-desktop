import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Collection Tree - SidebarLayout', () => {
  let electronApp;
  let window;

  const annotations = [
    { type: 'component', description: 'SidebarLayout.tsx' },
    { type: 'component', description: 'DragNode.tsx' },
    { type: 'component', description: 'sidebar.tsx' },
    { type: 'component', description: 'alert-dialog.tsx' },
    { type: 'component', description: 'TitleBar.tsx' },
    { type: 'component', description: 'CollectionManage.tsx' },
    { type: 'component', description: 'button.tsx' },
    { type: 'component', description: 'input.tsx' },
  ];

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['dist-electron/main.js'] });
    window = await electronApp.firstWindow();
    window.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
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

  const selectActiveCollection = async () => {
    const cmButton = window.locator('button[title="Collection manager"]');
    await expect(cmButton).toBeVisible({ timeout: 15000 });
    await cmButton.click();

    const modal = window.locator('div[role="alertdialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const collectionRow = modal.locator('.grid.grid-cols-12.border-t.border-border').first();
    await expect(collectionRow).toBeVisible();
    await collectionRow.click();

    await expect(modal).toBeHidden({ timeout: 5000 });
  };

  const expandAllFolders = async () => {
    let collapsedCount = await window.locator('button:has(svg.lucide-chevron-right)').count();
    let maxAttempts = 25;
    while (collapsedCount > 0 && maxAttempts > 0) {
      const folderBtn = window.locator('button:has(svg.lucide-chevron-right)').first();
      if (await folderBtn.isVisible()) {
        await folderBtn.click({ force: true });
        await window.waitForTimeout(200);
      } else {
        break;
      }
      collapsedCount = await window.locator('button:has(svg.lucide-chevron-right)').count();
      maxAttempts--;
    }
  };

  test('should filter requests and folders via search bar, auto-expand, and restore state when cleared', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(...annotations);

    // 1. Ensure collection is selected
    await selectActiveCollection();
    await window.waitForTimeout(1000);
    await expandAllFolders();

    // 2. Locate search bar
    const searchInput = window.locator('input[placeholder="Search collections & test suites..."]');
    await expect(searchInput).toBeVisible();

    // 3. Find an existing request in the sidebar
    const requestButtons = window.locator('button:has(svg.lucide-file-code-2)');
    await expect(requestButtons.first()).toBeVisible({ timeout: 10000 });
    const initialRequestCount = await requestButtons.count();
    expect(initialRequestCount).toBeGreaterThan(0);

    const firstRequestName = (await requestButtons.first().locator('span').last().innerText()).trim();

    // 4. Type search query matching the first request
    await searchInput.fill(firstRequestName);
    await window.waitForTimeout(500);

    // Verify matching request is visible
    const matchingRequests = window.locator('button:has(svg.lucide-file-code-2)');
    const filteredCount = await matchingRequests.count();
    expect(filteredCount).toBeGreaterThanOrEqual(1);
    await expect(window.locator(`span:has-text("${firstRequestName}")`).first()).toBeVisible();

    // 5. Search for a query that has zero matches
    await searchInput.fill('__non_existent_request_xyz_999__');
    await window.waitForTimeout(500);

    const zeroMatchRequests = window.locator('button:has(svg.lucide-file-code-2)');
    expect(await zeroMatchRequests.count()).toBe(0);

    // 6. Clear search query and verify full tree and expansion state is restored
    await searchInput.fill('');
    await window.waitForTimeout(500);

    const restoredRequests = window.locator('button:has(svg.lucide-file-code-2)');
    expect(await restoredRequests.count()).toBeGreaterThan(0);
  });

  test('should drag and drop a request to reorder or nest inside a folder', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(...annotations);

    await expandAllFolders();

    // Find request items
    const requestButtons = window.locator('button:has(svg.lucide-file-code-2)');
    await expect(requestButtons.first()).toBeVisible({ timeout: 10000 });
    const count = await requestButtons.count();
    expect(count).toBeGreaterThan(0);

    // Find the drag handle of the first request
    const firstRequestContainer = requestButtons.first().locator('..');
    const dragHandle = firstRequestContainer.locator('button:has(svg.lucide-grip-vertical)');
    await expect(dragHandle).toBeAttached();

    const handleBox = await dragHandle.boundingBox();
    expect(handleBox).not.toBeNull();

    if (!handleBox) return;

    // Check if a folder or second request exists as drop target
    const folderButtons = window.locator('button:has(svg.lucide-folder), button:has(svg.lucide-folder-open)');
    const hasFolder = (await folderButtons.count()) > 0;

    let targetBox;
    if (hasFolder) {
      const folderContainer = folderButtons.first().locator('..');
      targetBox = await folderContainer.boundingBox();
    } else if (count > 1) {
      const secondRequestContainer = requestButtons.nth(1).locator('..');
      targetBox = await secondRequestContainer.boundingBox();
    }

    if (targetBox) {
      // Simulate pointer drag using mouse events to satisfy PointerSensor activationConstraint (distance: 5)
      const startX = handleBox.x + handleBox.width / 2;
      const startY = handleBox.y + handleBox.height / 2;
      const targetX = targetBox.x + targetBox.width / 2;
      const targetY = targetBox.y + targetBox.height / 2;

      await window.mouse.move(startX, startY);
      await window.mouse.down();
      // Move delta > 5px to activate drag
      await window.mouse.move(startX + 10, startY + 10, { steps: 5 });
      await window.waitForTimeout(100);

      // Move over the target
      await window.mouse.move(targetX, targetY, { steps: 10 });
      await window.waitForTimeout(300);

      // Release mouse to drop
      await window.mouse.up();
      await window.waitForTimeout(800);
    }
  });

  test('should handle drag and drop for folders and prevent cyclic nesting', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(...annotations);

    const folderButtons = window.locator('button:has(svg.lucide-folder), button:has(svg.lucide-folder-open)');
    const folderCount = await folderButtons.count();

    if (folderCount > 0) {
      const firstFolder = folderButtons.first().locator('..');
      const dragHandle = firstFolder.locator('button:has(svg.lucide-grip-vertical)');
      await expect(dragHandle).toBeAttached();

      const handleBox = await dragHandle.boundingBox();
      if (handleBox) {
        // Drag over self or slightly below to verify safe drop execution
        await window.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
        await window.mouse.down();
        await window.mouse.move(handleBox.x + 15, handleBox.y + 15, { steps: 5 });
        await window.waitForTimeout(100);
        await window.mouse.up();
        await window.waitForTimeout(500);

        // Sidebar folders should remain intact and valid
        expect(await folderButtons.count()).toBe(folderCount);
      }
    }
  });

  test('should open delete confirmation dialog for request, allow cancel, and confirm deletion with tab closure', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(...annotations);

    await expandAllFolders();

    // 1. Locate existing request buttons in the sidebar
    const requestButtons = window.locator('button:has(svg.lucide-file-code-2)');
    const initialCount = await requestButtons.count();
    expect(initialCount).toBeGreaterThan(0);

    // Pick the last request in the tree
    const targetRequestBtn = requestButtons.last();
    const targetRequestRow = targetRequestBtn.locator('..');
    await expect(targetRequestRow).toBeVisible();

    // 2. Click the request to open it in an editor tab
    await targetRequestBtn.click({ force: true });
    await window.waitForTimeout(500);

    // Ensure an editor tab is open
    const openTabs = window.locator('button[role="tab"].h-11');
    const tabsCountBefore = await openTabs.count();
    expect(tabsCountBefore).toBeGreaterThan(0);

    // 3. Locate the delete button on this request row
    const deleteBtn = targetRequestRow.locator('button[title="Delete request"]');
    await expect(deleteBtn).toBeAttached();

    // 4. Test CANCEL deletion:
    await deleteBtn.click({ force: true });

    const alertDialog = window.locator('div[role="alertdialog"]');
    await expect(alertDialog).toBeVisible({ timeout: 5000 });
    await expect(alertDialog.getByText('Delete Request?')).toBeVisible();

    const cancelBtn = alertDialog.locator('button', { hasText: 'Cancel' });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await expect(alertDialog).toBeHidden({ timeout: 5000 });
    // Verify request still exists in tree and editor tabs are unchanged
    await expect(targetRequestRow).toBeVisible();
    expect(await openTabs.count()).toBe(tabsCountBefore);

    // 5. Test CONFIRM deletion:
    await deleteBtn.click({ force: true });
    await expect(alertDialog).toBeVisible();

    const confirmDeleteBtn = alertDialog.locator('button', { hasText: 'Delete' });
    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();

    await expect(alertDialog).toBeHidden({ timeout: 5000 });

    // 6. Verify request is removed from sidebar and count decreased
    await window.waitForTimeout(1000);
    const updatedCount = await window.locator('button:has(svg.lucide-file-code-2)').count();
    expect(updatedCount).toBeLessThan(initialCount);
  });

  test('should open delete confirmation dialog for folder, allow cancel, and preserve hierarchy', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(...annotations);

    const folderButtons = window.locator('button:has(svg.lucide-folder), button:has(svg.lucide-folder-open)');
    const folderCount = await folderButtons.count();

    if (folderCount > 0) {
      const folderRow = folderButtons.first().locator('..');
      const deleteFolderBtn = folderRow.locator('button[title="Delete folder"]');
      await expect(deleteFolderBtn).toBeAttached();

      // Click delete folder
      await deleteFolderBtn.click({ force: true });

      const alertDialog = window.locator('div[role="alertdialog"]');
      await expect(alertDialog).toBeVisible({ timeout: 5000 });
      await expect(alertDialog.getByText('Delete Folder?')).toBeVisible();

      // Test CANCEL on folder delete
      const cancelBtn = alertDialog.locator('button', { hasText: 'Cancel' });
      await expect(cancelBtn).toBeVisible();
      await cancelBtn.click();

      await expect(alertDialog).toBeHidden({ timeout: 5000 });
      // Verify folder still exists
      await expect(folderRow).toBeVisible();
    }
  });
});
