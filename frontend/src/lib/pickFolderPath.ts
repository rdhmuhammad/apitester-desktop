/** Opens the native Electron folder picker. Returns null when cancelled or outside Electron. */
export async function pickFolderPath(): Promise<string | null> {
    if (!window.electronAPI?.openFolderDialog) return null
    const result = await window.electronAPI.openFolderDialog()
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
}
