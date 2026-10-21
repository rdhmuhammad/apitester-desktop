import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {
    documentContentQueryKey,
    documentTreeQueryKey,
    DocumentationServices,
    type DocumentResponse,
    type DocumentTree,
} from "@/pages/editor/services/documentation.ts"
import CustomToast from "@/components/common/toast"
import type {AxiosError} from "axios"
import type {Response} from "@/types/response.ts"

const EMPTY_DOC_TREE: DocumentTree[] = []

export const useDocumentContent = (docId: string) =>
    useQuery<DocumentResponse>({
        queryKey: documentContentQueryKey(docId),
        queryFn: () => DocumentationServices.getContent(docId),
        enabled: Boolean(docId),
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

export const useDocumentation = (docId: string | null = null, enabledTree = true) => {
    const queryClient = useQueryClient()

    const treeQuery = useQuery<DocumentTree[]>({
        queryKey: documentTreeQueryKey,
        queryFn: DocumentationServices.getTree,
        enabled: enabledTree,
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const contentQuery = useQuery<DocumentResponse>({
        queryKey: documentContentQueryKey(docId ?? ""),
        queryFn: () => DocumentationServices.getContent(docId ?? ""),
        enabled: Boolean(docId),
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const createDocumentMutation = useMutation({
        mutationFn: (payload?: {name?: string; parentId?: string}) =>
            DocumentationServices.createDocument(payload?.name, payload?.parentId),
        onSuccess: async (created) => {
            queryClient.setQueryData(documentContentQueryKey(created.id), created)
            await queryClient.invalidateQueries({queryKey: documentTreeQueryKey})
            CustomToast.success("Document created")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data?.message || "Failed to create document")
        },
    })

    const createFolderMutation = useMutation({
        mutationFn: (payload: {name: string; parentId?: string}) =>
            DocumentationServices.createFolder(payload.name, payload.parentId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: documentTreeQueryKey})
            CustomToast.success("Folder created")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data?.message || "Failed to create folder")
        },
    })

    const renameDocumentMutation = useMutation({
        mutationFn: (payload: {id: string; name: string}) =>
            DocumentationServices.renameDocument(payload.id, payload.name),
        onSuccess: async (updated, variables) => {
            queryClient.removeQueries({queryKey: documentContentQueryKey(variables.id)})
            queryClient.setQueryData(documentContentQueryKey(updated.id), updated)
            await queryClient.invalidateQueries({queryKey: documentTreeQueryKey})
            CustomToast.success("Document renamed")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data?.message || "Failed to rename document")
        },
    })

    const moveDocumentMutation = useMutation({
        mutationFn: (payload: {id: string; targetFolderId: string}) =>
            DocumentationServices.moveDocument(payload.id, payload.targetFolderId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: documentTreeQueryKey})
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            void queryClient.invalidateQueries({queryKey: documentTreeQueryKey})
            CustomToast.error(error.response?.data?.message || "Failed to move document")
        },
    })

    const deleteItemMutation = useMutation({
        mutationFn: (id: string) => DocumentationServices.deleteItem(id),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: documentTreeQueryKey})
            CustomToast.success("Deleted")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data?.message || "Failed to delete item")
        },
    })

    return {
        documentTree: treeQuery.data ?? EMPTY_DOC_TREE,
        document: contentQuery.data ?? null,
        isLoadingTree: treeQuery.isLoading || treeQuery.isFetching,
        isLoadingDocument: contentQuery.isLoading || contentQuery.isFetching,
        isMovingDocument: moveDocumentMutation.isPending,
        refetchDocumentTree: treeQuery.refetch,
        refetchDocument: contentQuery.refetch,
        createDocumentMutation,
        createFolderMutation,
        renameDocumentMutation,
        moveDocumentMutation,
        deleteItemMutation,
    }
}
