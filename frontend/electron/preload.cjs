const {contextBridge, ipcRenderer} = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
    openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
    minimizeWindow: () => ipcRenderer.send("window-minimize"),
    maximizeWindow: () => ipcRenderer.send("window-maximize"),
    closeWindow: () => ipcRenderer.send("window-close"),
    isMaximized: () => ipcRenderer.invoke("window-is-maximized"),
})
