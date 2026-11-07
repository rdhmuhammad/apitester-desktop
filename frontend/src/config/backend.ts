function getElectronBackendUrl() {
    if (typeof window === "undefined") return ""
    return window.electronAPI?.backendBaseUrl?.replace(/\/+$/, "") ?? ""
}

export function getBackendUrl() {
    const electronUrl = getElectronBackendUrl()
    if (electronUrl) return electronUrl

    const socketUrl = import.meta.env.VITE_SOCKET_URL
    if (socketUrl) return socketUrl.replace(/\/+$/, "")

    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
    return new URL(apiUrl, window.location.origin).origin
}

export function getApiUrl() {
    const electronUrl = getElectronBackendUrl()
    return electronUrl ? `${electronUrl}/api/v1` : import.meta.env.VITE_API_URL || "/api/v1"
}
