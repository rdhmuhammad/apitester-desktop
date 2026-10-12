const fs = require('fs');
const path = require('path');

const resultDir = path.join(__dirname, 'result');
const cachePath = path.join(resultDir, 'test-cache.json');
const reportJsonPath = path.join(resultDir, 'report.json');
const currentJsonPath = path.join(resultDir, '.report-current.json');
const scenarioDir = path.join(__dirname, 'scenario');

function getCachePath() {
  return cachePath;
}

function getReportPath() {
  return reportJsonPath;
}

function getCurrentJsonPath() {
  return currentJsonPath;
}

function ensureResultDir() {
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir, { recursive: true });
  }
}

function countSuiteSpecs(suite) {
  let specsCount = (suite.specs || []).length;
  for (const child of suite.suites || []) {
    specsCount += countSuiteSpecs(child);
  }
  return specsCount;
}

function countSuiteResults(suite) {
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let flaky = 0;
  let duration = 0;

  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      for (const res of test.results || []) {
        duration += (res.duration || 0);
        if (res.status === 'passed') passed++;
        else if (res.status === 'skipped') skipped++;
        else failed++;
      }
      if (test.status === 'flaky') flaky++;
    }
  }

  for (const child of suite.suites || []) {
    const sub = countSuiteResults(child);
    passed += sub.passed;
    failed += sub.failed;
    skipped += sub.skipped;
    flaky += sub.flaky;
    duration += sub.duration;
  }

  return { passed, failed, skipped, flaky, duration };
}

function loadCache() {
  ensureResultDir();

  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (data && typeof data === 'object' && data.scenarios) {
        return data;
      }
    } catch (err) {
      console.warn('[TestCache] Warning: Corrupt test-cache.json, re-initializing cache:', err.message);
    }
  }

  // If cache doesn't exist yet, seed from existing report.json if available
  const newCache = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    scenarios: {}
  };

  if (fs.existsSync(reportJsonPath)) {
    try {
      const existingReport = JSON.parse(fs.readFileSync(reportJsonPath, 'utf8'));
      if (existingReport && Array.isArray(existingReport.suites)) {
        console.log('[TestCache] Seeding initial cache from existing report.json...');
        updateCacheFromReport(existingReport, newCache, { skipSave: true });
        saveCache(newCache);
        return newCache;
      }
    } catch (err) {
      // ignore
    }
  }

  saveCache(newCache);
  return newCache;
}

function saveCache(cache) {
  ensureResultDir();
  cache.lastUpdated = new Date().toISOString();
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

function clearCache() {
  ensureResultDir();
  const emptyCache = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    scenarios: {}
  };
  saveCache(emptyCache);
  console.log('[TestCache] Test cache cleared successfully.');
  return emptyCache;
}

function normalizeScenarioFileName(filePathOrTitle) {
  if (!filePathOrTitle) return '';
  return path.basename(filePathOrTitle.replace(/\\/g, '/')).trim();
}

function updateCacheFromReport(reportData, cacheInstance, options = {}) {
  const cache = cacheInstance || loadCache();
  if (!reportData || !Array.isArray(reportData.suites)) {
    return cache;
  }

  for (const suite of reportData.suites) {
    const fileName = normalizeScenarioFileName(suite.file || suite.title);
    if (!fileName) continue;

    const stats = countSuiteResults(suite);
    const specsCount = countSuiteSpecs(suite);

    cache.scenarios[fileName] = {
      file: fileName,
      title: suite.title || fileName,
      lastRunAt: new Date().toISOString(),
      suite: suite,
      stats: {
        specsCount,
        passedCount: stats.passed,
        failedCount: stats.failed,
        skippedCount: stats.skipped,
        flakyCount: stats.flaky,
        duration: stats.duration
      }
    };
  }

  // Prune scenarios whose spec files were deleted from disk (if scenarioDir exists)
  if (options.pruneDeleted && fs.existsSync(scenarioDir)) {
    for (const cachedFile of Object.keys(cache.scenarios)) {
      const fullPath = path.join(scenarioDir, cachedFile);
      if (!fs.existsSync(fullPath)) {
        console.log(`[TestCache] Pruning deleted scenario file from cache: ${cachedFile}`);
        delete cache.scenarios[cachedFile];
      }
    }
  }

  if (!options.skipSave) {
    saveCache(cache);
  }

  return cache;
}

function buildMergedReport(cacheInstance, fallbackConfig = null) {
  const cache = cacheInstance || loadCache();
  const mergedSuites = Object.values(cache.scenarios)
    .map(s => s.suite)
    .filter(Boolean);

  let totalDuration = 0;
  let totalExpected = 0;
  let totalUnexpected = 0;
  let totalSkipped = 0;
  let totalFlaky = 0;

  for (const scenario of Object.values(cache.scenarios)) {
    if (scenario.stats) {
      totalDuration += (scenario.stats.duration || 0);
      totalExpected += (scenario.stats.passedCount || 0);
      totalUnexpected += (scenario.stats.failedCount || 0);
      totalSkipped += (scenario.stats.skippedCount || 0);
      totalFlaky += (scenario.stats.flakyCount || 0);
    }
  }

  const mergedReport = {
    config: fallbackConfig || {
      testDir: './testing/scenario',
      rootDir: './testing/scenario'
    },
    suites: mergedSuites,
    errors: [],
    stats: {
      startTime: cache.lastUpdated || new Date().toISOString(),
      duration: totalDuration,
      expected: totalExpected,
      skipped: totalSkipped,
      unexpected: totalUnexpected,
      flaky: totalFlaky
    }
  };

  return mergedReport;
}

function extractTestsFromSuites(suites, scenarioDefaults = {}) {
  const testResults = [];

  function extractTests(suite, parentTitle = '', scenarioFile = '') {
    const currentTitle = parentTitle ? `${parentTitle} > ${suite.title}` : (suite.title || '');
    const currentFile = suite.file || scenarioFile;

    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const testAnnotations = (test.annotations || [])
          .filter(a => a.type === 'component')
          .map(a => a.description);

        for (const result of test.results || []) {
          testResults.push({
            suite: currentTitle,
            spec: spec.title,
            status: result.status,
            duration: result.duration,
            file: normalizeScenarioFileName(currentFile),
            components: testAnnotations
          });
        }
      }
    }

    for (const childSuite of suite.suites || []) {
      extractTests(childSuite, currentTitle, currentFile);
    }
  }

  for (const suite of suites || []) {
    extractTests(suite, '', suite.file || '');
  }

  return testResults;
}

module.exports = {
  getCachePath,
  getReportPath,
  getCurrentJsonPath,
  loadCache,
  saveCache,
  clearCache,
  updateCacheFromReport,
  buildMergedReport,
  extractTestsFromSuites,
  normalizeScenarioFileName
};
