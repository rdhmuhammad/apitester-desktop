# Desktop Production Build and Packaging Pipeline

**Summary**: Production build and packaging workflow for Apitester Desktop, compiling the Windows service backend, portable Electron frontend, and generating the Inno Setup Windows installer (`Apitester-Setup.exe`).
**Sources**: `cmd/windows/main.go`, `frontend/package.json`, `deployment/desktop/setup.iss`
**Last updated**: 2026-09-21

---

## Context and Decision

Apitester Desktop consists of two primary runtime binaries and an installer:
1. **Backend Service (`apitester-backend.exe`)**: A Go HTTP/Socket server implemented with Windows Service bindings (`golang.org/x/sys/windows/svc`) in `cmd/windows/main.go`. It runs as a background Windows service (`Apitester-backend`) initialized with `--env <path-to-.env.prod>`.
2. **Frontend UI (`apitester.exe`)**: An Electron application wrapping the React + Vite single-page application, packaged as a portable Win32 executable.
3. **Inno Setup Installer (`Apitester-Setup.exe`)**: A Windows installer script (`deployment/desktop/setup.iss`) that copies the application binaries and configuration to `C:\Program Files\Apitester`, configures and starts the backend Windows service via `sc.exe`, registers shortcuts, and launches the UI.

The packaging pipeline compiles both targets into `deployment/desktop/build/` and executes the Inno Setup compiler (`ISCC.exe`) to produce the standalone distribution installer in `deployment/desktop/installer/`.

---

## Build Steps

### 1. Build Backend (`apitester-backend.exe`)

Compile the Windows-specific entry point (`cmd/windows`) with stripped debug symbols:

```powershell
go build -ldflags="-s -w" -o deployment/desktop/build/apitester-backend.exe ./cmd/windows
```

- **Entry point**: `cmd/windows/main.go` implements the `WinService` lifecycle hooks (`Execute`, `logEvent`) and command-line flags (`--env` to supply the environment configuration file path).
- **Target path**: `deployment/desktop/build/apitester-backend.exe`.

### 2. Build Frontend (`apitester.exe`)

Compile the React frontend, compile Electron TypeScript sources, and run `electron-builder` to package the executable:

```powershell
cd frontend
pnpm build:electron:dist
cd ..
```

- **Underlying scripts** (from `frontend/package.json`):
  - `pnpm build`: Runs `vite build` to output `frontend/dist/`.
  - `tsc -p electron/tsconfig.json`: Compiles Electron main and worker processes.
  - `copy-preload`: Copies preload scripts into the dist directory.
  - `electron-builder --win`: Packages the application with `target: "portable"` and runs `afterPack.cjs` to apply version and icon metadata.
- **Output artifact**: `frontend/release/Apitester 0.0.1.exe`.

Copy the generated executable to the deployment staging directory:

```powershell
Copy-Item "frontend/release/Apitester 0.0.1.exe" -Destination "deployment/desktop/build/apitester.exe" -Force
```

### 3. Build Installer (`Apitester-Setup.exe`)

Run the Inno Setup 6 compiler against `deployment/desktop/setup.iss`:

```powershell
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" deployment/desktop/setup.iss
```

- **Output artifact**: `deployment/desktop/installer/Apitester-Setup.exe`.
- **Installer Actions**:
  - Installs files from `deployment/desktop/build/*` into `{app}` (`C:\Program Files\Apitester`).
  - Installs `.env.prod` into `{app}\.env.prod`.
  - Creates the database directory: `{app}\resource\db`.
  - Registers the backend service via `sc.exe`:
    ```cmd
    sc.exe create Apitester-backend binPath= "{app}\apitester-backend.exe --env \"{app}\.env.prod\"" start= auto
    ```
  - Starts the backend service: `sc.exe start Apitester-backend`.
  - Creates desktop and start menu shortcuts for `{app}\apitester.exe`.
  - Launches `{app}\apitester.exe` upon setup completion.
  - On uninstall: stops and deletes `Apitester-backend` via `sc.exe`, and prompts to purge `{commonappdata}\Apitester`.

---

## Unified Build Automation Script

To execute the entire build and packaging workflow end-to-end in PowerShell:

```powershell
# 1. Build Backend
Write-Host "Building Backend..." -ForegroundColor Cyan
go build -ldflags="-s -w" -o deployment/desktop/build/apitester-backend.exe ./cmd/windows
if ($LASTEXITCODE -ne 0) { throw "Backend build failed" }

# 2. Build Frontend & Electron
Write-Host "Building Frontend..." -ForegroundColor Cyan
Push-Location frontend
pnpm build:electron:dist
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Frontend build failed" }
Pop-Location

# Copy to deployment/desktop/build/apitester.exe
Copy-Item "frontend/release/Apitester 0.0.1.exe" -Destination "deployment/desktop/build/apitester.exe" -Force

# 3. Compile Inno Setup Installer
Write-Host "Compiling Inno Setup Installer..." -ForegroundColor Cyan
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" deployment/desktop/setup.iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup compilation failed" }

Write-Host "Build complete: deployment/desktop/installer/Apitester-Setup.exe" -ForegroundColor Green
```

---

## Related pages

- [[decisions/index]]
- [[index]]
