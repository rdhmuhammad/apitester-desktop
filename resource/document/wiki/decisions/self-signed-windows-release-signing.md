# Self-Signed Windows Release Signing

**Summary**: Temporary Windows release-signing procedure using a self-signed PFX in GitHub Actions while API Tester prepares for publicly trusted signing.
**Sources**: `.github/workflows/release.yml`, `.gitignore`, `frontend/package.json`, `resource/document/wiki/decisions/github-release-updates.md`
**Last updated**: 2026-11-07

---

## Decision and limits

API Tester keeps its Inno Setup installer and temporarily signs the frontend executable, backend service, and installer with one self-signed code-signing certificate. The certificate gives the files a stable cryptographic signature, but it does not establish a publisher identity trusted by Windows.

Public users should still expect Windows SmartScreen or Unknown Publisher warnings. Do not instruct users to install the public `.cer` into a trusted certificate store. Public trust will come later from a service such as SignPath Foundation.

The GitHub runner checks Authenticode without adding the self-signed certificate to its trusted root store. An untrusted-root result is expected for this temporary publisher; a missing signature, hash mismatch, different signer, or missing timestamp still fails publication. The workflow removes the temporary PFX before publishing.

## One-time certificate preparation

The current signing identity was generated on the release maintainer's Windows account on 2026-11-07. It expires on 2027-11-07 and has thumbprint `70CC15EF2598BF896412B7C369B1780B729B0CBD`. The files are in `%LOCALAPPDATA%\Apitester\signing`: `apitester-self-signing.pfx`, `apitester-self-signing.cer`, and `apitester-pfx-password.dpapi`. The password file is encrypted with Windows DPAPI for this user account and computer. Back up the PFX and password separately before relying on them for future releases.

For renewal, run the following in PowerShell on a trusted Windows computer. Enter a strong password interactively; never write it into the script. Use a new output directory so you do not overwrite the previous signing identity.

```powershell
$outputDirectory = Join-Path $env:LOCALAPPDATA 'Apitester\signing-renewal'
New-Item -ItemType Directory -Path $outputDirectory -ErrorAction Stop | Out-Null

$pfxPassword = Read-Host 'Enter a strong PFX password' -AsSecureString
$certificate = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject 'CN=API Tester' `
  -FriendlyName 'API Tester temporary release signing' `
  -KeyAlgorithm RSA `
  -KeyLength 3072 `
  -HashAlgorithm SHA256 `
  -KeyExportPolicy Exportable `
  -KeyUsage DigitalSignature `
  -CertStoreLocation 'Cert:\CurrentUser\My' `
  -NotAfter (Get-Date).AddYears(1)

$pfxPath = Join-Path $outputDirectory 'apitester-self-signing.pfx'
$cerPath = Join-Path $outputDirectory 'apitester-self-signing.cer'

Export-PfxCertificate -Cert $certificate -FilePath $pfxPath -Password $pfxPassword | Out-Null
Export-Certificate -Cert $certificate -FilePath $cerPath | Out-Null

$certificate | Select-Object Subject, Thumbprint, NotBefore, NotAfter
```

Keep the PFX and its password in separate secure locations. The PFX is the private signing identity; anyone who obtains it and the password can sign files as this temporary publisher. The `.gitignore` rules reject `.pfx` and `.p12` files, but the owner must still avoid attaching the PFX to issues, releases, messages, or build artifacts.

## Add the GitHub Actions secrets

On the maintainer's Windows account, copy the PFX as Base64 without printing it to the terminal:

```powershell
$pfxPath = Join-Path $env:LOCALAPPDATA 'Apitester\signing\apitester-self-signing.pfx'
[Convert]::ToBase64String([IO.File]::ReadAllBytes($pfxPath)) | Set-Clipboard
```

After saving the first GitHub secret, copy the password from the DPAPI protected file to the clipboard without displaying it:

```powershell
$passwordFile = Join-Path $env:LOCALAPPDATA 'Apitester\signing\apitester-pfx-password.dpapi'
$password = Get-Content -LiteralPath $passwordFile -Raw | ConvertTo-SecureString
$credential = [pscredential]::new('apitester-signing', $password)
$credential.GetNetworkCredential().Password | Set-Clipboard
```

Paste it into the second GitHub secret, then clear your clipboard when finished. The DPAPI file can only be decrypted by the Windows user account that created it on this computer; an offline backup needs a separately recoverable password copy.

Open the GitHub repository and go to **Settings → Secrets and variables → Actions → New repository secret**. Create these secrets:

| Secret | Value |
| --- | --- |
| `WINDOWS_SIGNING_CERT_BASE64` | Paste the Base64 value from the clipboard. |
| `WINDOWS_SIGNING_CERT_PASSWORD` | Enter the exact password used when exporting the PFX. |

Do not add the PFX itself to the repository. GitHub secrets cannot be downloaded later, so retain the protected offline backup.

## What the release workflow enforces

The Windows release workflow:

1. Decodes the PFX into the temporary runner directory.
2. Rejects an unreadable, password-mismatched, expired, not-yet-valid, private-key-free, or non-code-signing certificate.
3. Signs `apitester.exe` and `apitester-backend.exe` with SHA-256 and an RFC 3161 timestamp.
4. Compiles the Inno Setup installer and signs it with the same certificate.
5. Checks all three Authenticode signatures, their signer thumbprint, and their timestamp. It accepts `Valid`, `NotTrusted`, or `UnknownError` only when the message identifies an untrusted root. The self-signed certificate has no public trust chain.
6. Removes the temporary PFX even when an earlier step fails.
7. Creates a draft GitHub release, requires GitHub's SHA-256 asset digest to match the built installer, and only then publishes it.

This extends [[decisions/github-release-updates]]. The updater continues to verify the downloaded byte count and GitHub SHA-256 digest before executing the installer.

## Publish a release

The tag must exactly match the version in `frontend/package.json`:

```powershell
$version = (Get-Content frontend/package.json -Raw | ConvertFrom-Json).version
git tag "v$version"
git push origin "v$version"
```

Before tagging, commit the intended release source and confirm that the version is a stable `major.minor.patch` value. After pushing, review the **Windows release** run under GitHub Actions. Confirm that all three signature checks pass and that the release contains exactly `Apitester-Setup-vX.Y.Z.exe` with a `sha256:` digest.

If a tag-triggered run needs a workflow correction before publication, update the workflow on `main` and use **Actions → Windows release → Run workflow** with the existing tag in the required `tag` input. The corrected workflow checks out that tag's source and builds the same version. Do not move a published tag.

Download the installer on a clean Windows VM and verify:

- The installer has a **Digital Signatures** tab naming `API Tester`.
- Windows may still display an untrusted or Unknown Publisher warning; this is expected for a self-signed certificate.
- Installation creates and starts `Apitester-backend`.
- The desktop application connects to the selected backend port.
- A second tagged release appears in the update notification, downloads, verifies, and upgrades in place.

## Owner checklist

- [x] Generate the self-signed PFX and public CER on the maintainer's Windows account.
- [x] Record the certificate thumbprint and expiry date.
- [ ] Store the PFX and its password separately in secure backups.
- [x] Add `WINDOWS_SIGNING_CERT_BASE64` to GitHub Actions secrets.
- [x] Add `WINDOWS_SIGNING_CERT_PASSWORD` to GitHub Actions secrets.
- [ ] Confirm the first tagged workflow signs and verifies all three binaries.
- [ ] Test fresh installation and an in-place update on a clean Windows VM.
- [ ] Rotate the certificate and replace both GitHub secrets before it expires.
- [ ] Publish a stable release and public project documentation.
- [x] Add a public **Code signing policy**, privacy statement, and maintainer/reviewer/approver roles before applying to SignPath Foundation. See `CODE_SIGNING.md`.
- [ ] Replace self-signing with SignPath after approval; do not distribute the temporary PFX.

## Related pages

- [[decisions/github-release-updates]]
- [[decisions/desktop-production-build]]
- [[index]]
