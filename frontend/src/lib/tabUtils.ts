export const TEST_TAB_PREFIX = 'test-'
export const AUTOMATION_TAB_PREFIX = 'automation-'
export const AUTOMATION_INVENTORY_TAB_PREFIX = 'automation-inventory-'

export const isTestTab = (id: string): boolean => id.startsWith(TEST_TAB_PREFIX)

export const toTestTabId = (id: string): string => `${TEST_TAB_PREFIX}${id}`

export const fromTestTabId = (id: string): string => id.replace(new RegExp(`^${TEST_TAB_PREFIX}`), '')
export const toAutomationTabId = (id: string): string => `${AUTOMATION_TAB_PREFIX}${id}`
export const fromAutomationTabId = (id: string): string => id.replace(new RegExp(`^${AUTOMATION_TAB_PREFIX}`), '')
export const toAutomationInventoryTabId = (id: string): string => `${AUTOMATION_INVENTORY_TAB_PREFIX}${id}`
export const fromAutomationInventoryTabId = (id: string): string => id.replace(new RegExp(`^${AUTOMATION_INVENTORY_TAB_PREFIX}`), '')
