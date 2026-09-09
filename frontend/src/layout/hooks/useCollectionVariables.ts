import {useQuery} from "@tanstack/react-query"
import {CollectionServices} from "../services/collection"
import type {CollectionVar} from "@/pages/editor/types/api"

const EMPTY_VARIABLES: CollectionVar[] = []

export const useCollectionVariables = () => {
    const variablesQuery = useQuery<CollectionVar[]>({
        queryKey: ["collection", "variables"],
        queryFn: CollectionServices.getVariables,
        gcTime: 0,
        refetchOnWindowFocus: false,
    })

    return {
        variables: variablesQuery.data ?? EMPTY_VARIABLES,
        isLoadingVariables: variablesQuery.isLoading || variablesQuery.isFetching,
        refetchVariables: variablesQuery.refetch,
        variablesQuery,
    }
}
