# Playwright Component Coverage and Resolution

**Summary**: Explains why Playwright E2E tests cannot natively resolve React components, documents the current static/agentic mapping mechanism, and details automated alternatives for future team evaluation.
**Sources**: `frontend/testing/csv-export.cjs`, `frontend/testing/test-cache-manager.cjs`, `frontend/testing/scenario/titlebar.spec.ts`, `resource/document/wiki/decisions/playwright-cumulative-test-caching.md`
**Last updated**: 2026-10-11

---

## Problem Context

In `frontend/testing/csv-export.cjs`, test scenarios and their associated component coverages are tracked to produce the executive test coverage dashboard (`report.xlsx`, `report.csv`, and `coverage.html`). 

A common architectural question arises: **Why can't Playwright or the frontend test runner automatically resolve which component or page is being tested? Why did this have to be resolved statically or agentically?**

### The Nature of Black-Box E2E Testing

Playwright in this repository executes End-to-End (E2E) tests against the compiled Electron desktop application (`electron.launch({ args: ['dist-electron/main.js'] })`):

1. **DOM Tree vs. React Component Tree**:
   - React components (`TitleBar.tsx`, `VariableInput.tsx`, etc.) are compiled and bundled by Vite into vanilla JavaScript.
   - At runtime, the browser/Chromium only renders standard DOM elements (`<button>`, `<div>`, `<input>`).
   - Playwright queries the live DOM via locators (`window.locator('button[title="..."]')`). It has no runtime access to React component boundaries or source file origins.

2. **Absence of Module Imports in Test Specs**:
   - Unlike unit tests (e.g. Vitest/Jest) where test files explicitly `import` the component under test, E2E test specs do not import UI source code.
   - There is zero static dependency relationship in the import graph between `frontend/testing/scenario/titlebar.spec.ts` and `frontend/src/layout/view/TitleBar.tsx`.

As a consequence, native Playwright E2E tests have no built-in knowledge of what `.tsx` component produced a given DOM node.

---

## Current Architecture in This Codebase

To bridge this gap without heavy infrastructure changes, this project currently uses a two-tier hybrid mapping:

### 1. Spec-Level Annotations
Playwright tests push runtime metadata annotations using `test.info().annotations`:
```typescript
test('should display the settings (Collection manager) button', async () => {
  test.info().annotations.push(
    { type: 'component', description: 'TitleBar.tsx' },
    { type: 'component', description: 'button.tsx' }
  );
  const settingsButton = window.locator('button[title="Collection manager"]');
  await expect(settingsButton).toBeVisible();
});
```
These annotations are parsed by `extractTestsFromSuites()` in `frontend/testing/test-cache-manager.cjs`.

### 2. Static Baseline Fallback (`scenarioDefaults`)
In `frontend/testing/csv-export.cjs`, a hardcoded dictionary maps scenario files to candidate components:
```javascript
const scenarioDefaults = {
  'titlebar.spec.ts': ['TitleBar.tsx', 'button.tsx', 'tooltip.tsx'],
  'request_editor.spec.ts': [ ... ],
  'scripts_tab.spec.ts': [ ... ],
  // ...
};
```
If a test spec lacks explicit annotations, the reporter falls back to `scenarioDefaults`.

### Limitations of the Current Approach
- **Maintenance Overhead**: Every new test scenario or UI refactoring requires manual or agentic updates to `scenarioDefaults` or test annotations.
- **Coarse Accuracy**: A component is considered "Covered" simply because a scenario containing it ran and passed. It does not measure statement, branch, or line-level execution within the component.

---

## Automated Resolution Alternatives (For Review)

When reviewing improvements with the team, consider these alternative approaches:

### Alternative 1: Runtime Code Coverage Instrumentation (V8 / Istanbul)
- **Mechanism**: Use `vite-plugin-istanbul` or Chrome DevTools Protocol (CDP) `page.coverage.startJSCoverage()` / `stopJSCoverage()`.
- **How it works**: Instruments bundled JavaScript and maps executed lines back to TypeScript source files using source maps.
- **Pros**:
  - 100% automated; no manual annotations or `scenarioDefaults` needed.
  - Generates true line, branch, and function coverage metrics (LCOV, Cobertura).
- **Cons**:
  - In Electron, capturing coverage across both Chromium renderer and Node.js main processes requires custom IPC or CDP plumbing.
  - Slightly increases build and test execution time.

### Alternative 2: Playwright Component Testing (`@playwright/experimental-ct-react`)
- **Mechanism**: Test components in isolation inside a lightweight test harness instead of launching the entire Electron desktop binary.
- **How it works**: Tests directly `import` components (`import { TitleBar } from '@/layout/view/TitleBar'`).
- **Pros**:
  - The component under test is explicitly known by static import.
  - Much faster test execution and minimal RAM usage.
- **Cons**:
  - Cannot test Electron-specific APIs (IPC calls, native menus, window maximization).
  - Complements rather than completely replaces desktop E2E tests.

### Alternative 3: Automated JSX DOM Attribute Injection (Babel / Vite Plugin)
- **Mechanism**: A compiler transform (e.g. `babel-plugin-react-component-data-attribute`) injects a `data-component="TitleBar"` attribute into component root elements during test builds.
- **How it works**: Playwright hooks into `page.on('locator')` or inspects DOM elements during actions (`click`, `fill`) to dynamically record which components were touched.
- **Pros**:
  - Zero test spec boilerplate (no `test.info().annotations.push`).
  - Automatic attribution to actual interacted components.
- **Cons**:
  - Only detects components that render top-level DOM nodes touched by locators; does not measure internal component logic.

---

## Summary Matrix

| Strategy | Automation Level | Accuracy | Electron Setup Complexity | Maintenance Burden |
| :--- | :--- | :--- | :--- | :--- |
| **Static Defaults + Annotations (Current)** | Manual / Agentic | Coarse (Scenario-level) | None (Simple script) | High (Manual sync needed) |
| **V8 / Istanbul Code Coverage** | Fully Automated | Fine (Line / Branch) | Medium - High | Zero maintenance |
| **Playwright Component Testing (CT)** | Fully Automated | High (Per component) | Low (Separate runner) | Low |
| **DOM `data-component` Tagging** | Semi-Automated | Medium (Interacted only) | Low (Vite plugin) | Low |

---

## Related pages

- [[decisions/playwright-cumulative-test-caching]]
- [[decisions/google-drive-service-account-sync]]
- [[concepts/frontend/redux-toolkit]]
- [[concepts/index]]
