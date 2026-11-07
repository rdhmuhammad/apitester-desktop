import {app, shell, type BrowserWindow} from "electron"
import {createHash} from "node:crypto"
import {mkdir, open, rename, rm} from "node:fs/promises"
import path from "node:path"
import {findInstaller, type Asset, type Release} from "./release.js"

const releaseUrl = "https://api.github.com/repos/rdhmuhammad/apitester-desktop/releases/latest"
type UpdateState = {status: "idle" | "available" | "downloading" | "installing" | "error"; version?: string; progress?: number; message?: string}

let state: UpdateState = {status: "idle"}
let selectedAsset: Asset | null = null
let downloadInProgress = false
let window: BrowserWindow | null = null

function setState(next: UpdateState) {
    state = next
    window?.webContents.send("update-state", state)
}

export function getUpdateState(): UpdateState {
    return state
}

export async function checkForUpdate() {
    if (!app.isPackaged || process.platform !== "win32" || downloadInProgress) return state
    const previousStatus = state.status
    try {
        const response = await fetch(releaseUrl, {
            headers: {Accept: "application/vnd.github+json", "User-Agent": `Apitester/${app.getVersion()}`},
            signal: AbortSignal.timeout(12000),
        })
        if (response.status === 404) {
            selectedAsset = null
            setState({status: "idle"})
            return state
        }
        if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
        const release = await response.json() as Release
        const installer = findInstaller(release, app.getVersion())
        if (!installer) {
            selectedAsset = null
            setState({status: "idle"})
            return state
        }
        selectedAsset = installer.asset
        setState({status: "available", version: installer.version})
    } catch (error) {
        selectedAsset = null
        // A background lookup must not interrupt normal use of the app.
        setState(previousStatus === "error"
            ? {status: "error", message: error instanceof Error ? error.message : "Update check failed"}
            : {status: "idle"})
    }
    return state
}

async function downloadInstaller(asset: Asset, version: string): Promise<string> {
    const directory = path.join(app.getPath("temp"), "apitester-updates")
    await mkdir(directory, {recursive: true})
    const finalPath = path.join(directory, asset.name)
    const partialPath = `${finalPath}.part`
    await rm(partialPath, {force: true})
    try {
        const response = await fetch(asset.browser_download_url, {signal: AbortSignal.timeout(10 * 60 * 1000)})
        if (!response.ok || !response.body) throw new Error(`Download failed (${response.status})`)
        const hash = createHash("sha256")
        const file = await open(partialPath, "wx")
        let bytes = 0
        try {
            for await (const chunk of response.body) {
                bytes += chunk.length
                if (bytes > asset.size) throw new Error("Installer size mismatch")
                hash.update(chunk)
                let offset = 0
                while (offset < chunk.length) {
                    const {bytesWritten} = await file.write(chunk, offset, chunk.length - offset)
                    if (bytesWritten === 0) throw new Error("Installer write failed")
                    offset += bytesWritten
                }
                setState({status: "downloading", version, progress: Math.floor(bytes * 100 / asset.size)})
            }
        } finally {
            await file.close()
        }
        if (bytes !== asset.size || hash.digest("hex").toLowerCase() !== asset.digest.slice(7).toLowerCase()) {
            throw new Error("Installer verification failed")
        }
        await rm(finalPath, {force: true})
        await rename(partialPath, finalPath)
        return finalPath
    } catch (error) {
        await rm(partialPath, {force: true})
        throw error
    }
}

export async function startUpdate() {
    if (downloadInProgress || state.status !== "available" || !selectedAsset || !state.version) return state
    downloadInProgress = true
    const asset = selectedAsset
    const version = state.version
    setState({status: "downloading", version, progress: 0})
    try {
        const installerPath = await downloadInstaller(asset, version)
        // The installer is outside Program Files so Inno can replace the running app.
        const launchError = await shell.openPath(installerPath)
        if (launchError) throw new Error(launchError)
        setState({status: "installing", version})
        app.quit()
    } catch (error) {
        setState({status: "error", version, message: error instanceof Error ? error.message : "Update failed"})
    } finally {
        downloadInProgress = false
    }
    return state
}

export function initializeUpdater(mainWindow: BrowserWindow) {
    window = mainWindow
    mainWindow.on("closed", () => { window = null })
    if (app.isPackaged && process.platform === "win32") void checkForUpdate()
}
