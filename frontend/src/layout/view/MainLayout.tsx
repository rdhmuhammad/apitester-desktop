import {SidebarProvider} from "@/components/ui/sidebar.tsx";
import SidebarLayout from "@/layout/view/SidebarLayout.tsx";
import HeaderLayout from "@/layout/view/Header.tsx";
import TitleBar from "../components/header/TitleBar";
import ShortcutLegend from "@/layout/components/sidebar/ShortcutLegend.tsx";

interface IMainLayout {
    children: React.ReactNode
}

const MainLayout: React.FC<IMainLayout> = ({children}: IMainLayout) => {
    return (
        <SidebarProvider>
            <TitleBar/>
            <HeaderLayout/>
            <SidebarLayout/>
            <ShortcutLegend/>
            <main className="flex-1 pt-[76px] overflow-hidden h-100dvh md:pl-64">
                {children}
            </main>
        </SidebarProvider>
    )
}

export default MainLayout
