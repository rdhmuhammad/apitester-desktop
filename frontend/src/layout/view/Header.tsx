import {useEffect, useRef, useState} from "react";
import {Images} from "@/config/constant/Images.tsx";

import {useAppSelector} from "@/app/store/hooks.ts";
import {selectEditorActiveTab} from "@/app/slices/editorTabsSlice.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import {Button} from "@/components/ui/button.tsx";
import {LoaderCircle, Moon, Settings, Sun, TriangleAlert, Wifi, WifiOff} from "lucide-react";
import type {HeaderAction} from "@/layout/types/headerContext.ts";
import CollectionManager from "@/layout/components/collectionManager";
import RequestHeader from "@/layout/components/RequestHeader.tsx";
import type {RequestHeaderHandle} from "@/layout/types/HeaderSync.ts";
import {useSocket} from "@/hooks/useSocket.ts";
import {SOCKET_NAMESPACES} from "@/config/socket.ts";
import TestScenarioEditorHeader from "@/layout/components/TestScenarioEditorHeader.tsx";
import AutomationEditorHeader from "@/layout/components/AutomationEditorHeader.tsx";
import InventoryEditorHeader from "@/layout/components/InventoryEditorHeader.tsx";
import {useTheme} from "@/hooks/useTheme.ts";

const HeaderLayout: React.FC<{ onSend: HeaderAction }> = ({onSend}) => {
    const [managerOpen, setManagerOpen] = useState(false);
    const {activeCollection: collectionData} = useCollection()
    const activeEditorTab = useAppSelector(selectEditorActiveTab)
    const requestHeaderRef = useRef<RequestHeaderHandle>(null)
    const {status: socketStatus} = useSocket(SOCKET_NAMESPACES.collection)
    const {theme, setTheme} = useTheme()

    const socketIndicator = {
        connecting: {label: "Connecting", icon: LoaderCircle, className: "text-amber-500 animate-spin"},
        connected: {label: "Connected", icon: Wifi, className: "text-emerald-500"},
        disconnected: {label: "Disconnected", icon: WifiOff, className: "text-slate-400"},
        error: {label: "Connection error", icon: TriangleAlert, className: "text-rose-500"},
    }[socketStatus]
    const SocketIcon = socketIndicator.icon

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const requestHeader = requestHeaderRef.current
            if (!collectionData) return
            if (!event.ctrlKey && !event.metaKey) return
            switch (event.key) {
                case "Enter":
                    if (!requestHeader || requestHeader.isSending) return
                    event.preventDefault()
                    requestHeader.sendRequest()
                    break
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    })

    return (
        <header className="fixed top-0 z-50 w-full gap-4 h-[60px] bg-background border-b border-border px-6 shadow-sm
         flex flex-row items-center">
            <div className="basis-1/4 flex flex-row h-full items-center gap-3">
                <img
                    src={Images.APP_LOGO}
                    alt='Stock management'
                    className='w-[30px] h-[37px] object-cover'
                />
                <h1 className="text-xl italic font-semibold text-foreground">
                    Apitester
                </h1>
                <div className="flex items-center h-full gap-2 ml-4">
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => setManagerOpen(true)}
                    >
                        <Settings className="h-4 w-4"/>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0"
                        title={`Socket: ${socketIndicator.label}`}
                        aria-label={`Socket ${socketIndicator.label.toLowerCase()}`}
                    >
                        <SocketIcon className={`h-4 w-4 ${socketIndicator.className}`} />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0"
                        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    >
                        {theme === "dark" ? (
                            <Sun className="h-4 w-4" />
                        ) : (
                            <Moon className="h-4 w-4" />
                        )}
                    </Button>
                    <CollectionManager open={managerOpen} onOpenChange={setManagerOpen}/>
                </div>
            </div>
            {activeEditorTab?.type === 'test' ? (
                <TestScenarioEditorHeader/>
            ) : activeEditorTab?.type === 'automation' ? (
                <AutomationEditorHeader/>
            ) : activeEditorTab?.type === 'inventory' ? (
                <InventoryEditorHeader/>
            ) : (
                <RequestHeader ref={requestHeaderRef} onSend={onSend}/>
            )}
        </header>
    )
}

export default HeaderLayout
