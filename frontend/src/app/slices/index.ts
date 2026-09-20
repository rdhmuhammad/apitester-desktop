import type {CollectionItem, CollectionResponse, CollectionVar, DocsContent, Request} from "@/pages/editor/types/api.ts";
import type {ScriptLog, SendResponse} from "@/types/response.ts";

export type ColtReqMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type ColtStatusLoad = 'idle' | 'pending' | 'succeeded' | 'rejected'
export type ColtCat = 'REQ' | 'FOLD'
export type ColtBodyType= 'raw' | 'formdata'

export interface DirTree {
    id: string
    name: string
    item?: Map<string, DirTree>
    isActive: boolean
    method?: ColtReqMethod
    category: ColtCat
}

export interface EditorTab {
    id: string
    label: string
    method: ColtReqMethod | 'TEST' | 'AUTO' | 'INV'
    type: 'request' | 'test' | 'automation' | 'inventory'
}

export interface CollectionState {
    data: DocsContent | null
    variable: CollectionVar[]
    baseUrl: CollectionVar[]
    activeTabId: string
    activeEditorTab: EditorTab | null
    openRequestTabs: ActiveItem[]
    cachedRequest: CollectionItem[]
    dirTree: Map<string, DirTree>
    status: ColtStatusLoad
    dirtyRequestIds: string[]
}

export interface ActiveItem{
    id: string
    request: Request | null
    response: SendResponse | null
    exampleResponse?: CollectionResponse[]
    authType?: "none" | "inherit" | "bearer"
    scriptResult?: unknown
    scriptLogs?: ScriptLog[]
    scriptMutations?: Record<string, string | null>
}

export const initialState: CollectionState = {
    data: null,
    activeTabId: '',
    activeEditorTab: null,
    openRequestTabs: [],
    cachedRequest: [],
    variable: [],
    baseUrl: [],
    status: 'idle',
    dirTree: new Map<string, DirTree>(),
    dirtyRequestIds: [],
}
