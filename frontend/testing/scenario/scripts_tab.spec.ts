import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Scripts Tab Autocomplete', () => {
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

  test('should show autocomplete in scripts tab and allow selection with tab', async () => {
    test.info().annotations.push(
      { type: 'component', description: 'RequestHeader.tsx' },
      { type: 'component', description: 'dropdown-menu.tsx' },
      { type: 'component', description: 'tabs.tsx' },
      { type: 'component', description: 'RequestConfig/index.tsx' },
      { type: 'component', description: 'ScriptEditor.tsx' },
      { type: 'component', description: 'sandpack-script-editor.tsx' },
      { type: 'component', description: 'select.tsx' },
      { type: 'component', description: 'button.tsx' }
    );
    // 1. Create a new request directly via New Tab button
    const newTabBtn = window.getByRole('button', { name: /New Tab/i });
    await expect(newTabBtn).toBeVisible({ timeout: 10000 });
    await newTabBtn.click({ force: true });

    const newRequestMenuItem = window.getByRole('menuitem', { name: /New Request/i });
    await expect(newRequestMenuItem).toBeVisible();
    await newRequestMenuItem.click({ force: true });

    // Wait for the Request editor to show up (check for method select or similar)
    const methodSelect = window.locator('button[role="combobox"]').nth(0);
    await expect(methodSelect).toBeVisible({ timeout: 10000 });

    // 3. Move to the tab scripts
    const scriptsTab = window.locator('button[role="tab"]:has-text("Scripts")');
    await expect(scriptsTab).toBeVisible();
    await scriptsTab.click({ force: true });

    // 4. Edit the script
    const editor = window.locator('.cm-content').first();
    await expect(editor).toBeVisible({ timeout: 10000 });
    
    // Give CodeMirror editor some time to initialize fully
    await window.waitForTimeout(1000);

    // Click inside the editor to focus
    await editor.click({ force: true });

    // Clear existing text if any (optional, but good practice)
    await window.keyboard.press('Control+A');
    await window.keyboard.press('Backspace');

    // Type `pm.`
    await window.keyboard.type('pm.');

    // Autocomplete should appear (CodeMirror autocomplete widget)
    const suggestWidget = window.locator('.cm-tooltip-autocomplete');
    await expect(suggestWidget).toBeVisible();

    // Clicking button tab should select the item in the autocomplete
    await window.keyboard.press('Tab');
    
    // Autocomplete widget should disappear after selection
    await expect(suggestWidget).toBeHidden();

    // Add a new line
    await window.keyboard.press('Enter');

    // Type `response.`
    await window.keyboard.type('response.');

    // Autocomplete should appear again
    await expect(suggestWidget).toBeVisible();

    // Clicking button tab should select the item in the autocomplete
    await window.keyboard.press('Tab');

    // Autocomplete widget should disappear after selection
    await expect(suggestWidget).toBeHidden();
  });
});
