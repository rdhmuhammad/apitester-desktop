// Component imports
import RequestConfigTabs from "@/pages/editor/components/RequestConfig";
import ResponseView from "@/pages/editor/components/RequestConfig/ResponseView.tsx";
import WelcomeEditor from "@/pages/editor/components/WelcomeEditor.tsx";
import TestScenarioEditor from "@/pages/editor/components/TestScenarioEditor.tsx";
import AutomationEditor from "@/pages/editor/components/AutomationEditor.tsx";
import InventoryEditor from "@/pages/editor/components/InventoryEditor.tsx";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {Button} from "@/components/ui/button.tsx";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";

// React & Utils Imports
import {useCallback, useRef, useState} from "react";
import {cn} from "@/lib/utils.ts";
import {FileCode2, FileText, Plus, Wrench, XIcon} from "lucide-react";


// Store Imports
import {useAppDispatch, useAppSelector} from "@/app/store/hooks.ts";
import type {ColtReqMethod, EditorTab} from "@/pages/editor/types/editor.ts";
import {
    openEditorTab,
    removeEditorTab,
    renameEditorTab,
    selectCollectionId,
    selectEditorActiveTabId,
    selectEditorTabs,
    setEditorActiveTab,
} from "@/app/slices/editorTabsSlice.ts";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import {
    requestConfigQueryKey,
    RequestConfigServices,
} from "@/pages/editor/services/requestConfig.ts";
import {useQueryClient} from "@tanstack/react-query";
import CustomToast from "@/components/common/toast";
import {useRequestConfig} from "@/pages/editor/hooks/useRequestConfig.ts";

const methodStyle: Record<ColtReqMethod | 'TEST' | 'AUTO' | 'INV', string> = {
    GET: "bg-emerald-100 text-emerald-700",
    POST: "bg-amber-100 text-amber-700",
    PUT: "bg-blue-100 text-blue-700",
    PATCH: "bg-violet-100 text-violet-700",
    DELETE: "bg-rose-100 text-rose-700",
    TEST: "bg-indigo-100 text-indigo-700",
    AUTO: "bg-violet-100 text-violet-700",
    INV: "bg-amber-100 text-amber-700",
};

const Editor: React.FC = () => {
    const dispatch = useAppDispatch()
    const queryClient = useQueryClient()
    const allTabs = useAppSelector(selectEditorTabs)
    const effectiveActiveTabId = useAppSelector(selectEditorActiveTabId)
    const collectionId = useAppSelector(selectCollectionId)
    const {activeCollection} = useCollection(collectionId)


    const activeTab = allTabs.find(t => t.id === effectiveActiveTabId)
   
    const [editingTabId, setEditingTabId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState('')
    const [isCreatingRequest, setIsCreatingRequest] = useState(false)
    const editInputRef = useRef<HTMLInputElement | null>(null)
    const editingTab = allTabs.find(tab => tab.id === editingTabId)
    const editingRequestId = editingTab?.type === 'request' ? editingTab.id : ''
    const {updateName} = useRequestConfig(collectionId ?? '', editingRequestId)

    const handleCreateRequest = useCallback(async () => {
        if (!collectionId || isCreatingRequest) return

        setIsCreatingRequest(true)
        try {
            const request = await RequestConfigServices.create(collectionId)
            queryClient.setQueryData(requestConfigQueryKey(collectionId, request.id), request)
            dispatch(openEditorTab({
                id: request.id,
                label: request.name || 'New Request',
                method: (request.method || 'GET') as ColtReqMethod,
                type: 'request',
            }))
            await queryClient.invalidateQueries({queryKey: ["collection", "tree", collectionId]})
            CustomToast.success("Request created")
        } catch (error) {
            CustomToast.error(error instanceof Error ? error.message : "Failed to create request")
        } finally {
            setIsCreatingRequest(false)
        }
    }, [collectionId, dispatch, isCreatingRequest, queryClient])

    const startEditing = useCallback((tab: EditorTab) => {
        if (tab.type !== 'request') return
        setEditingTabId(tab.id)
        setEditValue(tab.label)
        setTimeout(() => editInputRef.current?.select(), 0)
    }, [])

    const commitEdit = useCallback(() => {
        const name = editValue.trim()
        const tab = allTabs.find(tab => tab.id === editingTabId)
        if (tab?.type === 'request' && name && name !== tab.label) {
            void updateName(name).then((request) => {
                if (!request) return
                dispatch(renameEditorTab({id: tab.id, label: request.name}))
                if (collectionId) {
                    void queryClient.invalidateQueries({queryKey: ["collection", "tree", collectionId]})
                }
            })
        }
        setEditingTabId(null)
        setEditValue('')
    }, [allTabs, collectionId, dispatch, editingTabId, editValue, queryClient, updateName])

    const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            commitEdit()
        } else if (e.key === 'Escape') {
            setEditingTabId(null)
            setEditValue('')
        }
    }, [commitEdit])

    const handleTabChange = (id: string) => {
        if (!id) return
        dispatch(setEditorActiveTab(id))
    }

    const handleRemoveTab = (tab: EditorTab) => {
        dispatch(removeEditorTab(tab.id))
    }

    return (
        <div className="h-full overflow-auto bg-[linear-gradient(180deg,#eef4ff_0%,#f8fafc_22%,#f8fafc_100%)] dark:bg-[linear-gradient(180deg,#0b1120_0%,#090d16_22%,#020617_100%)]">
            <div className={cn(
                'fixed top-[60px] right-0 left-0 z-40 border-b border-slate-200/80 dark:border-border',
                ' bg-white/80 dark:bg-background/80 backdrop-blur md:left-64')
            }>
                <div className="mx-auto flex w-full max-w-[1500px] flex-col px-4 pt-4 gap-4">
                    <div className="group h-24 max-h-24 overflow-hidden pb-4 hover:h-auto hover:max-h-none hover:overflow-visible">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                            Workspace
                        </p>
                        <h3 className="mt-1 text-3xl font-semibold text-slate-900 dark:text-foreground">{activeCollection ? activeCollection.name : 'Collection'}</h3>
                        <p className="mt-1 line-clamp-2 text-sm font-normal text-slate-500 group-hover:line-clamp-none">
                            {activeCollection?.description ?? ''}
                        </p>
                    </div>

                    <Tabs value={effectiveActiveTabId} onValueChange={handleTabChange} className="gap-0">
                        <div className="flex items-end justify-between gap-3">
                            <TabsList
                                className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-slate-200 dark:border-border bg-transparent p-0">
                                {allTabs.map((tab) => (
                                    <TabsTrigger
                                        key={tab.id}
                                        value={tab.id}
                                        className="group relative h-11 flex-none rounded-none border border-transparent border-b-0 bg-transparent px-3 text-slate-500 shadow-none transition-all hover:bg-white dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 data-[state=active]:border-slate-200 dark:data-[state=active]:border-border data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:text-slate-900 dark:data-[state=active]:text-foreground data-[state=active]:shadow-[0_-1px_0_0_rgba(255,255,255,1),0_6px_18px_-14px_rgba(15,23,42,0.45)] dark:data-[state=active]:shadow-none"
                                    >
                                        <span
                                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-[0.16em] ${methodStyle[tab.method]}`}>
                                            {tab.method}
                                        </span>
                                        {editingTabId === tab.id ? (
                                            <input
                                                ref={editInputRef}
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={commitEdit}
                                                onKeyDown={handleEditKeyDown}
                                                className="h-6 w-[120px] rounded border border-indigo-300 dark:border-indigo-700 bg-background px-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-indigo-400"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span
                                                className="max-w-[140px] truncate text-sm font-medium"
                                                onDoubleClick={() => startEditing(tab)}
                                                title="Double-click to rename"
                                            >
                                                {tab.label}
                                            </span>
                                        )}
                                        <span
                                            className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 group-data-[state=active]:text-slate-500 dark:group-data-[state=active]:text-slate-400">
                                            <Button variant='ghost'
                                                    onClick={(event) => {
                                                        event.preventDefault()
                                                        event.stopPropagation()
                                                        handleRemoveTab(tab)
                                                    }}
                                            >
                                                <XIcon
                                                    size={12}
                                                />
                                            </Button>
                                        </span>
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="mb-1 h-9 shrink-0 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 px-3 text-slate-600 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-white dark:hover:bg-slate-800"
                                    >
                                        <Plus className="mr-1 h-4 w-4"/>
                                        New Tab
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem
                                        disabled={!collectionId || isCreatingRequest}
                                        onClick={() => void handleCreateRequest()}
                                    >
                                        <FileCode2 className="mr-2 h-4 w-4 text-emerald-600"/>
                                        {isCreatingRequest ? 'Creating Request...' : 'New Request'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem >
                                        <FileText className="mr-2 h-4 w-4 text-indigo-600"/>
                                        Create Test Suite
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => {
                                        }}
                                    >
                                        <Wrench className="mr-2 h-4 w-4 text-violet-600"/>
                                        New Automation
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </Tabs>
                </div>
            </div>

            <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col px-4 pb-4 pt-[160px]">
                {!activeTab ? (
                    <div
                        className={cn('rounded-2xl border border-t-0 border-border',
                            ' bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] dark:shadow-none')
                        }>
                        <WelcomeEditor/>
                    </div>
                ) : activeTab.type === 'test' ? (
                    <div
                        className={cn('rounded-2xl border border-t-0 border-border',
                            ' bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] dark:shadow-none')
                        }>
                        <TestScenarioEditor/>
                    </div>
                ) : activeTab.type === 'automation' ? (
                    <div
                        className={cn('rounded-2xl border border-t-0 border-border',
                            ' bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] dark:shadow-none')
                        }>
                        <AutomationEditor/>
                    </div>
                ) : activeTab.type === 'inventory' ? (
                    <div
                        className={cn('rounded-2xl border border-t-0 border-border',
                            ' bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] dark:shadow-none')
                        }>
                        <InventoryEditor/>
                    </div>
                ) : (
                    <div
                        className={cn('rounded-b-2xl rounded-tr-2xl border border-t-0 border-border',
                            ' bg-card shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] dark:shadow-none')
                        }>
                        <RequestConfigTabs/>
                        <div className="pt-3">
                            <ResponseView/>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Editor;
