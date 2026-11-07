const {contextBridge, ipcRenderer} = require("electron")

const backendUrlArgument = process.argv.find((argument) =>
    argument.startsWith("--apitester-backend-url="),
)
const backendBaseUrl = backendUrlArgument
    ? backendUrlArgument.slice("--apitester-backend-url=".length)
    : "http://localhost:8999"

contextBridge.exposeInMainWorld("electronAPI", {
    backendBaseUrl,
    openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
    openFolderDialog: () => ipcRenderer.invoke("open-folder-dialog"),
    minimizeWindow: () => ipcRenderer.send("window-minimize"),
    maximizeWindow: () => ipcRenderer.send("window-maximize"),
    closeWindow: () => ipcRenderer.send("window-close"),
    isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
    openExternal: (targetPathOrUrl) => ipcRenderer.invoke("open-external", targetPathOrUrl),
    showItemInFolder: (targetPath) => ipcRenderer.invoke("show-item-in-folder", targetPath),
    getUpdateState: () => ipcRenderer.invoke("update-get-state"),
    checkForUpdate: () => ipcRenderer.invoke("update-check"),
    startUpdate: () => ipcRenderer.invoke("update-start"),
    onUpdateState: (callback) => {
        const listener = (_event, state) => callback(state)
        ipcRenderer.on("update-state", listener)
        return () => ipcRenderer.removeListener("update-state", listener)
    },
})
