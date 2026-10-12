# Playwright Cumulative Test Scenario Caching

**Summary**: Architecture and mechanism for incrementally caching Playwright test scenario results and component coverage across separate runs to prevent RAM exhaustion and preserve cumulative reports.
**Sources**: `frontend/testing/test-cache-manager.cjs`, `frontend/testing/cache-reporter.cjs`, `frontend/testing/csv-export.cjs`, `frontend/playwright.config.ts`, `frontend/package.json`
**Last updated**: 2026-10-11

---

## Context and Motivation

Running a comprehensive suite of Playwright test scenarios simultaneously spins up multiple Electron application instances (`dist-electron/main.js`). This causes high peak memory utilization that can exceed the RAM capacity of developer workstations.

Previously, running a single test scenario caused Playwright to overwrite `report.json` and `html-report`, leaving only the most recently executed scenario in the exported Excel (`report.xlsx`), CSV (`report.csv`), and HTML coverage dashboards. Any previously executed scenarios were discarded, falsely dropping component coverage rates.

## Architectural Decision

We implemented a persistent, cumulative test result caching pipeline:

1. **Persistent Cache Store (`test-cache.json`)**:
   - Stores executed test scenarios keyed by scenario file name (`scenarios[fileName]`).
   - Retains full Playwright suite trees, annotations, durations, and pass/fail statuses.
   - Automatically prunes deleted test scenario files from the cache.

2. **Custom Playwright Reporter (`cache-reporter.cjs`)**:
   - Integrated directly into `playwright.config.ts`.
   - On completion of any Playwright test execution (`onEnd`), reads the current run output (`.report-current.json`), merges newly run or updated scenarios into `test-cache.json`, and rebuilds a complete cumulative `report.json`.
   - Immediately triggers report generation (`report.xlsx`, `report.csv`, `coverage.html`) with all cached scenarios.

3. **Cumulative Export & Sync (`csv-export.cjs`)**:
   - Reads the cumulative cache and merges all executed scenarios.
   - Dynamically discovers all scenario files on disk in `frontend/testing/scenario/`.
   - Generates executive Excel reports (`report.xlsx`) where:
     - **Sheet 1 (Dashboard & Overview)** displays all scenarios with `PASSED`, `FAILED`, or `PENDING` statuses.
     - **Sheet 2 (Test Execution Results)** details every test spec from all cached scenarios.
     - **Sheet 3 (Component Coverage Matrix)** computes cumulative component coverage across all cached runs without requiring all scenarios to run simultaneously.
   - Injects the cumulative dashboard into `html-report/index.html`.
   - Automatically syncs the complete `report.xlsx` to Google Drive when credentials are present.

4. **Cache Control**:
   - `pnpm test:cache:clear` resets the cache to a clean slate when desired.
   - `pnpm test:export --clear-cache` clears the cache before generating reports.

## Related pages

- [[decisions/index]]
- [[decisions/google-drive-service-account-sync]]
- [[tasks/backlog]]
