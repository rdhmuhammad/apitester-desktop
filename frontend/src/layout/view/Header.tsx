import {useAppSelector} from "@/app/store/hooks.ts";
import {selectEditorActiveTab} from "@/app/slices/editorTabsSlice.ts";
import RequestHeader from "@/layout/components/header/RequestHeader.tsx";
import TestScenarioEditorHeader from "@/layout/components/sidebar/TestScenarioEditorHeader.tsx";
import AutomationEditorHeader from "@/layout/components/header/AutomationEditorHeader.tsx";
import InventoryEditorHeader from "@/layout/components/header/InventoryEditorHeader.tsx";

const HeaderLayout: React.FC = () => {
    const activeEditorTab = useAppSelector(selectEditorActiveTab)

    return (
        <header className="fixed top-8 z-50 w-full h-[60px] bg-background border-b border-border px-6 shadow-sm
         flex flex-row items-center">
            <div className="w-full">
                {activeEditorTab?.type === 'test' ? (
                    <TestScenarioEditorHeader/>
                ) : activeEditorTab?.type === 'automation' ? (
                    <AutomationEditorHeader/>
                ) : activeEditorTab?.type === 'inventory' ? (
                    <InventoryEditorHeader/>
                ) : (
                    <RequestHeader />
                )}
            </div>
        </header>
    )
}

export default HeaderLayout
