import { test, expect, _electron as electron } from '@playwright/test';

test.describe('TitleBar Buttons', () => {
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
    await electronApp.close();
  });

  test('should display the settings (Collection manager) button', async () => {
    test.info().annotations.push(
      { type: 'component', description: 'TitleBar.tsx' },
      { type: 'component', description: 'button.tsx' }
    );
    const settingsButton = window.locator('button[title="Collection manager"]');
    await expect(settingsButton).toBeVisible();
  });

  test('should toggle dark/light mode', async () => {
    test.info().annotations.push(
      { type: 'component', description: 'TitleBar.tsx' },
      { type: 'component', description: 'button.tsx' },
      { type: 'component', description: 'tooltip.tsx' }
    );
    // By default, it might be in dark or light mode based on system or local storage
    const themeButton = window.locator('button[aria-label="Switch to dark mode"], button[aria-label="Switch to light mode"]');
    await expect(themeButton).toBeVisible();
    
    // Capture the initial label
    const initialLabel = await themeButton.getAttribute('aria-label');
    
    // Click the button to toggle theme
    await themeButton.click();
    
    // Expected label after click
    const expectedLabel = initialLabel === 'Switch to dark mode' ? 'Switch to light mode' : 'Switch to dark mode';
    
    // Verify the label changed
    await expect(window.locator(`button[aria-label="${expectedLabel}"]`)).toBeVisible();
  });

  test('should display the socket connection indicator', async () => {
    test.info().annotations.push(
      { type: 'component', description: 'TitleBar.tsx' },
      { type: 'component', description: 'button.tsx' },
      { type: 'component', description: 'tooltip.tsx' }
    );
    // We just check if the button with title starting with "Socket:" is visible
    const socketIndicator = window.locator('button[title^="Socket:"]');
    await expect(socketIndicator).toBeVisible();
  });
});
