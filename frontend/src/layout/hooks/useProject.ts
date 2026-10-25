import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query"
import type {AxiosError} from "axios"
import {CollectionServices, type Project} from "../services/collection"
import CustomToast from "@/components/common/toast"
import type {Response} from "@/types/response"
import {useAppDispatch} from "@/app/store/hooks"
import {resetEditorTabs} from "@/app/slices/editorTabsSlice"

const EMPTY_PROJECTS: Project[] = []
export const projectListQueryKey = ["project", "list"] as const

const errorMessage = (error: AxiosError<Response<unknown>>, fallback: string) =>
    error.response?.data.message || fallback

export const useProject = () => {
    const queryClient = useQueryClient()
    const dispatch = useAppDispatch()

    const projectsQuery = useQuery<Project[]>({
        queryKey: projectListQueryKey,
        queryFn: CollectionServices.listProjects,
        refetchOnWindowFocus: false,
    })

    const projects = projectsQuery.data ?? EMPTY_PROJECTS
    const activeProject = projects.find((p) => p.is_selected) ?? null

    // Drops every collection-scoped cache so the workspace reloads for the newly active project.
    const resetWorkspace = async () => {
        dispatch(resetEditorTabs())
        await queryClient.resetQueries({queryKey: ["collection"]})
        await queryClient.invalidateQueries({queryKey: ["documentation"]})
        await queryClient.invalidateQueries({queryKey: projectListQueryKey})
    }

    const openProjectMutation = useMutation({
        mutationFn: (path: string) => CollectionServices.openProject(path),
        onSuccess: resetWorkspace,
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(errorMessage(error, "Failed to open project"))
        },
    })

    const selectProjectMutation = useMutation({
        mutationFn: (id: string) => CollectionServices.selectProject(id),
        onSuccess: resetWorkspace,
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(errorMessage(error, "Failed to select project"))
        },
    })

    const updateProjectMutation = useMutation({
        mutationFn: (payload: {id: string; data: {name?: string; path?: string}}) =>
            CollectionServices.updateProject(payload.id, payload.data),
        onSuccess: async () => {
            await resetWorkspace()
            CustomToast.success("Project updated")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(errorMessage(error, "Failed to update project"))
        },
    })

    const deleteProjectMutation = useMutation({
        mutationFn: (id: string) => CollectionServices.deleteProject(id),
        onSuccess: async (_, id) => {
            if (id === activeProject?.id) {
                await resetWorkspace()
            } else {
                await queryClient.invalidateQueries({queryKey: projectListQueryKey})
            }
            CustomToast.success("Project deleted")
        },
        onError: (error: AxiosError<Response<unknown>>) => {
            CustomToast.error(errorMessage(error, "Failed to delete project"))
        },
    })

    return {
        projects,
        activeProject,
        isLoadingProjects: projectsQuery.isLoading,
        openProjectMutation,
        selectProjectMutation,
        updateProjectMutation,
        deleteProjectMutation,
    }
}
