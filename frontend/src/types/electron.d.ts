interface UpdateState {
    status: "idle" | "available" | "downloading" | "installing" | "error"
    version?: string
    progress?: number
    message?: string
}

interface ElectronAPI {
    backendBaseUrl: string
    openFileDialog(): Promise<{canceled: boolean; filePaths: string[]}>
    openFolderDialog(): Promise<{canceled: boolean; filePaths: string[]}>
    minimizeWindow(): void
    maximizeWindow(): void
    closeWindow(): void
    isMaximized(): Promise<boolean>
    openExternal(targetPathOrUrl: string): Promise<string>
    showItemInFolder(targetPath: string): Promise<boolean>
    getUpdateState(): Promise<UpdateState>
    checkForUpdate(): Promise<UpdateState>
    startUpdate(): Promise<UpdateState>
    onUpdateState(callback: (state: UpdateState) => void): () => void
}

interface Window {
    electronAPI: ElectronAPI
}
