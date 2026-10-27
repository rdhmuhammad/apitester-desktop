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

export interface FilterWorkdirFilesResult {
    items: WorkdirFileItem[]
    total: number
}

export const filterWorkdirFiles = (
    files: WorkdirFileItem[],
    rawQuery: string,
    limit = 40
): FilterWorkdirFilesResult => {
    const q = rawQuery.trim().toLowerCase()
    if (!q) {
        return {
            items: files.slice(0, limit),
            total: files.length,
        }
    }

    const matches: WorkdirFileItem[] = []
    for (let i = 0; i < files.length; i++) {
        const f = files[i]
        if (f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q)) {
            matches.push(f)
        }
    }

    matches.sort((a, b) => {
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        const aStartsWith = aName.startsWith(q)
        const bStartsWith = bName.startsWith(q)
        if (aStartsWith && !bStartsWith) return -1
        if (!aStartsWith && bStartsWith) return 1
        return aName < bName ? -1 : aName > bName ? 1 : 0
    })

    return {
        items: matches.slice(0, limit),
        total: matches.length,
    }
}
