# Code signing policy

API Tester Desktop releases are built from version tags in this repository by the [Windows release workflow](.github/workflows/release.yml). The workflow builds the Electron application and Go backend, packages them with Inno Setup, and uploads the installer to [GitHub Releases](https://github.com/rdhmuhammad/apitester-desktop/releases). It checks the published asset's SHA-256 digest before making a release public. The desktop updater also verifies that digest and file size before launching an update.

## Current signing status

The initial releases use a self-signed certificate with subject `CN=API Tester`. Its SHA-1 certificate thumbprint is `70CC15EF2598BF896412B7C369B1780B729B0CBD`, valid through 7 November 2027. The workflow signs the desktop executable, backend service, and installer with the same certificate and a timestamp. The private key is held by the maintainer and supplied to GitHub Actions as encrypted repository secrets.

A self-signed signature does **not** establish a publicly trusted publisher. Windows may show an Unknown Publisher or SmartScreen warning. Users should download only from this repository's GitHub Releases page and should not import this certificate into their Windows trust stores. The project plans to apply for SignPath Foundation signing after its first public release and documentation are complete.

## Project roles and release approval

- Maintainer, committer, reviewer, and signing approver: [Ridho Muhammad](https://github.com/rdhmuhammad).
- Contributions from other people are reviewed by the maintainer before merging.
- The maintainer approves a release by pushing its version tag. GitHub Actions verifies the tag against `frontend/package.json`, signs the binaries, and publishes only after the signature and release digest checks pass.

## Network and local data

The application sends API requests to destinations the user configures. On startup, packaged Windows builds query GitHub's public release API to check for updates and download an installer only after the user starts the update. The local backend stores application data and logs under Windows ProgramData. Review configured request targets and scripts before running them; those can contact external services.

Questions or security concerns can be raised through this repository's [issue tracker](https://github.com/rdhmuhammad/apitester-desktop/issues).
