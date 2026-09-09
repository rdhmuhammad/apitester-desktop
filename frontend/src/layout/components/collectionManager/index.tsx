import {useState} from "react";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {cn} from "@/lib/utils.ts";
import {Braces, Folder, Globe} from "lucide-react";
import VariableManage from "@/layout/components/collectionManager/VariableManage.tsx";
import CollectionManage from "@/layout/components/collectionManager/CollectionManage.tsx";
import ScriptManage from "@/layout/components/collectionManager/ScriptManage.tsx";

interface CollectionManagerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

const Index: React.FC<CollectionManagerDialogProps> = ({open, onOpenChange}) => {
    const [isScriptExpanded, setIsScriptExpanded] = useState(false)

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent
                className={cn("flex flex-col h-[80vh] pt-6 pb-4 px-4 transition-[max-width] duration-300 ease-in-out", isScriptExpanded ? "max-w-5xl" : "max-w-3xl")}>
                {!isScriptExpanded && (
                    <AlertDialogHeader className="shrink-0 mb-3">
                        <AlertDialogTitle>Collection Manager</AlertDialogTitle>
                        <AlertDialogDescription>
                            Manage your local collection files and environment variables.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                )}

                <Tabs orientation="vertical" defaultValue="collection" className="flex-row gap-0 flex-1 min-h-0">
                    {!isScriptExpanded && (
                        <TabsList className="flex-col h-full w-12 shrink-0 rounded-lg">
                            <TabsTrigger value="environment"><Globe className="h-4 w-4 m-0"/></TabsTrigger>
                            <TabsTrigger value="collection"><Folder className="h-4 w-4 m-0"/></TabsTrigger>
                            <TabsTrigger value="scripts"><Braces className="h-4 w-4 m-0"/></TabsTrigger>
                        </TabsList>
                    )}

                    <div className={cn("flex-1 min-w-0", !isScriptExpanded && "pl-4")}>
                        {!isScriptExpanded && (
                            <TabsContent value="collection" className="flex flex-col h-full min-h-0">
                                <CollectionManage onOpenChange={onOpenChange}/>
                            </TabsContent>
                        )}
                        {!isScriptExpanded && (
                            <TabsContent value="environment" className="flex flex-col h-full min-h-0">
                                <VariableManage />
                            </TabsContent>
                        )}
                        <TabsContent value="scripts" className="flex flex-col h-full min-h-0">
                            <ScriptManage
                                isExpanded={isScriptExpanded}
                                onExpand={() => setIsScriptExpanded(true)}
                                onCollapse={() => setIsScriptExpanded(false)}
                            />
                        </TabsContent>
                    </div>
                </Tabs>

                <AlertDialogFooter className="shrink-0 mt-3">
                    <AlertDialogCancel>Close</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

export default Index
