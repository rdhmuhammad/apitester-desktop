import {SidebarProvider} from "@/components/ui/sidebar.tsx";
import SidebarLayout from "@/layout/view/SidebarLayout.tsx";
import HeaderLayout from "@/layout/view/Header.tsx";
import ShortcutLegend from "@/layout/components/ShortcutLegend.tsx";
import {createContext, useMemo, useState} from "react";
import type {HeaderAction} from "@/layout/types/headerContext.ts";

interface IMainLayout {
    children: React.ReactNode
}


const HeaderActionCtx = createContext<{
    setHeaderAction: React.Dispatch<React.SetStateAction<HeaderAction>>
} | null>(null)

const MainLayout: React.FC<IMainLayout> = ({children}: IMainLayout) => {
    const [headerAction, setHeaderAction] = useState<HeaderAction>(null)
    const ctxValue = useMemo(() => ({setHeaderAction}), [])

    return (
        <SidebarProvider>
            <HeaderActionCtx.Provider value={ctxValue}>
                <HeaderLayout onSend={headerAction}/>
                <SidebarLayout/>
                <ShortcutLegend/>
                <main className="flex-1 pt-[73px] overflow-hidden h-100dvh md:pl-64">
                    {children}
                </main>
            </HeaderActionCtx.Provider>
        </SidebarProvider>
    )
}

export default MainLayout
