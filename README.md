<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->
<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![project_license][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a>
    <img src="https://raw.githubusercontent.com/rdhmuhammad/apitester/refs/heads/main/frontend/src/assets/images/logo.svg" alt="Logo" width="80" height="80">
  </a>

<h3 align="center">API Tester Desktop</h3>

  <p align="center">
    An integrated ecosystem for API development and testing: extract specifications directly from code, test endpoints via a modern desktop GUI, execute test scenarios, manage environments, and automate deployments.
    <br />
    <a href="https://github.com/rdhmuhammad/apitester"><strong>Explore the repository »</strong></a>
    <br />
    <br />
    <a href="https://github.com/rdhmuhammad/apitester/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/rdhmuhammad/apitester/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
  </p>
</div>

<!-- ABOUT THE PROJECT -->
## 📖 About The Project

<div align="center">
    <img src="https://raw.githubusercontent.com/rdhmuhammad/apitester/refs/heads/main/resource/example_gui/request.png" width="380" alt="Example request">
    <img src="https://raw.githubusercontent.com/rdhmuhammad/apitester/refs/heads/main/resource/example_gui/response.png" width="380" alt="Example response">
</div>

<br />

Have you ever gotten tired of manually creating Postman requests every time you finish an endpoint?
It gets even worse when you're working with endpoints that have massive request payloads like transaction APIs in e-commerce systems, which often contain multiple nested objects, arrays, and dozens of fields that all need valid values.
On top of that, you usually need to prepare several variations of the request to cover different test scenarios. It can be repetitive, time-consuming, and honestly, pretty frustrating.

Driven by these frustrations, my initial workaround was to delegate the task to agentic AI. While it worked, using AI for something highly repetitive and deterministic was a waste of resources. Many of these tasks can be automated without requiring an LLM at all.

That's what motivated me to create this project.

The goal of this project is to reduce repetitive work during development:
1. **Automated Documentation & Generation**: Scan controllers in target services and automatically generate API documentation and collections (such as Postman-compatible collections).
2. **Dedicated Desktop Client**: An Electron-based desktop application providing a Postman-like experience with multi-tab request editing, tree management, pre/post-request scripting sandbox, environment variable substitution, and real-time synchronization.
3. **Automated Test Scenarios & Workflows**: Execute `.http` scenario test suites and manage Ansible automation playbooks and inventories directly inside the editor.
4. **Zero-Setup Embedded Storage**: Powered by BoltDB (`bbolt`), eliminating the overhead of external database dependencies like MySQL or PostgreSQL.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

* [![TypeScript][typescript-shield]][typescript-url]
* [![React 19][react-shield]][react-url]
* [![Electron][electron-shield]][electron-url]
* [![Vite 7][vite-shield]][vite-url]
* [![Tailwind CSS v4][tailwind-shield]][tailwind-url]
* [![Redux Toolkit][redux-shield]][redux-url]
* [![Go 1.26][go-shield]][go-url]
* [![Gin][gin-shield]][gin-url]
* [![BoltDB][bbolt-shield]][bbolt-url]
* [![Socket.IO][socketio-shield]][socketio-url]
* [![Playwright][playwright-shield]][playwright-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## 📚 Table of Contents

<details>
<summary>Click to expand</summary>

- 📁 [Project Structure](#-project-structure)
- 🚀 [Getting Started](#-getting-started)
    - 📦 [Prerequisites](#-prerequisites)
    - ▶️ [How to Run (Development)](#️-how-to-run-development)
    - 🏗️ [Production Desktop Build & Installer](#️-production-desktop-build--installer)
- 🧪 [How to Run Tests](#-how-to-run-tests)
- 📄 [How to Flatten Documentation](#-how-to-flatten-documentation)
- 🧩 [Roadmap](#-roadmap)
- 👨‍💻 [Contributing](#-contributing)
    - 🤷‍♂️ [Top contributors](#️-top-contributors)
- 🗃 [License](#-license)
- ☎️ [Contact](#-contact)

</details>

<!-- PROJECT STRUCTURE -->
## 📁 Project Structure

```text
apitester-desktop/
├── cmd/
│   ├── api/                    # Local HTTP & Socket.IO backend entry point
│   └── windows/                # Windows Service backend wrapper entry point
├── internal/
│   ├── adapter/
│   │   ├── controller/         # Gin REST controllers (collection, restrequest, tree, automation, testsuits)
│   │   └── socket/             # Socket.IO event handlers and rooms
│   ├── domain/                 # Core domain entities and models
│   ├── mockdata/               # Dynamic mock data generators
│   └── service/                # Business logic and usecases
├── pkg/                        # Reusable packages (bbolt db, elog, cio socket, logger, watcher)
├── shared/                     # Server lifecycle, dependency injection, and HTTP payload abstractions
├── frontend/
│   ├── electron/               # Electron main process, preload script, and window management
│   ├── src/                    # React 19 UI (editor tabs, sidebar, test runners, redux state)
│   └── testing/                # Playwright end-to-end test scenarios, reports, and sync scripts
├── deployment/
│   └── desktop/                # Desktop packaging staging and Inno Setup installer script (setup.iss)
├── resource/
│   ├── apidocs/                # Postman and API specification JSON collections
│   ├── db/                     # Local BoltDB database storage
│   ├── document/               # Project documentation, raw sources, and LLM wiki
│   └── flatten_result/         # Pyragify flattened documentation output
└── config.yaml                 # Pyragify documentation flattening configuration
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## 🚀 Getting Started

Apitester Desktop consists of two coordinated components:

1. **Golang Backend Service**: Serves the REST API and Socket.IO server, persisting all collections, requests, environments, and test suites in an embedded **BoltDB** key-value store (`bbolt`). It can be run via CLI (`cmd/api/main.go`) or registered as a background Windows Service (`cmd/windows/main.go`).
2. **Electron Desktop Application**: A React 19 single-page application packaged with Electron, featuring frameless desktop navigation, CORS restriction bypass for local/remote API calls, and real-time bidirectional updates via Socket.IO.

### 📦 Prerequisites

Before running the project locally, ensure the following tools are installed:

* **Golang**: Version `1.26.0` or higher ([download](https://go.dev/dl/))
* **Node.js**: Version `22.0` or higher ([download](https://nodejs.org/))
* **PNPM**: Version `10.x` ([installation guide](https://pnpm.io/installation))
* **Inno Setup 6** *(Optional)*: Required only if you want to compile the Windows installer executable (`ISCC.exe`).
* **Database**: **None required!** BoltDB is embedded and runs out-of-the-box with zero database daemon setup.

### ▶️ How to Run (Development)

#### 1. Setup Backend

1. Ensure your initial collection file is located at `resource/apidocs/collection.json` (or your chosen path).
2. Create your environment configuration file by copying `.env.example` to `.env.stag` or `.env.dev`:
   ```bash
   cp .env.example .env.stag
   ```
3. Verify the environment variables in `.env.stag`:
   ```dotenv
   APP_PORT=8990
   BOLT_DB_PATH=resource/db/collection.db
   LOG_LEVEL=debug
   ```
4. Download dependencies and start the backend:
   ```bash
   go mod download
   go run cmd/api/main.go --env .env.stag
   ```

#### 2. Setup Frontend

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Configure frontend environment variables in `frontend/.env` (or copy from `frontend/.env.example`):
   ```dotenv
   VITE_API_URL=http://localhost:8990/api/v1
   VITE_SOCKET_URL=http://localhost:8990
   VITE_SOCKET_PATH=/socket.io
   ```
   *(Ensure the port matches `APP_PORT` from your backend configuration)*
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Run the application:
   - **Electron Desktop App (Recommended)**:
     ```bash
     pnpm run dev:electron
     ```
   - **Vite Web Preview (Browser only)**:
     ```bash
     pnpm run dev
     ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### 🏗️ Production Desktop Build & Installer

To package Apitester into a standalone Windows installer (`Apitester-Setup.exe`):

1. **Build Backend Service Binary**:
   ```powershell
   go build -ldflags="-s -w" -o deployment/desktop/build/apitester-backend.exe ./cmd/windows
   ```

2. **Build Electron Desktop Binary**:
   ```powershell
   cd frontend
   pnpm run build:electron:dist
   cd ..
   Copy-Item "frontend/release/Apitester 0.0.1.exe" -Destination "deployment/desktop/build/apitester.exe" -Force
   ```

3. **Compile Inno Setup Installer**:
   ```powershell
   & "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" deployment/desktop/setup.iss
   ```

The compiled installer will be output to `deployment/desktop/installer/Apitester-Setup.exe`. Upon installation, it places the application in `C:\Program Files\Apitester`, registers `apitester-backend.exe` as an automatic Windows Service via `sc.exe`, and creates desktop shortcuts for `apitester.exe`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- TESTING -->
## 🧪 How to Run Tests

### Backend Unit & Integration Tests

Run Go unit tests across all packages:
```bash
go test ./...
```

To run tests with verbose output:
```bash
go test -v ./...
```

### Frontend & Electron Playwright Tests

End-to-end tests for the Electron desktop GUI are managed with Playwright:

1. Navigate to `frontend`:
   ```bash
   cd frontend
   ```
2. Build the Electron application targets:
   ```bash
   pnpm run build:electron
   ```
3. Execute the Playwright test suite:
   ```bash
   pnpm test
   ```
4. Open the interactive HTML test report:
   ```bash
   pnpm run test:report
   ```
5. *(Optional)* Clear scenario cache data:
   ```bash
   pnpm run test:cache:clear
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- DOCUMENTATION FLATTENING -->
## 📄 How to Flatten Documentation

The documentation in `resource/document` can be flattened into a single consolidated Markdown file (`resource/flatten_result/document.md`) using [pyragify](https://github.com/ThomasBury/pyragify).

### 📦 Installation

Install `pyragify` globally via pip:
```bash
pip install git+https://github.com/ThomasBury/pyragify.git
# or if running on Python 3.14+:
pip install --ignore-requires-python git+https://github.com/ThomasBury/pyragify.git
```

### ▶️ How to Run

1. Run `pyragify` directly from the repository root:
   ```bash
   pyragify
   ```
   This automatically applies [`config.yaml`](./config.yaml) to process `resource/document` and output to `resource/flatten_result`.

2. Alternatively, specify manual command-line overrides:
   ```bash
   pyragify --repo-path resource/document --output-dir resource/flatten_result
   ```

The updated flattened document will be generated at `resource/flatten_result/document.md`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## 🧩 Roadmap

- [x] Multi-tab request editor with support for opening, creating, and saving requests
- [x] Folder & collection tree with drag-and-drop reordering, renaming, and CRUD operations
- [x] Pre-request & post-response script execution sandbox with code editor
- [x] Environment variable management with template substitution
- [x] Embedded local storage with BoltDB (`bbolt`)
- [x] Real-time updates with Socket.IO
- [x] Automated test scenarios & `.http` file parser runner
- [x] Automation deployment editor (Ansible playbooks & inventories)
- [x] Collection mutation history and hash auditing
- [x] Desktop packaging (Windows Service backend + Electron GUI + Inno Setup installer)
- [x] Playwright end-to-end testing pipeline
- [x] API Docs generator for Java Spring
- [ ] API Docs generator for Golang
- [ ] Agentic AI assistant integration for collection and workflow automation

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## 👨‍💻 Contributing

Contributions make the open-source community an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

You can also submit issues, feature proposals, and bug reports through [GitHub Issues](https://github.com/rdhmuhammad/apitester/issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### 🤷‍♂️ Top contributors

<a href="https://github.com/rdhmuhammad/apitester/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=rdhmuhammad/apitester" alt="contrib.rocks image" />
</a>

<!-- LICENSE -->
## 🗃 License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## ☎️ Contact

Ridho Muhammad - [medium.com/@5mblackburn7](https://medium.com/@5mblackburn7) - rdhmuhammad57@gmail.com

Project Link: [https://github.com/rdhmuhammad/apitester](https://github.com/rdhmuhammad/apitester)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/rdhmuhammad/apitester.svg?style=for-the-badge
[contributors-url]: https://github.com/rdhmuhammad/apitester/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/rdhmuhammad/apitester.svg?style=for-the-badge
[forks-url]: https://github.com/rdhmuhammad/apitester/network/members
[stars-shield]: https://img.shields.io/github/stars/rdhmuhammad/apitester.svg?style=for-the-badge
[stars-url]: https://github.com/rdhmuhammad/apitester/stargazers
[issues-shield]: https://img.shields.io/github/issues/rdhmuhammad/apitester.svg?style=for-the-badge
[issues-url]: https://github.com/rdhmuhammad/apitester/issues
[license-shield]: https://img.shields.io/badge/license-MIT-blue?style=for-the-badge
[license-url]: https://github.com/rdhmuhammad/apitester/blob/main/LICENSE
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/ridhomuhammad57

[typescript-shield]: https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white
[typescript-url]: https://www.typescriptlang.org/
[react-shield]: https://img.shields.io/badge/React_19-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB
[react-url]: https://react.dev/
[electron-shield]: https://img.shields.io/badge/Electron_35-%232B2E3A.svg?style=for-the-badge&logo=electron&logoColor=9FEAF9
[electron-url]: https://www.electronjs.org/
[vite-shield]: https://img.shields.io/badge/Vite_7-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white
[vite-url]: https://vite.dev/
[tailwind-shield]: https://img.shields.io/badge/Tailwind_CSS_v4-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white
[tailwind-url]: https://tailwindcss.com/
[redux-shield]: https://img.shields.io/badge/Redux_Toolkit-%23593d88.svg?style=for-the-badge&logo=redux&logoColor=white
[redux-url]: https://redux-toolkit.js.org/
[go-shield]: https://img.shields.io/badge/Go_1.26-%2300ADD8.svg?style=for-the-badge&logo=go&logoColor=white
[go-url]: https://go.dev/
[gin-shield]: https://img.shields.io/badge/Framework-Gin_Gonic-00ADD8?style=for-the-badge&logo=gin&logoColor=white
[gin-url]: https://gin-gonic.com/
[bbolt-shield]: https://img.shields.io/badge/DB-BoltDB-00599C?style=for-the-badge&logo=databricks&logoColor=white
[bbolt-url]: https://github.com/etcd-io/bbolt
[socketio-shield]: https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white
[socketio-url]: https://socket.io/
[playwright-shield]: https://img.shields.io/badge/Playwright-%232EAD33.svg?style=for-the-badge&logo=playwright&logoColor=white
[playwright-url]: https://playwright.dev/
