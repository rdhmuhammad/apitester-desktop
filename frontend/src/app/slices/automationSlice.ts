import {createSlice, type PayloadAction} from "@reduxjs/toolkit"
import type {RootState} from "@/app/store/store.ts"
import {createAppAsyncThunk} from "@/app/store/withTypes.ts"
import {CollectionServices} from "@/layout/services/collection.ts"
import {AutomationServices} from "@/layout/services/automation.ts"
import type {AutomationFile, AutomationRunConfig, AutomationRunResult, AutomationRuntime} from "@/pages/editor/types/automation.ts"

interface AutomationState {
  collectionId: string | null
  files: AutomationFile[]
  activeIds: string[]
  configs: Record<string, AutomationRunConfig>
  runtime: AutomationRuntime | null
  status: 'idle' | 'pending' | 'succeeded' | 'rejected'
  hasUnsavedChanges: Record<string, boolean>
  runningId: string | null
  runResults: Record<string, AutomationRunResult | null>
}

const defaultConfig: AutomationRunConfig = {
  inventoryPath: '',
  limit: '',
  tags: '',
  extraVars: '{}',
  checkMode: true,
  diffMode: false,
}

const initialState: AutomationState = {
  collectionId: null,
  files: [],
  activeIds: [],
  configs: {},
  runtime: null,
  status: 'idle',
  hasUnsavedChanges: {},
  runningId: null,
  runResults: {},
}

export const fetchAutomationFiles = createAppAsyncThunk(
  'automation/fetchFiles',
  async () => {
    const active = await CollectionServices.getActiveCollection()
    const [files, runtime] = await Promise.all([
      AutomationServices.list(active.id),
      AutomationServices.runtime(active.id),
    ])
    return {collectionId: active.id, files, runtime}
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

export const deleteAutomationFile = createAppAsyncThunk(
  'automation/deleteFile',
  async (filename: string, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')
    await AutomationServices.remove(collectionId, filename)
    return filename
  },
)

export const runAutomation = createAppAsyncThunk(
  'automation/run',
  async (payload: {id: string; filename: string; config: AutomationRunConfig}, {getState}) => {
    const collectionId = getState().automation.collectionId
    if (!collectionId) throw new Error('No active collection')
    const result = await AutomationServices.run(collectionId, payload.filename, payload.config)
    return {id: payload.id, config: payload.config, result}
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
        ...defaultConfig,
        ...state.configs[action.payload.id],
        ...action.payload.config,
      }
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchAutomationFiles.pending, state => { state.status = 'pending' })
    builder.addCase(fetchAutomationFiles.fulfilled, (state, action) => {
      state.collectionId = action.payload.collectionId
      state.runtime = action.payload.runtime
      const validIds = new Set(action.payload.files.map(file => file.filename))
      state.activeIds = state.activeIds.filter(id => validIds.has(id))
      state.files = action.payload.files.map(file => {
        const id = file.filename
        const previous = state.files.find(item => item.id === id)
        return previous ?? {
          id,
          name: file.name,
          filename: file.filename,
          content: '',
          size: file.size,
          lastRunStatus: 'unrun',
        }
      })
      for (const id of Object.keys(state.runResults)) {
        if (!validIds.has(id)) delete state.runResults[id]
      }
      if (state.runningId && !validIds.has(state.runningId)) state.runningId = null
      state.status = 'succeeded'
    })
    builder.addCase(fetchAutomationFiles.rejected, state => { state.status = 'rejected' })
    builder.addCase(fetchAutomationContent.fulfilled, (state, action) => {
      const file = state.files.find(item => item.id === action.payload.name)
      if (file) file.content = action.payload.content
    })
    builder.addCase(saveAutomationFile.fulfilled, (state, action) => {
      state.hasUnsavedChanges[action.payload.filename] = false
      const file = state.files.find(item => item.id === action.payload.filename)
      if (file) file.size = action.payload.content.length
    })
    builder.addCase(deleteAutomationFile.fulfilled, (state, action) => {
      state.files = state.files.filter(file => file.id !== action.payload)
      state.activeIds = state.activeIds.filter(id => id !== action.payload)
      delete state.hasUnsavedChanges[action.payload]
      delete state.configs[action.payload]
      delete state.runResults[action.payload]
      if (state.runningId === action.payload) state.runningId = null
    })
    builder.addCase(runAutomation.pending, (state, action) => {
      state.runningId = action.meta.arg.id
      const file = state.files.find(item => item.id === action.meta.arg.id)
      if (file) {
        file.lastRunStatus = 'running'
        file.lastRunAt = new Date().toISOString()
      }
    })
    builder.addCase(runAutomation.fulfilled, (state, action) => {
      state.runningId = null
      state.runResults[action.payload.id] = action.payload.result
      const file = state.files.find(item => item.id === action.payload.id)
      if (file) file.lastRunStatus = action.payload.config.checkMode ? 'check' : 'passed'
    })
    builder.addCase(runAutomation.rejected, (state, action) => {
      state.runningId = null
      const file = state.files.find(item => item.id === action.meta.arg.id)
      if (file) file.lastRunStatus = 'failed'
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
  },
})

export const {openAutomationTab, closeAutomationTab, updateAutomationContent, updateAutomationConfig} = automationSlice.actions
export default automationSlice.reducer

export const selectAutomationFiles = (state: RootState) => state.automation.files
export const selectActiveAutomation = (state: RootState) => {
  const fileId = state.collection.activeTabId.replace(/^automation-/, '')
  return state.automation.files.find(file => file.id === fileId) ?? null
}
export const selectAutomationRuntime = (state: RootState) => state.automation.runtime
export const selectAutomationUnsaved = (state: RootState, id: string) => Boolean(state.automation.hasUnsavedChanges[id])
export const selectAutomationConfig = (state: RootState, id: string) => state.automation.configs[id] ?? defaultConfig
export const selectAutomationRunningId = (state: RootState) => state.automation.runningId
export const selectAutomationRunResult = (state: RootState, id: string) => state.automation.runResults[id] ?? null
