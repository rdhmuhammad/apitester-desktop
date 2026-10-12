import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Collection Manager - Manage Variables', () => {
  let electronApp;
  let window;

  const annotations = [
    { type: 'component', description: 'TitleBar.tsx' },
    { type: 'component', description: 'collectionManager/index.tsx' },
    { type: 'component', description: 'VariableManage.tsx' },
    { type: 'component', description: 'alert-dialog.tsx' },
    { type: 'component', description: 'tabs.tsx' },
    { type: 'component', description: 'input.tsx' },
    { type: 'component', description: 'button.tsx' },
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

    // Ensure an active collection is selected
    const cmButton = window.locator('button[title="Collection manager"]');
    await expect(cmButton).toBeVisible({ timeout: 15000 });
    await cmButton.click();

    const modal = window.locator('div[role="alertdialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    const collectionRow = modal.locator('.grid.grid-cols-12.border-t.border-border').first();
    if (await collectionRow.isVisible()) {
      await collectionRow.click();
      await expect(modal).toBeHidden({ timeout: 5000 });
    } else {
      await modal.locator('button:has-text("Close")').click();
      await expect(modal).toBeHidden({ timeout: 5000 });
    }
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  const openVariableManageTab = async () => {
    const cmButton = window.locator('button[title="Collection manager"]');
    await expect(cmButton).toBeVisible({ timeout: 15000 });

    const modal = window.locator('div[role="alertdialog"]');
    if (!(await modal.isVisible())) {
      await cmButton.click();
      await expect(modal).toBeVisible({ timeout: 5000 });
    }

    const variablesTab = modal.locator('button[title="Variables"]');
    await expect(variablesTab).toBeVisible({ timeout: 5000 });
    await variablesTab.click();
    await window.waitForTimeout(300);

    return modal;
  };

  const findVariableRow = async (modal: any, targetKey: string) => {
    const rows = modal.locator('.flex-1.overflow-auto .grid.grid-cols-12.border-t.border-border');
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const keyVal = await row.locator('.col-span-5 input').first().inputValue();
      if (keyVal === targetKey) {
        return row;
      }
    }
    return null;
  };

  test('should open Collection Manager and switch to Variables tab', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(...annotations);

    const modal = await openVariableManageTab();

    // Verify table headers (Key, Value) and Add inputs are visible
    await expect(modal.locator('text=Key')).toBeVisible();
    await expect(modal.locator('text=Value')).toBeVisible();

    const addKeyInput = modal.locator('input[placeholder="Key"]');
    const addValInput = modal.locator('input[placeholder="Value"]');
    const addBtn = modal.locator('button').filter({ hasText: 'Add' });

    await expect(addKeyInput).toBeVisible();
    await expect(addValInput).toBeVisible();
    await expect(addBtn).toBeVisible();
  });

  test('should add new variable items via Add button and Enter key', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(...annotations);

    const modal = await openVariableManageTab();

    const addKeyInput = modal.locator('input[placeholder="Key"]');
    const addValInput = modal.locator('input[placeholder="Value"]');
    const addBtn = modal.locator('button').filter({ hasText: 'Add' });

    // --- Sub-test A: Add variable using Add button ---
    const timestamp = Date.now();
    const varKey1 = `VAR_BTN_${timestamp}`;
    const varVal1 = `VAL_BTN_${timestamp}`;

    await addKeyInput.fill(varKey1);
    await addValInput.fill(varVal1);
    await addBtn.click();

    // Verify inputs reset after adding
    await expect(addKeyInput).toHaveValue('');
    await expect(addValInput).toHaveValue('');

    // Verify item row is rendered in the list
    await expect.poll(async () => {
      const row = await findVariableRow(modal, varKey1);
      return row !== null;
    }, { timeout: 10000 }).toBe(true);

    const row1 = (await findVariableRow(modal, varKey1))!;
    const row1ValInput = row1.locator('.col-span-5 input').nth(1);
    await expect(row1ValInput).toHaveValue(varVal1);

    // --- Sub-test B: Add variable using Enter key on Value input ---
    const varKey2 = `VAR_ENTER_${timestamp}`;
    const varVal2 = `VAL_ENTER_${timestamp}`;

    await addKeyInput.fill(varKey2);
    await addValInput.fill(varVal2);
    await addValInput.press('Enter');

    // Verify inputs reset after adding
    await expect(addKeyInput).toHaveValue('');
    await expect(addValInput).toHaveValue('');

    // Verify item row is rendered in the list
    await expect.poll(async () => {
      const row = await findVariableRow(modal, varKey2);
      return row !== null;
    }, { timeout: 10000 }).toBe(true);

    const row2 = (await findVariableRow(modal, varKey2))!;
    const row2ValInput = row2.locator('.col-span-5 input').nth(1);
    await expect(row2ValInput).toHaveValue(varVal2);

    // --- Sub-test C: Validation - Should not add item when key is empty ---
    const initialRowCount = await modal.locator('.flex-1.overflow-auto .grid.grid-cols-12.border-t.border-border').count();
    await addKeyInput.fill('   ');
    await addValInput.fill('empty_key_val');
    await addBtn.click();

    const postAttemptRowCount = await modal.locator('.flex-1.overflow-auto .grid.grid-cols-12.border-t.border-border').count();
    expect(postAttemptRowCount).toBe(initialRowCount);

    // Clear draft value input
    await addValInput.fill('');
  });

  test('should edit existing variable key and value', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(...annotations);

    const modal = await openVariableManageTab();

    const addKeyInput = modal.locator('input[placeholder="Key"]');
    const addValInput = modal.locator('input[placeholder="Value"]');
    const addBtn = modal.locator('button').filter({ hasText: 'Add' });

    // 1. Create a variable dedicated for edit test
    const timestamp = Date.now();
    const originalKey = `VAR_EDIT_${timestamp}`;
    const originalVal = `VAL_ORIG_${timestamp}`;

    await addKeyInput.fill(originalKey);
    await addValInput.fill(originalVal);
    await addBtn.click();

    await expect.poll(async () => {
      const row = await findVariableRow(modal, originalKey);
      return row !== null;
    }, { timeout: 10000 }).toBe(true);

    const row = (await findVariableRow(modal, originalKey))!;
    const keyInput = row.locator('.col-span-5 input').first();
    const valInput = row.locator('.col-span-5 input').nth(1);

    // 2. Edit Key and blur to save
    const updatedKey = `${originalKey}_MODIFIED`;
    await keyInput.fill(updatedKey);
    await keyInput.blur();
    await window.waitForTimeout(500);

    // Verify key input updated
    await expect.poll(async () => {
      const r = await findVariableRow(modal, updatedKey);
      return r !== null;
    }, { timeout: 10000 }).toBe(true);

    // 3. Edit Value and blur to save
    const updatedVal = `${originalVal}_MODIFIED`;
    const updatedRow = (await findVariableRow(modal, updatedKey))!;
    const updatedValInput = updatedRow.locator('.col-span-5 input').nth(1);
    await updatedValInput.fill(updatedVal);
    await updatedValInput.blur();
    await window.waitForTimeout(500);

    // Verify value input updated
    await expect.poll(async () => {
      const r = await findVariableRow(modal, updatedKey);
      if (!r) return null;
      return await r.locator('.col-span-5 input').nth(1).inputValue();
    }, { timeout: 10000 }).toBe(updatedVal);
  });

  test('should delete variable items from the list', async () => {
    test.setTimeout(60000);
    test.info().annotations.push(...annotations);

    const modal = await openVariableManageTab();

    const addKeyInput = modal.locator('input[placeholder="Key"]');
    const addValInput = modal.locator('input[placeholder="Value"]');
    const addBtn = modal.locator('button').filter({ hasText: 'Add' });

    // 1. Create a variable dedicated for delete test
    const timestamp = Date.now();
    const deleteKey = `VAR_DEL_${timestamp}`;
    const deleteVal = `VAL_DEL_${timestamp}`;

    await addKeyInput.fill(deleteKey);
    await addValInput.fill(deleteVal);
    await addBtn.click();

    await expect.poll(async () => {
      const row = await findVariableRow(modal, deleteKey);
      return row !== null;
    }, { timeout: 10000 }).toBe(true);

    const row = (await findVariableRow(modal, deleteKey))!;

    // 2. Click delete button on the row
    const deleteBtn = row.locator('button').first();
    await deleteBtn.scrollIntoViewIfNeeded();
    await deleteBtn.click({ force: true });

    // Verify success toast or row removal
    await expect(window.locator('text=Variable deleted')).toBeVisible({ timeout: 5000 });

    // 3. Verify the item row is removed from the table
    await expect.poll(async () => {
      const r = await findVariableRow(modal, deleteKey);
      return r !== null;
    }, { timeout: 10000 }).toBe(false);
  });
});
