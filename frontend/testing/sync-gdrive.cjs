const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { exec } = require('child_process');
const { google } = require('googleapis');

// Paths
const testingDir = __dirname;
const projectRootDir = path.resolve(testingDir, '..', '..');
const frontendDir = path.resolve(testingDir, '..');
const defaultXlsxPath = path.join(testingDir, 'result', 'report.xlsx');
const configPath = path.join(testingDir, 'gdrive-config.json');

// Credential files
const tokenPath = path.join(testingDir, 'token.json');
const oauthCredsPaths = [
  path.join(testingDir, 'oauth-credentials.json'),
  path.join(frontendDir, 'oauth-credentials.json'),
  path.join(projectRootDir, 'oauth-credentials.json')
];

const candidateKeyPaths = [
  process.env.GDRIVE_KEY_PATH,
  path.join(testingDir, 'gdrive-key.json'),
  path.join(testingDir, 'service-account.json'),
  path.join(frontendDir, 'gdrive-key.json'),
  path.join(frontendDir, 'service-account.json'),
  path.join(projectRootDir, 'gdrive-key.json'),
  path.join(projectRootDir, 'service-account.json')
].filter(Boolean);

function findServiceAccountKey() {
  for (const p of candidateKeyPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function findOAuthCredentials() {
  for (const p of oauthCredsPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadConfig() {
  let cfg = {};
  if (fs.existsSync(configPath)) {
    try {
      cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
      console.warn(`[GDrive Sync] Warning: Failed to parse ${configPath}:`, err.message);
    }
  }

  return {
    folderId: process.env.GDRIVE_FOLDER_ID || cfg.folderId || null,
    fileId: process.env.GDRIVE_FILE_ID || cfg.fileId || null,
    fileName: process.env.GDRIVE_FILE_NAME || cfg.fileName || 'report.xlsx',
    convertToGoogleSheets: process.env.GDRIVE_CONVERT_TO_SHEETS !== undefined
      ? process.env.GDRIVE_CONVERT_TO_SHEETS === 'true'
      : (cfg.convertToGoogleSheets ?? false),
    filePath: process.env.GDRIVE_LOCAL_FILE_PATH || cfg.filePath || defaultXlsxPath
  };
}

async function getAuthClient() {
  // 1. Check if OAuth token or credentials exist
  const oauthFile = findOAuthCredentials();
  if (fs.existsSync(tokenPath) || oauthFile) {
    if (oauthFile) {
      const rawCreds = JSON.parse(fs.readFileSync(oauthFile, 'utf8'));
      const c = rawCreds.installed || rawCreds.web;
      const oauth2Client = new google.auth.OAuth2(
        c.client_id,
        c.client_secret,
        'http://localhost:3000/oauth2callback'
      );

      if (fs.existsSync(tokenPath)) {
        const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
        oauth2Client.setCredentials(tokens);
        return { client: oauth2Client, type: 'oauth' };
      }

      // One-time OAuth approval flow
      console.log('\n🔑 [GDrive Sync] First-time OAuth login needed for personal Google account...');
      return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
          try {
            if (req.url.startsWith('/oauth2callback')) {
              const query = url.parse(req.url, true).query;
              if (query.code) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h3>✅ Google Drive authorization successful! You can close this tab and return to the terminal.</h3>');
                server.close();
                const { tokens } = await oauth2Client.getToken(query.code);
                oauth2Client.setCredentials(tokens);
                fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
                console.log(`✅ [GDrive Sync] OAuth refresh token saved to: ${tokenPath}`);
                resolve({ client: oauth2Client, type: 'oauth' });
              }
            }
          } catch (e) {
            reject(e);
          }
        }).listen(3000, () => {
          const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/drive.file']
          });
          console.log('\nPlease open this URL in your browser to authorize access:\n' + authUrl + '\n');
          exec(`start "" "${authUrl}"`);
        });
      });
    }
  }

  // 2. Check for Service Account Key
  const saKeyPath = findServiceAccountKey();
  if (saKeyPath) {
    const auth = new google.auth.GoogleAuth({
      keyFile: saKeyPath,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    return { client: auth, type: 'service_account', path: saKeyPath };
  }

  return null;
}

async function syncReportToGDrive(options = {}) {
  const config = { ...loadConfig(), ...options };
  const targetFile = config.filePath;

  if (!fs.existsSync(targetFile)) {
    console.error(`\n❌ [GDrive Sync] Target XLSX file not found at: ${targetFile}`);
    console.error('Please run the Playwright tests first to generate the report.\n');
    return { success: false, reason: 'missing_report_file' };
  }

  const authInfo = await getAuthClient();
  if (!authInfo) {
    console.error('\n❌ [GDrive Sync] No credentials found!');
    console.error('Please provide either:');
    console.error(`  - Service Account key: ${path.join(testingDir, 'gdrive-key.json')}`);
    console.error(`  - OR OAuth Client credentials: ${path.join(testingDir, 'oauth-credentials.json')}\n`);
    return { success: false, reason: 'missing_credentials' };
  }

  try {
    console.log(`\n🔄 [GDrive Sync] Authenticating via ${authInfo.type.toUpperCase()}${authInfo.path ? ` (${authInfo.path})` : ''}...`);
    const drive = google.drive({ version: 'v3', auth: authInfo.client });

    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const media = {
      mimeType,
      body: fs.createReadStream(targetFile)
    };

    let targetFileId = config.fileId;

    // Search for existing file in target folder or drive
    if (!targetFileId) {
      console.log(`🔍 [GDrive Sync] Checking destination folder for "${config.fileName}"...`);
      if (config.folderId) {
        const folderListRes = await drive.files.list({
          q: `'${config.folderId}' in parents and trashed = false`,
          fields: 'files(id, name, mimeType, webViewLink)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
        const folderFiles = folderListRes.data.files || [];
        if (folderFiles.length > 0) {
          console.log(`📂 [GDrive Sync] Files currently in folder (${folderFiles.length}):`);
          folderFiles.forEach(f => console.log(`   - "${f.name}" (ID: ${f.id}, mime: ${f.mimeType})`));
        } else {
          console.log(`📂 [GDrive Sync] Destination folder appears empty to this service account.`);
        }

        const baseName = config.fileName.replace(/\.xlsx$/i, '').toLowerCase();
        const matched = folderFiles.find(f => 
          f.name.toLowerCase() === config.fileName.toLowerCase() ||
          f.name.toLowerCase() === baseName ||
          f.name.toLowerCase().startsWith(baseName)
        );

        if (matched) {
          targetFileId = matched.id;
          console.log(`📎 [GDrive Sync] Matched existing file "${matched.name}": ID ${targetFileId}`);
        }
      } else {
        const listRes = await drive.files.list({
          q: `name = '${config.fileName}' and trashed = false`,
          fields: 'files(id, name, webViewLink)',
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
        if (listRes.data.files && listRes.data.files.length > 0) {
          targetFileId = listRes.data.files[0].id;
          console.log(`📎 [GDrive Sync] Found existing file: ID ${targetFileId}`);
        }
      }
    }

    let result;
    if (targetFileId) {
      console.log(`⬆️  [GDrive Sync] Updating existing file in Google Drive...`);
      result = await drive.files.update({
        fileId: targetFileId,
        media,
        fields: 'id, name, webViewLink, modifiedTime',
        supportsAllDrives: true
      });
      console.log(`✅ [GDrive Sync] File updated successfully!`);
    } else {
      console.log(`⬆️  [GDrive Sync] Uploading new file to Google Drive...`);
      const fileMetadata = {
        name: config.fileName,
        ...(config.folderId ? { parents: [config.folderId] } : {}),
        ...(config.convertToGoogleSheets ? { mimeType: 'application/vnd.google-apps.spreadsheet' } : {})
      };

      result = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, name, webViewLink, modifiedTime',
        supportsAllDrives: true
      });
      console.log(`✅ [GDrive Sync] File created successfully!`);
    }

    const { id, name, webViewLink } = result.data;
    console.log('──────────────────────────────────────────────────');
    console.log(`📁 File Name : ${name}`);
    console.log(`🆔 File ID   : ${id}`);
    if (webViewLink) {
      console.log(`🔗 Link      : ${webViewLink}`);
    }
    console.log('──────────────────────────────────────────────────\n');

    return { success: true, data: result.data };
  } catch (error) {
    console.error('\n❌ [GDrive Sync] Error syncing to Google Drive:', error.message);

    if (error.message.includes('storage quota has been exceeded')) {
      console.error('\n' + '='.repeat(60));
      console.error('⚠️  WHY THIS ERROR OCCURS WITH SERVICE ACCOUNTS:');
      console.error('Google allocates ZERO (0 bytes) storage quota to Service Accounts for');
      console.error('personal @gmail.com accounts. When a service account creates a new');
      console.error('file, Google assigns file ownership to the service account, which immediately');
      console.error('triggers "Drive storage quota exceeded".');
      console.error('\n👉 QUICK FIX (30 seconds):');
      console.error('1. Open your shared folder in Google Drive (in your browser).');
      console.error('2. Upload any file named "report.xlsx" there manually once (so YOU own it).');
      console.error('3. Run "pnpm test:sync" again. The service account will UPDATE your file');
      console.error('   without creating a new one!');
      console.error('\n👉 OR PERMANENT FIX (OAuth 2.0 Desktop):');
      console.error('Create an OAuth 2.0 Desktop Client in GCP Console and save it as:');
      console.error(`   ${path.join(testingDir, 'oauth-credentials.json')}`);
      console.error('This uses your personal account\'s full 15 GB storage quota.');
      console.error('='.repeat(60) + '\n');
    } else if (error.code === 403 || error.code === 404) {
      console.error('💡 Hint: Verify that your Service Account email has been added as an Editor to the destination Google Drive folder.');
    }

    return { success: false, error };
  }
}

// Execute directly if run as a standalone CLI script
if (require.main === module) {
  syncReportToGDrive().then(res => {
    if (!res.success && res.reason !== 'missing_credentials') {
      process.exit(1);
    }
  });
}

module.exports = { syncReportToGDrive };
