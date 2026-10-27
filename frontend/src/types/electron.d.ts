interface ElectronAPI {
    openFileDialog(): Promise<{canceled: boolean; filePaths: string[]}>
    openFolderDialog(): Promise<{canceled: boolean; filePaths: string[]}>
    minimizeWindow(): void
    maximizeWindow(): void
    closeWindow(): void
    isMaximized(): Promise<boolean>
    openExternal(targetPathOrUrl: string): Promise<string>
    showItemInFolder(targetPath: string): Promise<boolean>
}

interface Window {
    electronAPI: ElectronAPI
}
