# Google Drive Service Account Sync for Test Reports

**Summary**: Architecture, security permissions, and step-by-step setup for synchronizing Playwright test reports (`report.xlsx`) to Google Drive using a Google Cloud Service Account.
**Sources**: `frontend/testing/sync-gdrive.cjs`, `frontend/testing/csv-export.cjs`, `frontend/package.json`
**Last updated**: 2026-10-11

---

## Context and Decision

The Playwright test pipeline generates test results and component coverage reports in `frontend/testing/result/report.xlsx`. To enable automated sharing and remote review of test summaries without third-party SaaS subscriptions or manual uploads:

1. **Automation Mechanism**: An automated synchronization utility (`frontend/testing/sync-gdrive.cjs`) uses the official `googleapis` client.
2. **Authentication Choice**: A dedicated **Google Cloud Service Account** was selected over user-interactive OAuth2 or desktop sync clients. Service accounts run headlessly, require no interactive browser logins, and incur zero cost under standard Google Drive API free tiers.
3. **Storage Model**: The service account writes directly into a designated user-owned Google Drive folder. Reports can be preserved as raw Excel (`.xlsx`) files or converted into native interactive Google Sheets via `convertToGoogleSheets: true`.

---

## Security and Permission Strategy (Least Privilege)

To ensure zero risk to Google Cloud infrastructure or personal Google Drive data, permissions are compartmentalized across two distinct layers:

| Layer | Configured Permission | Security Rationale |
| :--- | :--- | :--- |
| **GCP Project IAM** | **None (Empty / Skip)** | Service accounts do not need project-level roles (e.g., Viewer/Editor/Owner). Leaving IAM empty ensures the service account cannot provision, inspect, or manage any billable Google Cloud resources. |
| **Google Drive Folder** | **Editor (Folder-scoped)** | Sharing only the destination folder with the service account email restricts file access strictly to that directory. The service account cannot see, read, or modify any other files in the user's personal Drive. |
| **OAuth API Scope** | `.../auth/drive.file` | Restricts API access exclusively to files and folders created by or explicitly shared with this application, avoiding broad drive-wide scopes. |

---

## Step-by-Step Preparation Guide

### Step 1: Create a Google Cloud Project & Enable Drive API
1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top navigation and select **New Project** (e.g., `Apitester Sync`).
3. Open **APIs & Services** → **Library**.
4. Search for **Google Drive API** and click **Enable**.

### Step 2: Create the Service Account
1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **Service Account**.
3. Set the service account name (e.g., `apitester-reporter`).
4. In step 2 (*Grant this service account access to project*), leave the role **empty** and click **Continue**.
5. Click **Done**. Copy the generated service account email (e.g., `apitester-reporter@<project-id>.iam.gserviceaccount.com`).

### Step 3: Generate and Place the JSON Key
1. Under **Credentials** → **Service Accounts**, click the service account email.
2. Open the **Keys** tab and click **Add Key** → **Create new key**.
3. Select **JSON** and download the key file.
4. Move and rename the key file to:
   ```text
   frontend/testing/gdrive-key.json
   ```
   *(Note: Ignored by Git via `.gitignore` to prevent credential exposure).*

### Step 4: Share Destination Folder in Google Drive
1. Open [Google Drive](https://drive.google.com/) and navigate to or create the target report folder.
2. Click **Share** on the folder.
3. Paste the service account email address, grant it the **Editor** role, and click **Share**.
4. Extract the folder ID from the browser URL:
   - URL: `https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ`
   - Folder ID: `1aBcDeFgHiJkLmNoPqRsTuVwXyZ`

### Step 5: Configure `gdrive-config.json`
Create `frontend/testing/gdrive-config.json` (template available at `frontend/testing/gdrive-config.example.json`):

```json
{
  "folderId": "YOUR_COPIED_FOLDER_ID",
  "fileName": "report.xlsx",
  "convertToGoogleSheets": false
}
```

- `"convertToGoogleSheets": false`: Stores the raw binary Excel `.xlsx` file.
- `"convertToGoogleSheets": true`: Converts the file on upload to a native interactive Google Spreadsheet for direct browser viewing without downloading.

---

## Execution Workflows

- **Manual Sync**:
  ```powershell
  cd frontend
  pnpm test:sync
  ```
- **Automatic Test Export & Sync**:
  ```powershell
  cd frontend
  pnpm test:export
  ```
  `csv-export.cjs` automatically detects `gdrive-key.json` and syncs the updated `report.xlsx` to Google Drive upon completion.

---

## Troubleshooting: "The user's Drive storage quota has been exceeded"

### Root Cause
For personal `@gmail.com` accounts, Google assigns **0 bytes (zero storage quota)** to Service Accounts. When a Service Account creates a new file, Google assigns file ownership to the service account, which immediately throws `Drive storage quota has been exceeded` regardless of how much space your personal account has.

### Solutions
1. **Quick Fix (Pre-create file)**: Upload or create a file named `report.xlsx` inside the Google Drive folder once manually from the browser. Because the file is owned by your personal account, the service account performs an update (`drive.files.update`) without creating a file.
2. **Permanent Fix (OAuth 2.0 Desktop Client)**: Use an OAuth 2.0 Desktop Client credentials JSON (`frontend/testing/oauth-credentials.json`). `sync-gdrive.cjs` will automatically open the browser once to authenticate your personal account, save `token.json`, and thereafter sync headlessly using your personal 15 GB quota.

---

## Related pages

- [[decisions/index]]
- [[tasks/backlog]]
