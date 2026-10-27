export const TEST_TAB_PREFIX = 'test-'
export const AUTOMATION_TAB_PREFIX = 'automation-'
export const AUTOMATION_INVENTORY_TAB_PREFIX = 'automation-inventory-'
export const DOCUMENT_TAB_PREFIX = 'doc-'

const stripPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id

export const isTestTab = (id: string): boolean => id.startsWith(TEST_TAB_PREFIX)
export const isDocumentTab = (id: string): boolean => id.startsWith(DOCUMENT_TAB_PREFIX)

export const toTestTabId = (id: string): string => `${TEST_TAB_PREFIX}${id}`
export const fromTestTabId = (id: string): string => stripPrefix(id, TEST_TAB_PREFIX)

export const toAutomationTabId = (id: string): string => `${AUTOMATION_TAB_PREFIX}${id}`
export const fromAutomationTabId = (id: string): string => stripPrefix(id, AUTOMATION_TAB_PREFIX)

export const toAutomationInventoryTabId = (id: string): string => `${AUTOMATION_INVENTORY_TAB_PREFIX}${id}`
export const fromAutomationInventoryTabId = (id: string): string => stripPrefix(id, AUTOMATION_INVENTORY_TAB_PREFIX)

export const toDocumentTabId = (id: string): string => id.startsWith(DOCUMENT_TAB_PREFIX) ? id : `${DOCUMENT_TAB_PREFIX}${id}`
export const fromDocumentTabId = (id: string): string => stripPrefix(id, DOCUMENT_TAB_PREFIX)
