import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './testing/scenario',
  outputDir: './testing/result/test-results',
  reporter: [
    ['html', { outputFolder: './testing/result/html-report', open: 'never' }],
    ['json', { outputFile: './testing/result/.report-current.json' }],
    [path.resolve(__dirname, 'testing/cache-reporter.cjs')]
  ],
  use: {
    trace: 'off',
  },
  timeout: 30000,
});
