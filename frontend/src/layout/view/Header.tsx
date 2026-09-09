import {useEffect, useRef, useState} from "react";
import {Images} from "@/config/constant/Images.tsx";

import {useAppSelector} from "@/app/store/hooks.ts";
import {selectEditorActiveTab} from "@/app/slices/editorTabsSlice.ts";
import {useRequestEditor} from "@/layout/context/requestEditorContext.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Settings} from "lucide-react";
import type {HeaderAction} from "@/layout/types/headerContext.ts";
import Index from "@/layout/components/collectionManager";
import RequestHeader from "@/layout/components/RequestHeader.tsx";
import type {RequestHeaderHandle} from "@/layout/types/HeaderSync.ts";
import {useCollectionPushPull} from "@/layout/hooks/useCollectionPushPull.ts";
import TestScenarioEditorHeader from "@/layout/components/TestScenarioEditorHeader.tsx";
import AutomationEditorHeader from "@/layout/components/AutomationEditorHeader.tsx";
import InventoryEditorHeader from "@/layout/components/InventoryEditorHeader.tsx";

const HeaderLayout: React.FC<{ onSend: HeaderAction }> = ({onSend}) => {
    const [managerOpen, setManagerOpen] = useState(false);
    const collectionData = useRequestEditor().collection
    const activeEditorTab = useAppSelector(selectEditorActiveTab)
    const requestHeaderRef = useRef<RequestHeaderHandle>(null)
    const {pull, push, isPulling, isPushing} = useCollectionPushPull()

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const requestHeader = requestHeaderRef.current
            if (!collectionData || isPulling || isPushing) return
            if (!event.ctrlKey && !event.metaKey) return
            switch (event.key) {
                case "Enter":
                    if (!requestHeader || requestHeader.isSending) return
                    event.preventDefault()
                    requestHeader.sendRequest()
                    break
                case "s":
                    event.preventDefault()
                    push()
                    break
                case "p":
                    event.preventDefault()
                    pull()
                    break
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    })

    return (
        <header className="fixed top-0 z-50 w-full gap-4 h-[60px] bg-white border-b border-gray-200 px-6 shadow-sm
         flex flex-row items-center">
            <div className="basis-1/4 flex flex-row h-full items-center gap-3">
                <img
                    src={Images.APP_LOGO}
                    alt='Stock management'
                    className='w-[30px] h-[37px] object-cover'
                />
                <h1 className="text-xl italic font-semibold text-gray-800">
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
                    <Index open={managerOpen} onOpenChange={setManagerOpen}/>
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
