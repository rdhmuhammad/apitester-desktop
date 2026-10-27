const {contextBridge, ipcRenderer} = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
    openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
    openFolderDialog: () => ipcRenderer.invoke("open-folder-dialog"),
    minimizeWindow: () => ipcRenderer.send("window-minimize"),
    maximizeWindow: () => ipcRenderer.send("window-maximize"),
    closeWindow: () => ipcRenderer.send("window-close"),
    isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
    openExternal: (targetPathOrUrl) => ipcRenderer.invoke("open-external", targetPathOrUrl),
    showItemInFolder: (targetPath) => ipcRenderer.invoke("show-item-in-folder", targetPath),
})
