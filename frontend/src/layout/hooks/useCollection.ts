import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import {
    CollectionServices,
    type Collection,
    type CreateCollectionVariableRequest,
    type DeleteCollectionVariableRequest,
    type UpdateCollectionVariableRequest,
    type UpdateCollectionPreScriptRequest,
    type UpdateCollectionAuthRequest,
    type RequestTree,
} from "../services/collection"
import type {CollectionAuth, CollectionVar} from "@/pages/editor/types/api"
import CustomToast from "@/components/common/toast"
import type {AxiosError} from "axios"
import type {Response} from "@/types/response"

const EMPTY_COLLECTIONS: Collection[] = []
const EMPTY_TREE: RequestTree[] = []
const EMPTY_VARIABLES: CollectionVar[] = []
const EMPTY_PRE_SCRIPT = ""

export const useCollection = (selectedCollectionId: string | null = null) => {
    const queryClient = useQueryClient()

    const collectionsQuery = useQuery<Collection[]>({
        queryKey: ["collection", "list"],
        queryFn: CollectionServices.listCollections,
        gcTime: 0,
        enabled: false,
        refetchOnWindowFocus: false,
    })

    const activeCollectionQuery = useQuery<Collection>({
        queryKey: ["collection", "active"],
        queryFn: CollectionServices.getActiveCollection,
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const collectionId = selectedCollectionId ?? activeCollectionQuery.data?.id ?? null

    const treeQuery = useQuery<RequestTree[]>({
        queryKey: ["collection", "tree"],
        queryFn: () => CollectionServices.getRequestTree(collectionId as string),
        enabled: Boolean(collectionId),
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const variablesQuery = useQuery<CollectionVar[]>({
        queryKey: ["collection", "variables"],
        queryFn: CollectionServices.getVariables,
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const preScriptQuery = useQuery<string>({
        queryKey: ["collection", "pre-script"],
        queryFn: CollectionServices.getPreScript,
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const authQuery = useQuery<CollectionAuth | null>({
        queryKey: ["collection", "auth"],
        queryFn: () => CollectionServices.getAuth(),
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    const updateAuthMutation = useMutation({
        mutationFn: (data: UpdateCollectionAuthRequest) =>
            CollectionServices.updateAuth(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: ["collection", "auth"]})
            await queryClient.invalidateQueries({queryKey: ["collection", "detail", collectionId]})
            CustomToast.success("Collection authorization updated")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data.message || "Failed to update collection authorization")
        },
    })

    const updatePreScriptMutation = useMutation({
        mutationFn: (data: UpdateCollectionPreScriptRequest) =>
            CollectionServices.updatePreScript(data),
        onSuccess: async (result) => {
            await queryClient.invalidateQueries({queryKey: ["collection", "pre-script"]})
            await queryClient.invalidateQueries({queryKey: ["collection", "detail", collectionId]})
            queryClient.setQueryData(["collection", "pre-script"], result.script)
            CustomToast.success("Pre-request script updated")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data.message || "Failed to update pre-request script")
        },
    })

    const createCollectionMutation = useMutation({
        mutationFn: (payload: {name: string; path: string}) =>
            CollectionServices.createCollection(payload.name, payload.path),
        onSuccess: () => {
            CustomToast.success("Collection created")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data.message || "Failed to create collection")
        },
    })

    const updateCollectionMutation = useMutation({
        mutationFn: (payload: {id: string; data: {name?: string; path?: string}}) =>
            CollectionServices.updateCollection(payload.id, payload.data),
        onSuccess: () => {
            CustomToast.success("Collection updated")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data.message || "Failed to update collection")
        },
    })

    const deleteCollectionMutation = useMutation({
        mutationFn: (id: string) => CollectionServices.deleteCollection(id),
        onSuccess: () => {
            CustomToast.success("Collection deleted")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data.message || "Failed to delete collection")
        },
    })

    const selectCollectionMutation = useMutation({
        mutationFn: (id: string) => CollectionServices.selectCollection(id),
        onSuccess: () => {
            CustomToast.success("Collection selected")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data.message || "Failed to select collection")
        },
    })

    const createVariableMutation = useMutation({
        mutationFn: (data: CreateCollectionVariableRequest) =>
            CollectionServices.createVariable(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: ["collection", "variables"]})
            CustomToast.success("Variable created")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data.message || "Failed to create variable")
        },
    })

    const updateVariableMutation = useMutation({
        mutationFn: (data: UpdateCollectionVariableRequest) =>
            CollectionServices.updateVariable(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: ["collection", "variables"]})
            await queryClient.invalidateQueries({queryKey: ["collection", "detail", collectionId]})
            CustomToast.success("Variable updated")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data.message || "Failed to update variable")
        },
    })

    const deleteVariableMutation = useMutation({
        mutationFn: (data: DeleteCollectionVariableRequest) =>
            CollectionServices.deleteVariable(data),
        onSuccess: async () => {
            await queryClient.invalidateQueries({queryKey: ["collection", "variables"]})
            await queryClient.invalidateQueries({queryKey: ["collection", "detail", collectionId]})
            CustomToast.success("Variable deleted")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(error.response?.data.message || "Failed to delete variable")
        },
    })

    return {
        collections: collectionsQuery.data ?? EMPTY_COLLECTIONS,
        activeCollection: activeCollectionQuery.data ?? null,
        collection: activeCollectionQuery.data ?? null,
        requestTree: treeQuery.data ?? EMPTY_TREE,
        variables: variablesQuery.data ?? EMPTY_VARIABLES,
        preScript: preScriptQuery.data ?? EMPTY_PRE_SCRIPT,
        auth: authQuery.data ?? null,
        isLoadingCollections: collectionsQuery.isLoading || collectionsQuery.isFetching,
        isLoadingActiveCollection: activeCollectionQuery.isLoading || activeCollectionQuery.isFetching,
        isLoadingCollection: activeCollectionQuery.isLoading || activeCollectionQuery.isFetching,
        isLoadingTree: treeQuery.isLoading || treeQuery.isFetching,
        isLoadingVariables: variablesQuery.isLoading || variablesQuery.isFetching,
        isLoadingPreScript: preScriptQuery.isLoading || preScriptQuery.isFetching,
        isLoadingAuth: authQuery.isLoading || authQuery.isFetching,
        refetchCollections: collectionsQuery.refetch,
        refetchActiveCollection: activeCollectionQuery.refetch,
        refetchCollection: activeCollectionQuery.refetch,
        refetchTree: treeQuery.refetch,
        refetchVariables: variablesQuery.refetch,
        refetchPreScript: preScriptQuery.refetch,
        refetchAuth: authQuery.refetch,
        collectionsQuery,
        activeCollectionQuery,
        collectionQuery: activeCollectionQuery,
        treeQuery,
        variablesQuery,
        preScriptQuery,
        authQuery,
        createCollectionMutation,
        updateCollectionMutation,
        deleteCollectionMutation,
        selectCollectionMutation,
        createVariableMutation,
        updateVariableMutation,
        deleteVariableMutation,
        updatePreScriptMutation,
        updateAuthMutation,
    }
}
