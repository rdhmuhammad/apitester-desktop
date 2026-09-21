import {app, BrowserWindow, dialog, ipcMain, Menu, session} from "electron"
import path from "path"
import {fileURLToPath} from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = process.env.NODE_ENV === "development" || !app.isPackaged

// Disable web security and CORS restrictions for API testing
app.commandLine.appendSwitch("disable-web-security")
app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors")
app.commandLine.appendSwitch("allow-insecure-localhost", "true")
app.commandLine.appendSwitch("ignore-certificate-errors", "true")

let mainWindow: BrowserWindow | null = null

function createWindow() {
    if (!isDev) {
        Menu.setApplicationMenu(null)
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1000,
        minHeight: 700,
        frame: false,
        icon: isDev
            ? path.join(__dirname, "../public/app.ico")
            : path.join(__dirname, "../dist/app.ico"),
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false,
            allowRunningInsecureContent: true,
        },
    })

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173")
        mainWindow.webContents.once("dom-ready", () => {
            mainWindow?.webContents.openDevTools();
        });
    } else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
    }

    mainWindow.on("closed", () => {
        mainWindow = null
    })
}

ipcMain.handle("open-file-dialog", async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
        properties: ["openFile"],
        filters: [{name: "JSON", extensions: ["json"]}],
    })
    return result
})

ipcMain.on("window-minimize", () => {
    mainWindow?.minimize()
})

ipcMain.on("window-maximize", () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
    } else {
        mainWindow?.maximize()
    }
})

ipcMain.on("window-close", () => {
    mainWindow?.close()
})

ipcMain.handle("window-is-maximized", () => {
    return mainWindow?.isMaximized() ?? false
})

app.whenReady().then(async () => {
    // Intercept all HTTP/HTTPS responses to inject permissive CORS headers
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = { ...(details.responseHeaders || {}) }

        // Remove any existing restrictive CORS headers
        for (const key of Object.keys(responseHeaders)) {
            if (/^access-control-/i.test(key)) {
                delete responseHeaders[key]
            }
        }

        responseHeaders["Access-Control-Allow-Origin"] = ["*"]
        responseHeaders["Access-Control-Allow-Headers"] = ["*"]
        responseHeaders["Access-Control-Allow-Methods"] = [
            "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
        ]
        responseHeaders["Access-Control-Allow-Credentials"] = ["true"]
        responseHeaders["Access-Control-Expose-Headers"] = ["*"]

        callback({ responseHeaders })
    })

    // Remove origin header for external requests so remote servers don't reject preflight
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const requestHeaders = { ...(details.requestHeaders || {}) }
        if (details.url && !details.url.startsWith("http://localhost:5173") && !details.url.startsWith("file://")) {
            delete requestHeaders["Origin"]
            delete requestHeaders["origin"]
        }
        callback({ requestHeaders })
    })

    createWindow()
})

app.on("certificate-error", (event, webContents, url, error, certificate, callback) => {
    // Bypass self-signed SSL certificate errors when testing local or development APIs
    event.preventDefault()
    callback(true)
})

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit()
    }
})

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow()
    }
})
