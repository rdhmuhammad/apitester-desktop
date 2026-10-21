export type ColtReqMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface EditorTab {
  id: string
  label: string
  method: ColtReqMethod | 'TEST' | 'AUTO' | 'INV' | 'DOC'
  type: 'request' | 'test' | 'automation' | 'inventory' | 'document'
}
