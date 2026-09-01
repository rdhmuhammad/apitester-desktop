import {createSlice, type PayloadAction} from "@reduxjs/toolkit"
import type {RootState} from "@/app/store/store.ts"
import {createAppAsyncThunk} from "@/app/store/withTypes.ts"
import {CollectionServices} from "@/layout/services/collection.ts"
import {AutomationServices} from "@/layout/services/automation.ts"
import type {AutomationFile, AutomationInventoryFile, AutomationRunConfig} from "@/pages/editor/types/automation.ts"

interface AutomationState {
  collectionId: string | null
  files: AutomationFile[]
  inventories: AutomationInventoryFile[]
  activeIds: string[]
  activeInventoryIds: string[]
  configs: Record<string, AutomationRunConfig>
  status: 'idle' | 'pending' | 'succeeded' | 'rejected'
  hasUnsavedChanges: Record<string, boolean>
  inventoryUnsavedChanges: Record<string, boolean>
}

export const defaultAutomationConfig = (): AutomationRunConfig => ({
  inventoryFiles: [],
  inventoryFile: '',
  limit: '',
  tags: '',
  extraVars: '{}',
  checkMode: true,
  diffMode: false,
})

const initialState: AutomationState = {
  collectionId: null,
  files: [],
  inventories: [],
  activeIds: [],
  activeInventoryIds: [],
  configs: {},
  status: 'idle',
  hasUnsavedChanges: {},
  inventoryUnsavedChanges: {},
}

export const fetchAutomationFiles = createAppAsyncThunk(
  'automation/fetchFiles',
  async () => {
    const active = await CollectionServices.getActiveCollection()
        const [files, inventories, configs] = await Promise.all([
            AutomationServices.list(active.automation_id),
            AutomationServices.listInventories(active.automation_id),
            AutomationServices.listConfigs(active.automation_id),
        ])
        return {collectionId: active.automation_id, files, inventories, configs}
  },
)

export const fetchAutomationContent = createAppAsyncThunk(
  'automation/fetchContent',
  async (filename: string, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')
    return await AutomationServices.read(collectionId, filename)
  },
)

export const saveAutomationFile = createAppAsyncThunk(
  'automation/saveFile',
  async (payload: {filename: string; content: string}, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')
    await AutomationServices.write(collectionId, payload.filename, payload.content)
    return payload
  },
)

export const fetchAutomationInventoryContent = createAppAsyncThunk(
  'automation/fetchInventoryContent',
  async (filename: string, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')
    return await AutomationServices.readInventory(collectionId, filename)
  },
)

export const saveAutomationInventory = createAppAsyncThunk(
  'automation/saveInventory',
  async (payload: {filename: string; content: string}, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')
    await AutomationServices.writeInventory(collectionId, payload.filename, payload.content)
    return payload
  },
)

export const deleteAutomationFile = createAppAsyncThunk(
  'automation/deleteFile',
  async (filename: string, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')
    await AutomationServices.remove(collectionId, filename)
    return filename
  },
)

export const deleteAutomationInventory = createAppAsyncThunk(
  'automation/deleteInventory',
  async (filename: string, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')
    await AutomationServices.removeInventory(collectionId, filename)
    return filename
  },
)

export const saveAutomationConfig = createAppAsyncThunk(
  'automation/saveConfig',
  async (payload: {id: string; config: AutomationRunConfig}, {getState}) => {
    const collectionId = getState().automation.collectionId
    const file = getState().automation.files.find(item => item.id === payload.id)
    if (!collectionId || !file) throw new Error('No active automation')
    await AutomationServices.writeConfig(collectionId, file.filename, payload.config)
    return payload
  },
)

export const createAutomationFile = createAppAsyncThunk(
  'automation/createFile',
  async (_, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')

    const existing = getState().automation.files
    let index = 1
    let filename = `automation-${index}.yml`
    while (existing.some(file => file.filename === filename)) {
      index++
      filename = `automation-${index}.yml`
    }

    const content = `---
- name: New automation
  hosts: all
  gather_facts: false
  tasks:
    - name: Replace this starter task
      ansible.builtin.debug:
        msg: "Hello from ApiTester"
`
    await AutomationServices.write(collectionId, filename, content)
    return {id: filename, name: filename.replace(/\.ya?ml$/, ''), filename, content}
  },
)

export const createAutomationInventory = createAppAsyncThunk(
  'automation/createInventory',
  async (payload: {automationId?: string; filename?: string} | undefined, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')
    const automationId = payload?.automationId
    const automation = automationId ? getState().automation.files.find(file => file.id === automationId) : undefined
    const created = await AutomationServices.createInventory(collectionId, payload?.filename, automation?.filename)
    const filename = created.name
    if (automationId) {
      const current = getState().automation.configs[automationId] ?? defaultAutomationConfig()
      const config = {
        ...current,
        inventoryFiles: [...new Set([...current.inventoryFiles, filename])],
        inventoryFile: current.inventoryFile || filename,
      }
      return {automationId, config, inventory: {id: filename, name: filename.replace(/\.[^.]+$/, ''), filename, content: created.content, size: created.content.length}}
    }
    return {automationId: undefined, config: undefined, inventory: {id: filename, name: filename.replace(/\.[^.]+$/, ''), filename, content: created.content, size: created.content.length}}
  },
)

const automationSlice = createSlice({
  name: 'automation',
  initialState,
  reducers: {
    openAutomationTab(state, action: PayloadAction<string>) {
      if (!state.activeIds.includes(action.payload)) state.activeIds.push(action.payload)
    },
    closeAutomationTab(state, action: PayloadAction<string>) {
      state.activeIds = state.activeIds.filter(id => id !== action.payload)
    },
    updateAutomationContent(state, action: PayloadAction<{id: string; content: string}>) {
      const file = state.files.find(item => item.id === action.payload.id)
      if (!file) return
      file.content = action.payload.content
      state.hasUnsavedChanges[action.payload.id] = true
    },
    updateAutomationConfig(state, action: PayloadAction<{id: string; config: Partial<AutomationRunConfig>}>) {
      state.configs[action.payload.id] = {
        ...defaultAutomationConfig(),
        ...state.configs[action.payload.id],
        ...action.payload.config,
      }
    },
    openAutomationInventoryTab(state, action: PayloadAction<string>) {
      if (!state.activeInventoryIds.includes(action.payload)) state.activeInventoryIds.push(action.payload)
    },
    closeAutomationInventoryTab(state, action: PayloadAction<string>) {
      state.activeInventoryIds = state.activeInventoryIds.filter(id => id !== action.payload)
    },
    updateAutomationInventoryContent(state, action: PayloadAction<{id: string; content: string}>) {
      const file = state.inventories.find(item => item.id === action.payload.id)
      if (!file) return
      file.content = action.payload.content
      state.inventoryUnsavedChanges[action.payload.id] = true
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchAutomationFiles.pending, state => { state.status = 'pending' })
    builder.addCase(fetchAutomationFiles.fulfilled, (state, action) => {
      const sameCollection = state.collectionId === action.payload.collectionId
      state.collectionId = action.payload.collectionId
      const validInventoryIds = new Set(action.payload.inventories.map(file => file.filename))
      state.activeInventoryIds = sameCollection ? state.activeInventoryIds.filter(id => validInventoryIds.has(id)) : []
      state.inventories = action.payload.inventories.map(file => {
        const previous = sameCollection ? state.inventories.find(item => item.id === file.filename) : undefined
        return previous ?? {id: file.filename, name: file.name, filename: file.filename, content: '', size: file.size}
      })
      state.configs = Object.fromEntries(Object.entries(action.payload.configs).map(([id, config]) => {
        const normalized = {
          ...defaultAutomationConfig(),
          ...config,
          inventoryFiles: (config.inventoryFiles ?? []).filter(filename => validInventoryIds.has(filename)),
        }
        if (normalized.inventoryFile && !normalized.inventoryFiles.includes(normalized.inventoryFile)) normalized.inventoryFile = ''
        return [id, normalized]
      }))
      const validIds = new Set(action.payload.files.map(file => file.filename))
      state.activeIds = sameCollection ? state.activeIds.filter(id => validIds.has(id)) : []
      state.files = action.payload.files.map(file => {
        const id = file.filename
        const previous = sameCollection ? state.files.find(item => item.id === id) : undefined
        return previous ?? {
          id,
          name: file.name,
          filename: file.filename,
          content: '',
          size: file.size,
          lastRunStatus: 'unrun',
        }
      })
      if (!sameCollection) {
        state.hasUnsavedChanges = {}
        state.inventoryUnsavedChanges = {}
      }
      state.status = 'succeeded'
    })
    builder.addCase(fetchAutomationFiles.rejected, state => { state.status = 'rejected' })
    builder.addCase(fetchAutomationContent.fulfilled, (state, action) => {
      const file = state.files.find(item => item.id === action.payload.name)
      if (file) file.content = action.payload.content
    })
    builder.addCase(fetchAutomationInventoryContent.fulfilled, (state, action) => {
      const file = state.inventories.find(item => item.id === action.payload.name)
      if (file) file.content = action.payload.content
    })
    builder.addCase(saveAutomationFile.fulfilled, (state, action) => {
      state.hasUnsavedChanges[action.payload.filename] = false
      const file = state.files.find(item => item.id === action.payload.filename)
      if (file) file.size = action.payload.content.length
    })
    builder.addCase(saveAutomationInventory.fulfilled, (state, action) => {
      state.inventoryUnsavedChanges[action.payload.filename] = false
      const file = state.inventories.find(item => item.id === action.payload.filename)
      if (file) file.size = action.payload.content.length
    })
    builder.addCase(deleteAutomationFile.fulfilled, (state, action) => {
      state.files = state.files.filter(file => file.id !== action.payload)
      state.activeIds = state.activeIds.filter(id => id !== action.payload)
      delete state.hasUnsavedChanges[action.payload]
      delete state.configs[action.payload]
    })
    builder.addCase(deleteAutomationInventory.fulfilled, (state, action) => {
      state.inventories = state.inventories.filter(file => file.id !== action.payload)
      state.activeInventoryIds = state.activeInventoryIds.filter(id => id !== action.payload)
      delete state.inventoryUnsavedChanges[action.payload]
      for (const config of Object.values(state.configs)) {
        config.inventoryFiles = config.inventoryFiles.filter(filename => filename !== action.payload)
        if (config.inventoryFile === action.payload) config.inventoryFile = ''
      }
    })
    builder.addCase(saveAutomationConfig.fulfilled, (state, action) => {
      state.configs[action.payload.id] = action.payload.config
    })
    builder.addCase(createAutomationFile.fulfilled, (state, action) => {
      state.files.push({
        id: action.payload.id,
        name: action.payload.name,
        filename: action.payload.filename,
        content: action.payload.content,
        size: action.payload.content.length,
        lastRunStatus: 'unrun',
      })
      state.activeIds.push(action.payload.id)
    })
    builder.addCase(createAutomationInventory.fulfilled, (state, action) => {
      state.inventories.push(action.payload.inventory)
      if (action.payload.automationId && action.payload.config) {
        state.configs[action.payload.automationId] = action.payload.config
      }
    })
  },
})

export const {
  openAutomationTab,
  closeAutomationTab,
  updateAutomationContent,
  updateAutomationConfig,
  openAutomationInventoryTab,
  closeAutomationInventoryTab,
  updateAutomationInventoryContent,
} = automationSlice.actions
export default automationSlice.reducer

export const selectAutomationFiles = (state: RootState) => state.automation.files
export const selectAutomationInventories = (state: RootState) => state.automation.inventories
export const selectActiveAutomation = (state: RootState) => {
  const fileId = state.collection.activeTabId.replace(/^automation-/, '')
  return state.automation.files.find(file => file.id === fileId) ?? null
}
export const selectAutomationUnsaved = (state: RootState, id: string) => Boolean(state.automation.hasUnsavedChanges[id])
export const selectAutomationConfig = (state: RootState, id: string) => state.automation.configs[id] ?? defaultAutomationConfig()
export const selectActiveAutomationInventory = (state: RootState) => {
  const fileId = state.collection.activeTabId.replace(/^automation-inventory-/, '')
  return state.automation.inventories.find(file => file.id === fileId) ?? null
}
export const selectAutomationInventoryUnsaved = (state: RootState, id: string) => Boolean(state.automation.inventoryUnsavedChanges[id])
