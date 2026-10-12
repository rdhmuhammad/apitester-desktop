const path = require('path');
const fs = require('fs');
const cacheManager = require('./test-cache-manager.cjs');

class CacheReporter {
  constructor(options = {}) {
    this.options = options;
  }

  async onEnd(result) {
    const currentJsonPath = cacheManager.getCurrentJsonPath();
    if (!fs.existsSync(currentJsonPath)) {
      console.warn('[CacheReporter] No .report-current.json found to merge.');
      return;
    }

    try {
      const currentReport = JSON.parse(fs.readFileSync(currentJsonPath, 'utf8'));
      const cache = cacheManager.loadCache();
      
      const newlyTestedScenarios = (currentReport.suites || []).map(s => 
        cacheManager.normalizeScenarioFileName(s.file || s.title)
      ).filter(Boolean);
      
      cacheManager.updateCacheFromReport(currentReport, cache, { pruneDeleted: true });
      
      const mergedReport = cacheManager.buildMergedReport(cache, currentReport.config);
      const reportJsonPath = cacheManager.getReportPath();
      fs.writeFileSync(reportJsonPath, JSON.stringify(mergedReport, null, 2), 'utf8');

      const cachedScenarioNames = Object.keys(cache.scenarios);
      console.log('\n==================================================');
      console.log(`💾 [Test Cache] Merged ${newlyTestedScenarios.length} scenario(s) into persistent cache: [${newlyTestedScenarios.join(', ')}]`);
      console.log(`💾 [Test Cache] Total cached scenarios: ${cachedScenarioNames.length} (${cachedScenarioNames.join(', ')})`);
      console.log(`💾 [Test Cache] Cumulative report.json updated successfully.`);
      console.log('==================================================\n');

      // Regenerate Excel, CSV, HTML reports with cumulative cache
      const { generateReports } = require('./csv-export.cjs');
      const shouldSync = process.argv.includes('--sync') || process.argv.includes('--sync-gdrive');
      await generateReports({ skipGDriveSync: !shouldSync });
    } catch (err) {
      console.error('[CacheReporter] Error processing test cache:', err);
    }
  }
}

module.exports = CacheReporter;
