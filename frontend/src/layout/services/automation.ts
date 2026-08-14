import axios from "@/config/axios.ts"
import type {Response} from "@/types/response.ts"
import type {AutomationRunConfig, AutomationRunResult, AutomationRuntime} from "@/pages/editor/types/automation.ts"

export interface AutomationFileInfo {
  name: string
  filename: string
  size: number
}

export interface AutomationFileContent {
  name: string
  content: string
}

export const AutomationServices = {
  list: async (collectionId: string): Promise<AutomationFileInfo[]> => {
    const response = await axios.get<Response<AutomationFileInfo[]>>(`/collection/${collectionId}/automation`)
    return response.data.data
  },

  read: async (collectionId: string, filename: string): Promise<AutomationFileContent> => {
    const response = await axios.get<Response<AutomationFileContent>>(`/collection/${collectionId}/automation/${filename}`)
    return response.data.data
  },

  write: async (collectionId: string, filename: string, content: string): Promise<string> => {
    const response = await axios.put<Response<null>>(`/collection/${collectionId}/automation/${filename}`, {
      name: filename,
      content,
    })
    return response.data.message
  },

  remove: async (collectionId: string, filename: string): Promise<string> => {
    const response = await axios.delete<Response<null>>(`/collection/${collectionId}/automation/${filename}`)
    return response.data.message
  },

  runtime: async (collectionId: string): Promise<AutomationRuntime> => {
    const response = await axios.get<Response<AutomationRuntime>>(`/collection/${collectionId}/automation/runtime`)
    return response.data.data
  },

  run: async (collectionId: string, filename: string, config: AutomationRunConfig): Promise<AutomationRunResult> => {
    const response = await axios.post<Response<AutomationRunResult>>(
      `/collection/${collectionId}/automation/${filename}/run`,
      config,
    )
    return response.data.data
  },
}
