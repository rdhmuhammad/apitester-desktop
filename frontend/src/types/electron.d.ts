interface ElectronAPI {
    openFileDialog(): Promise<{canceled: boolean; filePaths: string[]}>
    openFolderDialog(): Promise<{canceled: boolean; filePaths: string[]}>
    minimizeWindow(): void
    maximizeWindow(): void
    closeWindow(): void
    isMaximized(): Promise<boolean>
    openExternal(targetPathOrUrl: string): Promise<string>
}

interface Window {
    electronAPI: ElectronAPI
}
