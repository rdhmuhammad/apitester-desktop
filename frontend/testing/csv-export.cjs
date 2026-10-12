const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const cacheManager = require('./test-cache-manager.cjs');

const resultDir = path.join(__dirname, 'result');
const jsonPath = path.join(resultDir, 'report.json');
const csvPath = path.join(resultDir, 'report.csv');
const xlsxPath = path.join(resultDir, 'report.xlsx');
const htmlReportPath = path.join(resultDir, 'html-report', 'index.html');
const standaloneHtmlPath = path.join(resultDir, 'coverage.html');
const srcDir = path.resolve(__dirname, '..', 'src');
const scenarioDir = path.join(__dirname, 'scenario');

// Baseline component coverage mapping per test scenario file
const scenarioDefaults = {
  'titlebar.spec.ts': ['TitleBar.tsx', 'button.tsx', 'tooltip.tsx'],
  'request_editor.spec.ts': [
    'TitleBar.tsx',
    'CollectionManage.tsx',
    'collectionManager/index.tsx',
    'alert-dialog.tsx',
    'dialog.tsx',
    'SidebarLayout.tsx',
    'DragNode.tsx',
    'RequestHeader.tsx',
    'select.tsx',
    'tabs.tsx',
    'button.tsx',
    'RequestConfig/index.tsx'
  ],
  'scripts_tab.spec.ts': [
    'RequestHeader.tsx',
    'dropdown-menu.tsx',
    'tabs.tsx',
    'RequestConfig/index.tsx',
    'ScriptEditor.tsx',
    'sandpack-script-editor.tsx',
    'select.tsx',
    'button.tsx'
  ],
  'multipart-body.spec.ts': [
    'RequestHeader.tsx',
    'dropdown-menu.tsx',
    'tabs.tsx',
    'RequestConfig/index.tsx',
    'BodyEditor.tsx',
    'select.tsx',
    'input.tsx',
    'button.tsx'
  ],
  'authorization.spec.ts': [
    'RequestHeader.tsx',
    'tabs.tsx',
    'RequestConfig/index.tsx',
    'AuthContent.tsx',
    'HeadersContent.tsx',
    'ResponseView.tsx',
    'select.tsx',
    'input.tsx',
    'button.tsx'
  ],
  'path-variable.spec.ts': [
    'RequestHeader.tsx',
    'tabs.tsx',
    'RequestConfig/index.tsx',
    'ParamsContent.tsx',
    'VariableInput.tsx',
    'ResponseView.tsx',
    'input.tsx',
    'button.tsx'
  ],
  'params_tab.spec.ts': [
    'RequestHeader.tsx',
    'tabs.tsx',
    'RequestConfig/index.tsx',
    'ParamsContent.tsx',
    'VariableInput.tsx',
    'input.tsx',
    'button.tsx'
  ],
  'headers_tab.spec.ts': [
    'RequestHeader.tsx',
    'tabs.tsx',
    'RequestConfig/index.tsx',
    'HeadersContent.tsx',
    'VariableInput.tsx',
    'VariableDialog.tsx',
    'input.tsx',
    'button.tsx',
    'tooltip.tsx'
  ],
  'header_content.spec.ts': [
    'RequestHeader.tsx',
    'tabs.tsx',
    'RequestConfig/index.tsx',
    'HeadersContent.tsx',
    'VariableInput.tsx',
    'input.tsx',
    'button.tsx'
  ],
  'collection_tree.spec.ts': [
    'SidebarLayout.tsx',
    'DragNode.tsx',
    'sidebar.tsx',
    'alert-dialog.tsx',
    'TitleBar.tsx',
    'CollectionManage.tsx',
    'button.tsx',
    'input.tsx'
  ],
  'collection_variable.spec.ts': [
    'TitleBar.tsx',
    'collectionManager/index.tsx',
    'VariableManage.tsx',
    'alert-dialog.tsx',
    'tabs.tsx',
    'input.tsx',
    'button.tsx'
  ]
};

// 1. Discover all components in frontend/src
const scanFolders = ['components', 'layout', 'pages'];

function getComponentFiles() {
  const components = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.tsx')) {
        const relPath = path.relative(srcDir, fullPath).replace(/\\/g, '/');
        const parts = relPath.split('/');
        const category = parts[0];
        const name = entry.name === 'index.tsx' 
          ? parts[parts.length - 2] + '/index.tsx' 
          : entry.name;
        components.push({
          name,
          path: relPath,
          category,
          fullPath
        });
      }
    }
  }

  for (const folder of scanFolders) {
    walk(path.join(srcDir, folder));
  }

  return components.sort((a, b) => a.path.localeCompare(b.path));
}

// Helper: match component references from test annotations or defaults
function matchComponent(compPath, compName, ref) {
  const normRef = ref.replace(/\\/g, '/').toLowerCase();
  const normPath = compPath.replace(/\\/g, '/').toLowerCase();
  const normName = compName.toLowerCase();

  if (path.basename(normRef) === 'index.tsx') {
    return normPath === normRef || normPath.endsWith('/' + normRef);
  }

  return (
    normPath === normRef ||
    normPath.endsWith('/' + normRef) ||
    normName === normRef ||
    path.basename(normPath) === path.basename(normRef)
  );
}

// Discover all scenario files on disk and in defaults
function discoverAllScenarioFiles() {
  const filesOnDisk = fs.existsSync(scenarioDir)
    ? fs.readdirSync(scenarioDir).filter(f => f.endsWith('.spec.ts') || f.endsWith('.test.ts'))
    : [];

  const all = new Set([
    ...filesOnDisk,
    ...Object.keys(scenarioDefaults)
  ]);

  return Array.from(all).sort();
}

async function generateReports(options = {}) {
  if (options.clearCache || process.argv.includes('--clear-cache')) {
    cacheManager.clearCache();
  }

  // Load cumulative cache
  let cache = cacheManager.loadCache();

  // If report.json exists, verify if any suites are not in cache yet
  if (fs.existsSync(jsonPath)) {
    try {
      const existingReport = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (existingReport && Array.isArray(existingReport.suites)) {
        cache = cacheManager.updateCacheFromReport(existingReport, cache, { pruneDeleted: true });
      }
    } catch (err) {
      console.warn('[CSVExport] Warning: Failed to parse existing report.json:', err.message);
    }
  }

  // Build merged cumulative report
  const mergedReport = cacheManager.buildMergedReport(cache);
  fs.writeFileSync(jsonPath, JSON.stringify(mergedReport, null, 2), 'utf8');

  // Discover all components
  const allComponents = getComponentFiles();

  // Extract all test specs from all cached scenarios
  const testResults = cacheManager.extractTestsFromSuites(mergedReport.suites, scenarioDefaults);

  // Discover all scenario files
  const allScenarioFiles = discoverAllScenarioFiles();
  for (const t of testResults) {
    if (t.file && !allScenarioFiles.includes(t.file)) {
      allScenarioFiles.push(t.file);
    }
  }
  allScenarioFiles.sort();

  // Calculate coverage for each component across all cached test scenarios
  const coverageRecords = allComponents.map(comp => {
    const matchedScenarios = new Set();
    const matchedTests = new Set();

    for (const t of testResults) {
      const hasAnnotation = t.components.some(cRef => matchComponent(comp.path, comp.name, cRef));
      const defaults = scenarioDefaults[t.file] || [];
      const hasDefault = defaults.some(cRef => matchComponent(comp.path, comp.name, cRef));

      if (hasAnnotation || hasDefault) {
        if (t.file) matchedScenarios.add(t.file);
        matchedTests.add(`${t.suite} - ${t.spec}`);
      }
    }

    const isCovered = matchedScenarios.size > 0;
    return {
      name: comp.name,
      category: comp.category,
      path: comp.path,
      isCovered,
      status: isCovered ? 'Covered' : 'Not Covered',
      scenarios: Array.from(matchedScenarios),
      tests: Array.from(matchedTests)
    };
  });

  const totalComponents = coverageRecords.length;
  const coveredComponents = coverageRecords.filter(c => c.isCovered).length;
  const uncoveredComponents = totalComponents - coveredComponents;
  const coveragePercentage = totalComponents > 0 
    ? ((coveredComponents / totalComponents) * 100).toFixed(2)
    : '0.00';

  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.status === 'passed').length;
  const failedTests = testResults.filter(t => t.status === 'failed' || t.status === 'timedOut').length;

  const scenariosWithRuns = Array.from(new Set(testResults.map(t => t.file).filter(Boolean)));
  const cachedScenarioCount = Object.keys(cache.scenarios).length;

  // ----------------------------------------------------
  // Generate CSV Report
  // ----------------------------------------------------
  let csvContent = '';

  // Section 1: Coverage Summary
  csvContent += '================================================================================\n';
  csvContent += 'COMPONENT TEST COVERAGE SUMMARY (CUMULATIVE CACHED)\n';
  csvContent += '================================================================================\n';
  csvContent += 'Metric,Value\n';
  csvContent += `Total Components,${totalComponents}\n`;
  csvContent += `Covered Components,${coveredComponents}\n`;
  csvContent += `Uncovered Components,${uncoveredComponents}\n`;
  csvContent += `Component Test Coverage,${coveragePercentage}%\n`;
  csvContent += `Total Tests Run (Cached),${totalTests}\n`;
  csvContent += `Passed Tests,${passedTests}\n`;
  csvContent += `Failed Tests,${failedTests}\n`;
  csvContent += `Scenarios Executed,${scenariosWithRuns.length} of ${allScenarioFiles.length}\n\n`;

  // Section 2: Test Execution Results
  csvContent += '================================================================================\n';
  csvContent += 'TEST SCENARIO EXECUTION RESULTS\n';
  csvContent += '================================================================================\n';
  csvContent += 'Test Suite,Test Name,Status,Duration (ms),Scenario File,Covered Components\n';
  for (const t of testResults) {
    const compsTested = t.components.length > 0 
      ? t.components.join('; ') 
      : (scenarioDefaults[t.file] || []).join('; ');
    csvContent += `"${t.suite}","${t.spec}","${t.status}","${t.duration}","${t.file}","${compsTested}"\n`;
  }
  csvContent += '\n';

  // Section 3: Detailed Component Coverage Breakdown
  csvContent += '================================================================================\n';
  csvContent += 'COMPONENT COVERAGE DETAILS\n';
  csvContent += '================================================================================\n';
  csvContent += 'Component Name,Category,File Path,Status,Covered By Scenarios\n';
  for (const c of coverageRecords) {
    const scenarioStr = c.scenarios.length > 0 ? c.scenarios.join(', ') : '-';
    csvContent += `"${c.name}","${c.category}","${c.path}","${c.status}","${scenarioStr}"\n`;
  }

  fs.writeFileSync(csvPath, csvContent, 'utf8');

  // ----------------------------------------------------
  // Generate Standalone HTML Report (coverage.html)
  // ----------------------------------------------------
  function generateCoverageDashboardHtml(isStandalone = false) {
    const coveredRows = coverageRecords.map(c => `
      <tr class="coverage-row ${c.isCovered ? 'row-covered' : 'row-uncovered'}" data-category="${c.category}" data-status="${c.isCovered ? 'covered' : 'uncovered'}">
        <td style="text-align: center;">
          <span class="badge ${c.isCovered ? 'badge-success' : 'badge-muted'}">
            ${c.isCovered ? '✓ Covered' : '○ Not Covered'}
          </span>
        </td>
        <td class="font-bold">${c.name}</td>
        <td><span class="category-tag tag-${c.category}">${c.category}</span></td>
        <td class="code-font">${c.path}</td>
        <td>${c.scenarios.length > 0 ? c.scenarios.map(s => `<span class="scenario-tag">${s}</span>`).join(' ') : '<span class="text-muted">None</span>'}</td>
      </tr>
    `).join('');

    const scenarioRows = allScenarioFiles.map(scFile => {
      const testsForSc = testResults.filter(t => t.file === scFile);
      const hasRun = testsForSc.length > 0;
      const hasFail = testsForSc.some(t => t.status !== 'passed');
      const compsCount = (scenarioDefaults[scFile] || []).length;

      let badgeClass = 'badge-muted';
      let statusText = '⏳ Pending (Not Run)';
      if (hasRun) {
        if (hasFail) {
          badgeClass = 'badge-failed';
          statusText = '✕ Failed';
        } else {
          badgeClass = 'badge-success';
          statusText = '✓ Passed';
        }
      }

      return `
        <tr>
          <td><span class="badge ${badgeClass}">${statusText}</span></td>
          <td class="font-bold code-font">${scFile}</td>
          <td>${compsCount > 0 ? `${compsCount} components` : `${new Set(testsForSc.flatMap(t => t.components)).size} components`}</td>
          <td>${testsForSc.length} specs</td>
        </tr>
      `;
    }).join('');

    return `
<!-- START COMPONENT COVERAGE DASHBOARD -->
<div id="component-coverage-dashboard" style="
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  margin: 16px auto;
  max-width: 1200px;
  background: var(--cov-bg, #ffffff);
  color: var(--cov-text, #1f2937);
  border: 1px solid var(--cov-border, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  overflow: hidden;
">
  <style>
    :root {
      --cov-bg: #ffffff;
      --cov-text: #1f2937;
      --cov-border: #e5e7eb;
      --cov-card-bg: #f9fafb;
      --cov-subtext: #6b7280;
      --cov-code-bg: #f3f4f6;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --cov-bg: #1e1e2e;
        --cov-text: #e2e8f0;
        --cov-border: #334155;
        --cov-card-bg: #0f172a;
        --cov-subtext: #94a3b8;
        --cov-code-bg: #1e293b;
      }
    }
    body.dark, html.dark {
      --cov-bg: #1e1e2e;
      --cov-text: #e2e8f0;
      --cov-border: #334155;
      --cov-card-bg: #0f172a;
      --cov-subtext: #94a3b8;
      --cov-code-bg: #1e293b;
    }
    .cov-header {
      padding: 24px;
      border-bottom: 1px solid var(--cov-border);
      background: linear-gradient(180deg, var(--cov-card-bg), var(--cov-bg));
    }
    .cov-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
    }
    .cov-title-group h2 {
      margin: 0 0 6px 0;
      font-size: 24px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .cov-subtitle {
      margin: 0;
      font-size: 14px;
      color: var(--cov-subtext);
    }
    .cov-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .cov-stat-box {
      background: var(--cov-card-bg);
      border: 1px solid var(--cov-border);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .cov-stat-val {
      font-size: 28px;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 6px;
      color: #3b82f6;
    }
    .cov-stat-val.rate {
      color: ${parseFloat(coveragePercentage) >= 50 ? '#10b981' : '#f59e0b'};
    }
    .cov-stat-lbl {
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: var(--cov-subtext);
    }
    .cov-bar-container {
      background: var(--cov-border);
      height: 14px;
      border-radius: 7px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .cov-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #3b82f6, #10b981);
      width: ${coveragePercentage}%;
      transition: width 0.6s ease-out;
    }
    .cov-bar-legend {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--cov-subtext);
      font-weight: 500;
    }
    .cov-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
    }
    .cov-btn {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--cov-border);
      background: var(--cov-card-bg);
      color: var(--cov-text);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .cov-btn:hover {
      background: var(--cov-code-bg);
    }
    .cov-panel {
      padding: 24px;
    }
    .cov-search-bar {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .cov-input {
      flex: 1;
      min-width: 250px;
      padding: 8px 12px;
      border: 1px solid var(--cov-border);
      border-radius: 6px;
      background: var(--cov-card-bg);
      color: var(--cov-text);
      font-size: 13px;
    }
    .cov-filter-group {
      display: flex;
      gap: 8px;
    }
    .filter-pill {
      padding: 6px 12px;
      border: 1px solid var(--cov-border);
      border-radius: 20px;
      background: var(--cov-card-bg);
      color: var(--cov-subtext);
      font-size: 12px;
      cursor: pointer;
    }
    .filter-pill.active {
      background: #3b82f6;
      color: #ffffff;
      border-color: #3b82f6;
    }
    .cov-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .cov-table th {
      text-align: left;
      padding: 10px 12px;
      border-bottom: 2px solid var(--cov-border);
      color: var(--cov-subtext);
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .cov-table td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--cov-border);
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-success { background: #dcfce7; color: #166534; }
    .badge-failed { background: #fee2e2; color: #991b1b; }
    .badge-muted { background: #f1f5f9; color: #64748b; }
    .category-tag {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      background: var(--cov-card-bg);
      border: 1px solid var(--cov-border);
    }
    .code-font {
      font-family: monospace;
      font-size: 12px;
    }
    .font-bold {
      font-weight: 600;
    }
    .text-muted {
      color: var(--cov-subtext);
    }
    .scenario-tag {
      display: inline-block;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 11px;
      margin: 2px;
    }
    @media (prefers-color-scheme: dark) {
      .badge-success { background: #064e3b; color: #6ee7b7; }
      .badge-failed { background: #7f1d1d; color: #fca5a5; }
      .scenario-tag { background: #1e3a8a; color: #bfdbfe; border-color: #1d4ed8; }
    }
  </style>

  <div class="cov-header">
    <div class="cov-title-row">
      <div class="cov-title-group">
        <h2><span>📊</span> Component Test Coverage Report (Cached)</h2>
        <p class="cov-subtitle">Evaluation based on frontend UI and Layout components tested across all executed Playwright test scenarios (Cumulative Cache: ${cachedScenarioCount} scenarios)</p>
      </div>
      <div>
        <span class="badge ${parseFloat(coveragePercentage) >= 50 ? 'badge-success' : 'badge-muted'}" style="font-size: 14px; padding: 6px 14px;">
          ${coveragePercentage}% Coverage
        </span>
      </div>
    </div>

    <div class="cov-stats-grid">
      <div class="cov-stat-box">
        <div class="cov-stat-val rate">${coveragePercentage}%</div>
        <div class="cov-stat-lbl">Component Coverage</div>
      </div>
      <div class="cov-stat-box">
        <div class="cov-stat-val">${coveredComponents} / ${totalComponents}</div>
        <div class="cov-stat-lbl">Components Covered</div>
      </div>
      <div class="cov-stat-box">
        <div class="cov-stat-val" style="color: #64748b;">${uncoveredComponents}</div>
        <div class="cov-stat-lbl">Uncovered Components</div>
      </div>
      <div class="cov-stat-box">
        <div class="cov-stat-val" style="color: #10b981;">${passedTests} / ${totalTests}</div>
        <div class="cov-stat-lbl">Test Specs Passed (Cached)</div>
      </div>
    </div>

    <div class="cov-bar-container">
      <div class="cov-bar-fill"></div>
    </div>
    <div class="cov-bar-legend">
      <span>0%</span>
      <span>${coveredComponents} of ${totalComponents} components covered (${coveragePercentage}%) across ${scenariosWithRuns.length} executed scenarios</span>
      <span>100%</span>
    </div>

    <div class="cov-controls">
      <button id="toggle-cov-table-btn" class="cov-btn">
        <span id="cov-btn-arrow">▼</span> Toggle Component Breakdown (${totalComponents} components)
      </button>
      <div style="font-size: 12px; color: var(--cov-subtext);">
        Cumulative Cache: ${cachedScenarioCount} scenarios • Updated: ${new Date().toLocaleString()}
      </div>
    </div>
  </div>

  <div id="cov-details-panel" class="cov-panel" style="display: ${isStandalone ? 'block' : 'none'};">
    <!-- Scenarios Summary -->
    <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px;">Test Scenarios Execution Matrix</h3>
    <table class="cov-table" style="margin-bottom: 24px;">
      <thead>
        <tr>
          <th style="width: 140px;">Status</th>
          <th>Scenario File</th>
          <th>Targeted Components</th>
          <th>Cached Specs</th>
        </tr>
      </thead>
      <tbody>
        ${scenarioRows}
      </tbody>
    </table>

    <h3 style="margin-bottom: 12px; font-size: 16px;">Component Coverage Details</h3>
    <div class="cov-search-bar">
      <input type="text" id="cov-search-input" class="cov-input" placeholder="Search by component name, file path, or category..." />
      <div class="cov-filter-group">
        <button class="filter-pill active" onclick="filterCoverage('all', this)">All (${totalComponents})</button>
        <button class="filter-pill" onclick="filterCoverage('covered', this)">Covered (${coveredComponents})</button>
        <button class="filter-pill" onclick="filterCoverage('uncovered', this)">Uncovered (${uncoveredComponents})</button>
      </div>
    </div>

    <div style="overflow-x: auto;">
      <table class="cov-table">
        <thead>
          <tr>
            <th style="width: 120px; text-align: center;">Status</th>
            <th>Component</th>
            <th>Category</th>
            <th>File Path</th>
            <th>Tested In Scenarios</th>
          </tr>
        </thead>
        <tbody id="cov-table-body">
          ${coveredRows}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    (function() {
      const toggleBtn = document.getElementById('toggle-cov-table-btn');
      const panel = document.getElementById('cov-details-panel');
      const arrow = document.getElementById('cov-btn-arrow');
      if (toggleBtn && panel) {
        toggleBtn.addEventListener('click', function() {
          const isHidden = panel.style.display === 'none';
          panel.style.display = isHidden ? 'block' : 'none';
          if (arrow) arrow.textContent = isHidden ? '▲' : '▼';
        });
      }

      const searchInput = document.getElementById('cov-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', function(e) {
          const q = e.target.value.toLowerCase();
          const rows = document.querySelectorAll('.coverage-row');
          rows.forEach(r => {
            const text = r.textContent.toLowerCase();
            r.style.display = text.includes(q) ? '' : 'none';
          });
        });
      }

      window.filterCoverage = function(status, btn) {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        if (btn) btn.classList.add('active');
        const rows = document.querySelectorAll('.coverage-row');
        rows.forEach(r => {
          if (status === 'all') {
            r.style.display = '';
          } else {
            r.style.display = r.getAttribute('data-status') === status ? '' : 'none';
          }
        });
      };
    })();
  </script>
</div>
<!-- END COMPONENT COVERAGE DASHBOARD -->
`;
  }

  // Write standalone coverage.html
  const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Test Coverage Report - Apitester</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: #f8fafc;
      min-height: 100vh;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #0f172a; }
    }
  </style>
</head>
<body>
  ${generateCoverageDashboardHtml(true)}
</body>
</html>`;

  fs.writeFileSync(standaloneHtmlPath, standaloneHtml, 'utf8');

  // Inject Coverage Dashboard into Playwright's HTML Report (if exists)
  if (fs.existsSync(htmlReportPath)) {
    let htmlContent = fs.readFileSync(htmlReportPath, 'utf8');
    
    // Remove any previously injected coverage dashboard
    const startTag = '<!-- START COMPONENT COVERAGE DASHBOARD -->';
    const endTag = '<!-- END COMPONENT COVERAGE DASHBOARD -->';
    const sIdx = htmlContent.indexOf(startTag);
    const eIdx = htmlContent.indexOf(endTag);
    if (sIdx !== -1 && eIdx !== -1) {
      htmlContent = htmlContent.slice(0, sIdx) + htmlContent.slice(eIdx + endTag.length);
    }

    // Inject before <div id='root'></div> or before </body>
    const dashboardHtml = generateCoverageDashboardHtml(false);
    if (htmlContent.includes("<div id='root'></div>")) {
      htmlContent = htmlContent.replace("<div id='root'></div>", `${dashboardHtml}\n    <div id='root'></div>`);
    } else if (htmlContent.includes("</body>")) {
      htmlContent = htmlContent.replace("</body>", `${dashboardHtml}\n</body>`);
    }

    fs.writeFileSync(htmlReportPath, htmlContent, 'utf8');
  }

  // ----------------------------------------------------
  // Generate Executive Formatted XLSX Report (report.xlsx)
  // ----------------------------------------------------
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Apitester Desktop Test Runner';
  workbook.lastModifiedBy = 'Playwright Reporter (Cumulative Cache)';
  workbook.created = new Date();
  workbook.modified = new Date();

  const FONT_FAMILY = 'Segoe UI';
  const BORDER_THIN = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  // Category breakdown calculation
  const categoryStats = {};
  for (const c of coverageRecords) {
    if (!categoryStats[c.category]) {
      categoryStats[c.category] = { total: 0, covered: 0 };
    }
    categoryStats[c.category].total++;
    if (c.isCovered) categoryStats[c.category].covered++;
  }

  // ==========================================
  // SHEET 1: EXECUTIVE DASHBOARD
  // ==========================================
  const wsSummary = workbook.addWorksheet('Dashboard & Overview', {
    properties: { tabColor: { argb: 'FF10B981' } },
    views: [{ showGridLines: true }]
  });

  wsSummary.columns = [
    { width: 4 },  // A: Margin
    { width: 26 }, // B: Metric / Category / Scenario
    { width: 18 }, // C
    { width: 18 }, // D
    { width: 20 }, // E
    { width: 24 }, // F
    { width: 4 }   // G: Margin
  ];

  // 1. Header Banner
  wsSummary.mergeCells('B2:F2');
  const hTitle = wsSummary.getCell('B2');
  hTitle.value = 'APITESTER COMPONENT COVERAGE & AUTOMATION AUDIT';
  hTitle.font = { name: FONT_FAMILY, size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  hTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  hTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsSummary.getRow(2).height = 32;

  wsSummary.mergeCells('B3:F3');
  const hSub = wsSummary.getCell('B3');
  hSub.value = `Executive QA Test Report  •  Generated: ${new Date().toLocaleString()}  •  Cumulative Cached Scenarios: ${cachedScenarioCount}`;
  hSub.font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: 'FF94A3B8' } };
  hSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  hSub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsSummary.getRow(3).height = 20;

  // 2. High-Level KPI Cards (Row 5 - 7)
  const kpis = [
    {
      colStart: 'B', colEnd: 'B',
      title: 'COMPONENT COVERAGE',
      value: `${coveragePercentage}%`,
      sub: `${coveredComponents} of ${totalComponents} Covered`,
      valColor: parseFloat(coveragePercentage) >= 50 ? 'FF059669' : 'FFD97706',
      bgColor: parseFloat(coveragePercentage) >= 50 ? 'FFF0FDF4' : 'FFFFFBEB'
    },
    {
      colStart: 'C', colEnd: 'C',
      title: 'COMPONENTS TESTED',
      value: `${coveredComponents}`,
      sub: `${uncoveredComponents} Uncovered`,
      valColor: 'FF2563EB',
      bgColor: 'FFEFF6FF'
    },
    {
      colStart: 'D', colEnd: 'D',
      title: 'TEST SPECS PASSED',
      value: `${passedTests} / ${totalTests}`,
      sub: `${failedTests} Failures Detected`,
      valColor: failedTests === 0 ? 'FF16A34A' : 'FFDC2626',
      bgColor: failedTests === 0 ? 'FFF0FDF4' : 'FFFEF2F2'
    },
    {
      colStart: 'E', colEnd: 'F',
      title: 'OVERALL HEALTH STATUS',
      value: failedTests === 0 && totalTests > 0 ? 'ALL SPECS PASSING ✓' : (failedTests > 0 ? 'NEEDS ATTENTION ⚠️' : 'NO TESTS RUN'),
      sub: `${scenariosWithRuns.length} of ${allScenarioFiles.length} Test Scenarios Executed`,
      valColor: failedTests === 0 && totalTests > 0 ? 'FF166534' : 'FF991B1B',
      bgColor: failedTests === 0 && totalTests > 0 ? 'FFF0FDF4' : 'FFFEF2F2'
    }
  ];

  for (const kpi of kpis) {
    if (kpi.colStart !== kpi.colEnd) {
      wsSummary.mergeCells(`${kpi.colStart}5:${kpi.colEnd}5`);
      wsSummary.mergeCells(`${kpi.colStart}6:${kpi.colEnd}6`);
      wsSummary.mergeCells(`${kpi.colStart}7:${kpi.colEnd}7`);
    }

    const tCell = wsSummary.getCell(`${kpi.colStart}5`);
    tCell.value = kpi.title;
    tCell.font = { name: FONT_FAMILY, size: 8, bold: true, color: { argb: 'FF64748B' } };
    tCell.alignment = { vertical: 'bottom', horizontal: 'center' };

    const vCell = wsSummary.getCell(`${kpi.colStart}6`);
    vCell.value = kpi.value;
    vCell.font = { name: FONT_FAMILY, size: 16, bold: true, color: { argb: kpi.valColor } };
    vCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const sCell = wsSummary.getCell(`${kpi.colStart}7`);
    sCell.value = kpi.sub;
    sCell.font = { name: FONT_FAMILY, size: 8, color: { argb: 'FF94A3B8' } };
    sCell.alignment = { vertical: 'top', horizontal: 'center' };

    const cols = kpi.colStart === kpi.colEnd ? [kpi.colStart] : ['E', 'F'];
    for (const c of cols) {
      for (let r = 5; r <= 7; r++) {
        const cell = wsSummary.getCell(`${c}${r}`);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
        cell.border = {
          top: r === 5 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          bottom: r === 7 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          left: c === cols[0] ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined,
          right: c === cols[cols.length - 1] ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined
        };
      }
    }
  }

  // 3. Category Breakdown Table (Row 9+)
  wsSummary.mergeCells('B9:F9');
  const catTitle = wsSummary.getCell('B9');
  catTitle.value = '📊 COMPONENT COVERAGE BREAKDOWN BY ARCHITECTURAL CATEGORY';
  catTitle.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  catTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  catTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsSummary.getRow(9).height = 26;

  const catHeaders = ['Category', 'Total Components', 'Covered', 'Uncovered', 'Coverage Rate'];
  const catHeaderRow = wsSummary.getRow(10);
  catHeaderRow.height = 24;
  catHeaders.forEach((h, idx) => {
    const colLetter = String.fromCharCode(66 + idx);
    const cell = catHeaderRow.getCell(colLetter);
    cell.value = h;
    cell.font = { name: FONT_FAMILY, size: 9, bold: true, color: { argb: 'FF334155' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center' };
    cell.border = BORDER_THIN;
  });

  let currentRow = 11;
  const categories = Object.entries(categoryStats);
  categories.forEach(([cat, stats], i) => {
    const row = wsSummary.getRow(currentRow);
    row.height = 22;
    const uncov = stats.total - stats.covered;
    const rate = stats.total > 0 ? ((stats.covered / stats.total) * 100).toFixed(2) + '%' : '0.00%';
    const isAlt = i % 2 === 1;
    const rowBg = isAlt ? 'FFF8FAFC' : 'FFFFFFFF';

    const values = [cat.toUpperCase(), stats.total, stats.covered, uncov, rate];
    values.forEach((v, idx) => {
      const colLetter = String.fromCharCode(66 + idx);
      const cell = row.getCell(colLetter);
      cell.value = v;
      cell.font = {
        name: FONT_FAMILY,
        size: 9,
        bold: idx === 0 || idx === 4,
        color: idx === 4 ? (parseFloat(rate) >= 50 ? { argb: 'FF059669' } : { argb: 'FFD97706' }) : { argb: 'FF1E293B' }
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
      cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center' };
      cell.border = BORDER_THIN;
    });
    currentRow++;
  });

  // Total summary row
  const totalRow = wsSummary.getRow(currentRow);
  totalRow.height = 24;
  const totalValues = ['TOTAL', totalComponents, coveredComponents, uncoveredComponents, `${coveragePercentage}%`];
  totalValues.forEach((v, idx) => {
    const colLetter = String.fromCharCode(66 + idx);
    const cell = totalRow.getCell(colLetter);
    cell.value = v;
    cell.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center' };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };
  });
  currentRow += 2;

  // 4. Test Scenario Overview Table
  wsSummary.mergeCells(`B${currentRow}:F${currentRow}`);
  const tsTitle = wsSummary.getCell(`B${currentRow}`);
  tsTitle.value = '🧪 AUTOMATED TEST SCENARIOS OVERVIEW (CUMULATIVE CACHE)';
  tsTitle.font = { name: FONT_FAMILY, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  tsTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  tsTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsSummary.getRow(currentRow).height = 26;
  currentRow++;

  const scHeaders = ['Scenario File', 'Components Targeted', 'Status', 'Specs Run', 'Health'];
  const scHeaderRow = wsSummary.getRow(currentRow);
  scHeaderRow.height = 24;
  scHeaders.forEach((h, idx) => {
    const colLetter = String.fromCharCode(66 + idx);
    const cell = scHeaderRow.getCell(colLetter);
    cell.value = h;
    cell.font = { name: FONT_FAMILY, size: 9, bold: true, color: { argb: 'FF334155' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 ? 'left' : 'center' };
    cell.border = BORDER_THIN;
  });
  currentRow++;

  allScenarioFiles.forEach((scFile, idx) => {
    const row = wsSummary.getRow(currentRow);
    row.height = 22;
    const compsCount = (scenarioDefaults[scFile] || []).length;
    const testsForSc = testResults.filter(t => t.file === scFile);
    const hasRun = testsForSc.length > 0;
    const hasFail = testsForSc.some(t => t.status !== 'passed');
    const isAlt = idx % 2 === 1;

    let statusText = 'PENDING ⏳';
    let healthText = 'NOT RUN';
    let statusColor = 'FF64748B';

    if (hasRun) {
      if (hasFail) {
        statusText = 'FAILED ✕';
        healthText = 'CRITICAL';
        statusColor = 'FFDC2626';
      } else {
        statusText = 'PASSED ✓';
        healthText = 'OPTIMAL';
        statusColor = 'FF16A34A';
      }
    }

    const compsDisplay = compsCount > 0 
      ? `${compsCount} Components` 
      : `${new Set(testsForSc.flatMap(t => t.components)).size} Components`;

    const values = [
      scFile,
      compsDisplay,
      statusText,
      hasRun ? `${testsForSc.length} Specs` : '0 Specs',
      healthText
    ];

    values.forEach((v, vIdx) => {
      const colLetter = String.fromCharCode(66 + vIdx);
      const cell = row.getCell(colLetter);
      cell.value = v;
      cell.font = {
        name: FONT_FAMILY,
        size: 9,
        bold: vIdx === 0 || vIdx === 2,
        color: vIdx === 2 || vIdx === 4
          ? { argb: statusColor }
          : { argb: 'FF1E293B' }
      };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFF8FAFC' : 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: vIdx === 0 ? 'left' : 'center' };
      cell.border = BORDER_THIN;
    });
    currentRow++;
  });

  // ==========================================
  // SHEET 2: TEST RESULTS
  // ==========================================
  const wsTests = workbook.addWorksheet('Test Execution Results', {
    properties: { tabColor: { argb: 'FF3B82F6' } },
    views: [{ state: 'frozen', ySplit: 3, showGridLines: true }]
  });

  wsTests.columns = [
    { width: 6 },  // A: #
    { width: 15 }, // B: Status Badge
    { width: 34 }, // C: Test Suite
    { width: 44 }, // D: Test Spec Name
    { width: 16 }, // E: Duration (ms)
    { width: 26 }, // F: Scenario File
    { width: 55 }  // G: Covered Components
  ];

  // Header Banner
  wsTests.mergeCells('A1:G1');
  const tBanner = wsTests.getCell('A1');
  tBanner.value = '🧪 PLAYWRIGHT TEST SCENARIO EXECUTION MATRIX (CUMULATIVE CACHE)';
  tBanner.font = { name: FONT_FAMILY, size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  tBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  tBanner.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsTests.getRow(1).height = 30;

  wsTests.mergeCells('A2:G2');
  const tSub = wsTests.getCell('A2');
  tSub.value = `Total Executed (Cached): ${totalTests}  •  Passed: ${passedTests}  •  Failed: ${failedTests}  •  Status: ${failedTests === 0 ? 'All Passing' : 'Failures Detected'}`;
  tSub.font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: 'FF94A3B8' } };
  tSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  tSub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsTests.getRow(2).height = 20;

  // Table Columns
  const testHeaders = ['#', 'Status', 'Test Suite', 'Test Spec Name', 'Duration (ms)', 'Scenario File', 'Covered Components'];
  const testHeaderRow = wsTests.getRow(3);
  testHeaderRow.height = 26;
  testHeaders.forEach((h, idx) => {
    const cell = testHeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: FONT_FAMILY, size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 1 || idx === 4 ? 'center' : 'left' };
    cell.border = BORDER_THIN;
  });

  testResults.forEach((t, idx) => {
    const row = wsTests.getRow(idx + 4);
    row.height = 22;
    const isPassed = t.status === 'passed';
    const isAlt = idx % 2 === 1;
    const compsTested = t.components.length > 0 
      ? t.components.join(', ') 
      : (scenarioDefaults[t.file] || []).join(', ');

    const rowData = [
      idx + 1,
      isPassed ? '✓ PASSED' : '✕ FAILED',
      t.suite,
      t.spec,
      t.duration,
      t.file,
      compsTested
    ];

    rowData.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = val;
      cell.border = BORDER_THIN;
      cell.alignment = {
        vertical: 'middle',
        horizontal: cIdx === 0 || cIdx === 1 || cIdx === 4 ? 'center' : 'left'
      };

      if (cIdx === 1) {
        cell.font = { name: FONT_FAMILY, size: 9, bold: true, color: isPassed ? { argb: 'FF166534' } : { argb: 'FF991B1B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: isPassed ? { argb: 'FFDCFCE7' } : { argb: 'FFFEE2E2' } };
      } else {
        cell.font = {
          name: FONT_FAMILY,
          size: 9,
          bold: cIdx === 2,
          color: { argb: 'FF1E293B' }
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFF8FAFC' : 'FFFFFFFF' } };
      }
    });
  });

  if (testResults.length > 0) {
    wsTests.autoFilter = `A3:G${testResults.length + 3}`;
  }

  // ==========================================
  // SHEET 3: COMPONENT COVERAGE AUDIT
  // ==========================================
  const wsCoverage = workbook.addWorksheet('Component Coverage Matrix', {
    properties: { tabColor: { argb: 'FF8B5CF6' } },
    views: [{ state: 'frozen', ySplit: 3, showGridLines: true }]
  });

  wsCoverage.columns = [
    { width: 6 },  // A: #
    { width: 16 }, // B: Status Badge
    { width: 30 }, // C: Component Name
    { width: 16 }, // D: Category
    { width: 50 }, // E: Source File Path
    { width: 35 }, // F: Covered By Scenarios
    { width: 55 }  // G: Covered By Tests
  ];

  // Header Banner
  wsCoverage.mergeCells('A1:G1');
  const cBanner = wsCoverage.getCell('A1');
  cBanner.value = '📦 FRONTEND COMPONENT TEST COVERAGE AUDIT MATRIX (CUMULATIVE CACHE)';
  cBanner.font = { name: FONT_FAMILY, size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  cBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  cBanner.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsCoverage.getRow(1).height = 30;

  wsCoverage.mergeCells('A2:G2');
  const cSub = wsCoverage.getCell('A2');
  cSub.value = `Total Scanned Components: ${totalComponents}  •  Covered: ${coveredComponents}  •  Uncovered: ${uncoveredComponents}  •  Coverage: ${coveragePercentage}%`;
  cSub.font = { name: FONT_FAMILY, size: 9, italic: true, color: { argb: 'FF94A3B8' } };
  cSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  cSub.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  wsCoverage.getRow(2).height = 20;

  // Table Columns
  const covHeaders = ['#', 'Coverage Status', 'Component Name', 'Category', 'Source File Path', 'Exercised In Scenarios', 'Exercised In Test Specs'];
  const covHeaderRow = wsCoverage.getRow(3);
  covHeaderRow.height = 26;
  covHeaders.forEach((h, idx) => {
    const cell = covHeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: FONT_FAMILY, size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 1 || idx === 3 ? 'center' : 'left' };
    cell.border = BORDER_THIN;
  });

  coverageRecords.forEach((c, idx) => {
    const row = wsCoverage.getRow(idx + 4);
    row.height = 22;
    const isCovered = c.isCovered;
    const isAlt = idx % 2 === 1;

    const rowData = [
      idx + 1,
      isCovered ? '✓ COVERED' : '○ UNCOVERED',
      c.name,
      c.category.toUpperCase(),
      c.path,
      c.scenarios.join(', ') || '-',
      c.tests.join('; ') || '-'
    ];

    rowData.forEach((val, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = val;
      cell.border = BORDER_THIN;
      cell.alignment = {
        vertical: 'middle',
        horizontal: cIdx === 0 || cIdx === 1 || cIdx === 3 ? 'center' : 'left'
      };

      if (cIdx === 1) {
        cell.font = { name: FONT_FAMILY, size: 9, bold: true, color: isCovered ? { argb: 'FF166534' } : { argb: 'FF64748B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: isCovered ? { argb: 'FFDCFCE7' } : { argb: 'FFF1F5F9' } };
      } else if (cIdx === 3) {
        const catColors = {
          COMPONENTS: { text: 'FF1E40AF', bg: 'FFEFF6FF' },
          LAYOUT: { text: 'FF6B21A8', bg: 'FFF3E8FF' },
          PAGES: { text: 'FF9D174D', bg: 'FFFCE7F3' }
        };
        const cStyle = catColors[val] || { text: 'FF334155', bg: 'FFF8FAFC' };
        cell.font = { name: FONT_FAMILY, size: 8, bold: true, color: { argb: cStyle.text } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cStyle.bg } };
      } else {
        cell.font = {
          name: FONT_FAMILY,
          size: 9,
          bold: cIdx === 2,
          color: cIdx === 4 ? { argb: 'FF64748B' } : { argb: 'FF1E293B' }
        };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFF8FAFC' : 'FFFFFFFF' } };
      }
    });
  });

  if (coverageRecords.length > 0) {
    wsCoverage.autoFilter = `A3:G${coverageRecords.length + 3}`;
  }

  await workbook.xlsx.writeFile(xlsxPath);

  // Update report.json with coverage metadata
  try {
    mergedReport.coverage = {
      totalComponents,
      coveredComponents,
      uncoveredComponents,
      coveragePercentage: `${coveragePercentage}%`,
      evaluatedAt: new Date().toISOString()
    };
    fs.writeFileSync(jsonPath, JSON.stringify(mergedReport, null, 2), 'utf8');
  } catch (e) {
    // non-fatal
  }

  console.log('\n==================================================');
  console.log(`📊 Component Test Coverage: ${coveragePercentage}% (${coveredComponents}/${totalComponents} components)`);
  console.log(`🧪 Scenarios in Cache: ${cachedScenarioCount} (Executed: ${scenariosWithRuns.length}/${allScenarioFiles.length})`);
  console.log(`✓ Tests Specs Passed: ${passedTests}/${totalTests}`);
  console.log('==================================================');
  console.log(`📄 CSV Report: ${csvPath}`);
  console.log(`📊 Styled Excel Report: ${xlsxPath}`);
  console.log(`🌐 Playwright HTML Report: ${htmlReportPath}`);
  console.log(`📈 Standalone Coverage Report: ${standaloneHtmlPath}`);
  console.log('==================================================\n');

  // Optional Google Drive sync
  const shouldSyncGDrive = process.argv.includes('--sync') || process.argv.includes('--sync-gdrive');
  const gdriveKeyExists = fs.existsSync(path.join(__dirname, 'gdrive-key.json')) || 
                          fs.existsSync(path.join(__dirname, 'service-account.json'));

  const skipSync = options.skipGDriveSync === true || process.argv.includes('--no-sync');

  if (!skipSync && (shouldSyncGDrive || gdriveKeyExists)) {
    const { syncReportToGDrive } = require('./sync-gdrive.cjs');
    try {
      await syncReportToGDrive();
    } catch (err) {
      console.warn('Non-fatal GDrive sync error:', err.message);
    }
  }

  return {
    coveragePercentage,
    totalComponents,
    coveredComponents,
    uncoveredComponents,
    totalTests,
    passedTests,
    failedTests,
    cachedScenarioCount,
    scenariosWithRuns
  };
}

if (require.main === module) {
  generateReports().catch(err => {
    console.error('Fatal reporter error:', err);
    process.exit(1);
  });
}

module.exports = {
  generateReports,
  scenarioDefaults,
  getComponentFiles
};
