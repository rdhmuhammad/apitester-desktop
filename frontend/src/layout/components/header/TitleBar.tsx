import {useEffect, useState} from "react"
import {Images} from "@/config/constant/Images.tsx"
import {Button} from "@/components/ui/button.tsx"
import {LoaderCircle, Maximize2, Minimize2, Minus, Moon, Settings, Sun, TriangleAlert, Wifi, WifiOff, X} from "lucide-react"
import CollectionManager from "@/layout/components/collectionManager"
import {useSocket} from "@/hooks/useSocket.ts"
import {SOCKET_NAMESPACES} from "@/config/socket.ts"
import {useTheme} from "@/hooks/useTheme.ts"

const TitleBar: React.FC = () => {
    const [managerOpen, setManagerOpen] = useState(false)
    const [isMaximized, setIsMaximized] = useState(false)
    const {status: socketStatus} = useSocket(SOCKET_NAMESPACES.collection)
    const {theme, setTheme} = useTheme()

    // Sync maximized state on mount and when the window changes
    useEffect(() => {
        const api = window.electronAPI
        if (!api?.isMaximized) return

        api.isMaximized().then(setIsMaximized)

        // Re-check whenever focus returns (covers restore/maximize from taskbar)
        const onFocus = () => api.isMaximized().then(setIsMaximized)
        window.addEventListener("focus", onFocus)
        return () => window.removeEventListener("focus", onFocus)
    }, [])

    const socketIndicator = {
        connecting: {label: "Connecting", icon: LoaderCircle, className: "text-amber-500 animate-spin"},
        connected: {label: "Connected", icon: Wifi, className: "text-emerald-500"},
        disconnected: {label: "Disconnected", icon: WifiOff, className: "text-slate-400"},
        error: {label: "Connection error", icon: TriangleAlert, className: "text-rose-500"},
    }[socketStatus]
    const SocketIcon = socketIndicator.icon

    const handleMinimize = () => window.electronAPI?.minimizeWindow()
    const handleMaximize = () => {
        window.electronAPI?.maximizeWindow()
        setIsMaximized(prev => !prev)
    }
    const handleClose = () => window.electronAPI?.closeWindow()

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] h-8 bg-background border-b border-border flex items-center select-none">
            {/* Left: App identity + controls — no-drag so buttons remain clickable */}
            <div className="no-drag flex items-center gap-1.5 px-3 h-full shrink-0">
                <img
                    src={Images.APP_LOGO}
                    alt="Apitester"
                    className="w-[18px] h-[22px] object-cover"
                />
                <span className="text-sm italic font-semibold text-foreground mr-2">
                    Apitester
                </span>

                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title="Collection manager"
                    onClick={() => setManagerOpen(true)}
                >
                    <Settings className="h-3.5 w-3.5"/>
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title={`Socket: ${socketIndicator.label}`}
                    aria-label={`Socket ${socketIndicator.label.toLowerCase()}`}
                >
                    <SocketIcon className={`h-3.5 w-3.5 ${socketIndicator.className}`}/>
                </Button>

                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                    {theme === "dark" ? (
                        <Sun className="h-3.5 w-3.5"/>
                    ) : (
                        <Moon className="h-3.5 w-3.5"/>
                    )}
                </Button>

                <CollectionManager open={managerOpen} onOpenChange={setManagerOpen}/>
            </div>

            {/* Center: drag region fills remaining space */}
            <div className="drag-region flex-1 h-full"/>

            {/* Right: window control buttons — no-drag */}
            <div className="no-drag flex items-center h-full shrink-0">
                <button
                    onClick={handleMinimize}
                    className="h-8 w-11 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Minimize"
                >
                    <Minus className="h-3.5 w-3.5"/>
                </button>
                <button
                    onClick={handleMaximize}
                    className="h-8 w-11 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label={isMaximized ? "Restore" : "Maximize"}
                >
                    {isMaximized ? (
                        <Minimize2 className="h-3 w-3"/>
                    ) : (
                        <Maximize2 className="h-3 w-3"/>
                    )}
                </button>
                <button
                    onClick={handleClose}
                    className="h-8 w-11 flex items-center justify-center text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
                    aria-label="Close"
                >
                    <X className="h-3.5 w-3.5"/>
                </button>
            </div>
        </div>
    )
}

export default TitleBar
