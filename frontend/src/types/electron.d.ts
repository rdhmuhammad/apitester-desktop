interface ElectronAPI {
    openFileDialog(): Promise<{canceled: boolean; filePaths: string[]}>
    minimizeWindow(): void
    maximizeWindow(): void
    closeWindow(): void
    isMaximized(): Promise<boolean>
}

interface Window {
    electronAPI: ElectronAPI
}
