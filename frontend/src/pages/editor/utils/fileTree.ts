import type {DocumentTree} from "@/pages/editor/services/documentation.ts"

export interface WorkdirFileItem {
    id: string
    name: string
    path: string
    category: "DOC_MD" | "DOC_HTML" | "FILE" | string
    extension: string
}

export const flattenTreeToFiles = (nodes: DocumentTree[]): WorkdirFileItem[] => {
    const result: WorkdirFileItem[] = []

    const traverse = (list: DocumentTree[]) => {
        for (const node of list) {
            if (node.category !== "FOLD") {
                const ext = node.name.includes(".") ? node.name.slice(node.name.lastIndexOf(".")).toLowerCase() : ""
                result.push({
                    id: node.id,
                    name: node.name,
                    path: node.path,
                    category: node.category,
                    extension: ext,
                })
            }
            if (node.item && node.item.length > 0) {
                traverse(node.item)
            }
        }
    }

    traverse(nodes)
    return result
}

export const filterWorkdirFiles = (files: WorkdirFileItem[], rawQuery: string): WorkdirFileItem[] => {
    const q = rawQuery.trim().toLowerCase()
    if (!q) return files

    return files
        .filter((f) => f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q))
        .sort((a, b) => {
            const aName = a.name.toLowerCase()
            const bName = b.name.toLowerCase()
            const aStartsWith = aName.startsWith(q)
            const bStartsWith = bName.startsWith(q)
            if (aStartsWith && !bStartsWith) return -1
            if (!aStartsWith && bStartsWith) return 1
            return aName.localeCompare(bName)
        })
}
