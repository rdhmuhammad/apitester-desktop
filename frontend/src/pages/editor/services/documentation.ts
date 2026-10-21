import axios from "@/config/axios.ts"
import type {Response} from "@/types/response.ts"
import {socketDocumentation} from "@/pages/editor/services/mainSocket.ts"
import {SOCKET_EVENTS} from "@/config/socket.ts"

export interface DocumentTree {
    id: string
    name: string
    path: string
    category: "FOLD" | "DOC_MD" | "DOC_HTML"
    isActive: boolean
    item?: DocumentTree[]
}

export interface DocumentResponse {
    id: string
    name: string
    path: string
    content: string
    version: string
}

export interface EditDocumentContentPayload {
    id: string
    content: string
    startPos: number
    lenght: number
}

export type DocumentToolbarAction =
    | {type: "undo"}
    | {type: "redo"}
    | {type: "toggle-source"}
    | {type: "heading"; level: 0 | 1 | 2 | 3 | 4 | 5 | 6}
    | {type: "bold"}
    | {type: "italic"}
    | {type: "strikethrough"}
    | {type: "code"}
    | {type: "list"; kind?: "ul" | "ol" | "task"}
    | {type: "link"}
    | {type: "image"}
    | {type: "table"}

export interface DocumentToolbarState {
    sourceMode: boolean
    canUndo: boolean
    canRedo: boolean
    headingLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6
}

const TOOLBAR_ACTION_EVENT = "apitester:document-toolbar-action"
const TOOLBAR_STATE_EVENT = "apitester:document-toolbar-state"

export const dispatchDocumentToolbarAction = (action: DocumentToolbarAction) => {
    window.dispatchEvent(new CustomEvent<DocumentToolbarAction>(TOOLBAR_ACTION_EVENT, {detail: action}))
}

export const onDocumentToolbarAction = (handler: (action: DocumentToolbarAction) => void): (() => void) => {
    const listener = (event: Event) => {
        const custom = event as CustomEvent<DocumentToolbarAction>
        if (custom.detail) {
            handler(custom.detail)
        }
    }
    window.addEventListener(TOOLBAR_ACTION_EVENT, listener)
    return () => window.removeEventListener(TOOLBAR_ACTION_EVENT, listener)
}

export const dispatchDocumentToolbarState = (state: DocumentToolbarState) => {
    window.dispatchEvent(new CustomEvent<DocumentToolbarState>(TOOLBAR_STATE_EVENT, {detail: state}))
}

export const onDocumentToolbarState = (handler: (state: DocumentToolbarState) => void): (() => void) => {
    const listener = (event: Event) => {
        const custom = event as CustomEvent<DocumentToolbarState>
        if (custom.detail) {
            handler(custom.detail)
        }
    }
    window.addEventListener(TOOLBAR_STATE_EVENT, listener)
    return () => window.removeEventListener(TOOLBAR_STATE_EVENT, listener)
}

export const computeDocumentDiff = (
    prev: string,
    next: string,
): {content: string; startPos: number; lenght: number} => {
    let startPos = 0
    const minLen = Math.min(prev.length, next.length)
    while (startPos < minLen && prev.charCodeAt(startPos) === next.charCodeAt(startPos)) {
        startPos++
    }

    let suffixLen = 0
    const maxSuffix = minLen - startPos
    while (
        suffixLen < maxSuffix &&
        prev.charCodeAt(prev.length - 1 - suffixLen) === next.charCodeAt(next.length - 1 - suffixLen)
    ) {
        suffixLen++
    }

    return {
        content: next.slice(startPos, next.length - suffixLen),
        startPos,
        lenght: prev.length - startPos - suffixLen,
    }
}

export const documentTreeQueryKey = ["documentation", "tree"] as const
export const documentContentQueryKey = (id: string) => ["documentation", "content", id] as const

export const DocumentationServices = {
    getTree: async (): Promise<DocumentTree[]> => {
        const response = await axios.get<Response<DocumentTree[]>>("/documentation/tree")
        return response.data.data ?? []
    },

    getContent: async (id: string): Promise<DocumentResponse> => {
        const response = await axios.get<Response<DocumentResponse>>("/documentation/content", {
            params: {id},
        })
        return response.data.data
    },

    createDocument: async (name?: string, parentId?: string): Promise<DocumentResponse> => {
        const response = await axios.post<Response<DocumentResponse>>("/documentation/create", {
            name: name ?? "",
            parentId: parentId ?? "",
        })
        return response.data.data
    },

    createFolder: async (name: string, parentId?: string): Promise<DocumentTree> => {
        const response = await axios.post<Response<DocumentTree>>("/documentation/folder", {
            name,
            parentId: parentId ?? "",
        })
        return response.data.data
    },

    renameDocument: async (id: string, name: string): Promise<DocumentResponse> => {
        const response = await axios.put<Response<DocumentResponse>>("/documentation/rename", {
            id,
            name,
        })
        return response.data.data
    },

    moveDocument: async (id: string, targetFolderId: string): Promise<DocumentResponse> => {
        const response = await axios.put<Response<DocumentResponse>>("/documentation/move", {
            id,
            targetFolderId,
        })
        return response.data.data
    },

    deleteItem: async (id: string): Promise<string> => {
        const response = await axios.delete<Response<null>>("/documentation", {
            params: {id},
        })
        return response.data.message
    },

    emitContentEdit: (payload: EditDocumentContentPayload): void => {
        if (socketDocumentation.disconnected) {
            socketDocumentation.connect()
        }
        socketDocumentation.emit(SOCKET_EVENTS.documentContentEdit, payload)
    },

    onDocumentRefresh: (callback: (refresh: boolean) => void): (() => void) => {
        const handler = (payload: boolean | {refresh?: boolean}) => {
            const shouldRefresh = typeof payload === "boolean" ? payload : Boolean(payload?.refresh)
            if (shouldRefresh) {
                callback(true)
            }
        }
        socketDocumentation.on(SOCKET_EVENTS.documentRefresh, handler)
        return () => {
            socketDocumentation.off(SOCKET_EVENTS.documentRefresh, handler)
        }
    },
}
