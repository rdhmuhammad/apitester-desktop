import axios from "@/config/axios.ts"
import type {Response} from "@/types/response.ts"
import type {AutomationRunConfig} from "@/pages/editor/types/automation.ts"

export interface AutomationFileInfo {
  name: string
  filename: string
  size: number
}

export interface AutomationFileContent {
  name: string
  content: string
}

export interface AutomationInventoryFileInfo {
  name: string
  filename: string
  size: number
}

export interface AutomationFileUpdate {
  filename: string
  content: string
}

export interface AutomationInventoryUpdate {
  filename: string
  content: string
}

export interface AutomationConfigUpdate {
  filename: string
  config: AutomationRunConfig
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

  listInventories: async (collectionId: string): Promise<AutomationInventoryFileInfo[]> => {
    const response = await axios.get<Response<AutomationInventoryFileInfo[]>>(`/collection/${collectionId}/automation/inventory`)
    return response.data.data
  },

  createInventory: async (collectionId: string, filename?: string, automationFilename?: string): Promise<AutomationFileContent> => {
    const response = await axios.post<Response<AutomationFileContent>>(`/collection/${collectionId}/automation/inventory`, {
      filename,
      automationFilename,
    })
    return response.data.data
  },

  readInventory: async (collectionId: string, filename: string): Promise<AutomationFileContent> => {
    const response = await axios.get<Response<AutomationFileContent>>(`/collection/${collectionId}/automation/inventory/${filename}`)
    return response.data.data
  },

  writeInventory: async (collectionId: string, filename: string, content: string): Promise<string> => {
    const response = await axios.put<Response<null>>(`/collection/${collectionId}/automation/inventory/${filename}`, {
      name: filename,
      content,
    })
    return response.data.message
  },

  removeInventory: async (collectionId: string, filename: string): Promise<string> => {
    const response = await axios.delete<Response<null>>(`/collection/${collectionId}/automation/inventory/${filename}`)
    return response.data.message
  },

  listConfigs: async (collectionId: string): Promise<Record<string, AutomationRunConfig>> => {
    const response = await axios.get<Response<Record<string, AutomationRunConfig>>>(`/collection/${collectionId}/automation/config`)
    return response.data.data
  },

  writeConfig: async (collectionId: string, filename: string, config: AutomationRunConfig): Promise<string> => {
    const response = await axios.put<Response<null>>(`/collection/${collectionId}/automation/${filename}/config`, config)
    return response.data.message
  },

  push: async (
    collectionId: string,
    files: AutomationFileUpdate[],
    inventories: AutomationInventoryUpdate[],
    configs: AutomationConfigUpdate[],
  ): Promise<void> => {
    await Promise.all([
      ...files.map(file => AutomationServices.write(collectionId, file.filename, file.content)),
      ...inventories.map(file => AutomationServices.writeInventory(collectionId, file.filename, file.content)),
    ])
    await Promise.all(configs.map(({filename, config}) => AutomationServices.writeConfig(collectionId, filename, config)))
  },

}
