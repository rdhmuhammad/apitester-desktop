# GitHub Release Updates

**Summary**: Electron checks the public GitHub latest release, shows an update badge for newer versions, verifies the downloaded Inno installer, and launches it to upgrade the UI and backend service.
**Sources**: `frontend/electron/release.ts`, `frontend/electron/updater.ts`, `frontend/electron/main.ts`, `frontend/electron/preload.cjs`, `frontend/src/layout/components/header/TitleBar.tsx`, `deployment/desktop/setup.iss`, `.github/workflows/release.yml`
**Last updated**: 2026-11-07

---

## Release contract

`frontend/package.json` provides the version. A stable tag `vX.Y.Z` publishes an exact asset named `Apitester-Setup-vX.Y.Z.exe`. The Windows release workflow builds the Go service and portable Electron UI, signs the binaries and installer, verifies the asset digest in a draft release, then publishes it.

The workflow currently accepts a temporary self-signed PFX through the `WINDOWS_SIGNING_CERT_BASE64` and `WINDOWS_SIGNING_CERT_PASSWORD` secrets. It validates the PFX lifetime, private key, and Code Signing enhanced key usage before use. The runner signs the frontend, backend, and installer with the same thumbprint and a timestamp, verifies each Authenticode signature while allowing only the expected untrusted-root result, then removes the temporary PFX before publishing. It does not add the self-signed certificate to the runner's trusted root store. See [[decisions/self-signed-windows-release-signing]] for the owner setup and release checklist.

Self-signing does not make the publisher publicly trusted. Windows SmartScreen or Unknown Publisher warnings remain expected until the project moves to a publicly trusted signing service. Publishing stops if certificate validation, signing, signature verification, or the release asset digest check fails.

## Desktop flow

On packaged Windows startup, Electron calls GitHub's public `/releases/latest` API. It compares the release tag with `app.getVersion()` numerically and accepts only a newer stable version with the exact installer filename, positive size, SHA-256 digest, and expected GitHub download URL. Development builds and non-Windows platforms do not check.

The renderer receives update state through a narrow preload bridge and shows a button in the title bar. A click streams the installer into a temporary `.part` file. Electron checks the byte count and SHA-256 digest against GitHub metadata, renames the completed file, launches Inno Setup, and quits. Failed or incomplete downloads are never executed. The installed application's hash is not compared with the installer hash because these are different binaries.

The Inno installer keeps the same application ID, retains the existing backend port and ProgramData by default, updates application files, restarts the backend service, and offers to launch the new UI. This extends [[decisions/desktop-production-build]].

## Operational limits

Public GitHub API checks are unauthenticated and subject to the originating IP's rate limit. One background check occurs per application launch; a missing stable release or failed initial check leaves the app usable without an update badge. The first update can only appear after a stable release is published with the required asset and digest.

## Related pages

- [[decisions/desktop-production-build]]
- [[decisions/self-signed-windows-release-signing]]
- [[patterns/frontend/index]]
