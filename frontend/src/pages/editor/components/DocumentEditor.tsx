import {useCallback, useEffect, useRef, useState} from "react"
import {AlignLeft, FileText, GripHorizontal, GripVertical, Link2, Loader2, Pin, Plus, Sparkles, Trash2, Upload} from "lucide-react"
import {useAppSelector} from "@/app/store/hooks.ts"
import {selectEditorActiveTab} from "@/app/slices/editorTabsSlice.ts"
import {useDocumentContent} from "@/pages/editor/hooks/useDocumentation.ts"
import {useLiveTransform} from "@/pages/editor/hooks/useLiveTransform.ts"
import {useApplyMarkdownTransform} from "@/pages/editor/hooks/useApplyMarkdownTransform.ts"
import {SUPPORTED_CODE_LANGUAGES, useCodeBlock} from "@/pages/editor/hooks/useCodeBlock.ts"
import {
    computeDocumentDiff,
    dispatchDocumentToolbarState,
    DocumentationServices,
} from "@/pages/editor/services/documentation.ts"
import {htmlToMarkdown, renderMarkdownToHtml} from "@/pages/editor/utils/markdown.ts"

const HEADING_CLASSES: Record<number, string> = {
    1: "text-3xl font-bold tracking-tight text-foreground mt-6 mb-3 pb-1 border-b border-border/60",
    2: "text-2xl font-semibold tracking-tight text-foreground mt-5 mb-2.5 pb-1 border-b border-border/40",
    3: "text-xl font-semibold text-foreground mt-4 mb-2",
    4: "text-lg font-semibold text-foreground mt-3 mb-1.5",
    5: "text-base font-semibold text-foreground mt-2.5 mb-1",
    6: "text-sm font-semibold uppercase tracking-wide text-muted-foreground mt-2 mb-1",
}

const placeCaretAtStart = (el: HTMLElement) => {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(el.textContent !== "\u200B")
    selection.removeAllRanges()
    selection.addRange(range)
}

const BRACKET_PAIRS: Record<string, string> = {
    "`": "`",
    "[": "]",
    "{": "}",
    "(": ")",
    "'": "'",
    '"': '"',
    "<": ">",
}

const findClosestTag = (
    node: Node | null | undefined,
    tags: string[],
    boundary: HTMLElement | null
): HTMLElement | null => {
    let curr = node
    while (curr && curr !== boundary) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
            const el = curr as HTMLElement
            if (tags.includes(el.tagName.toLowerCase())) {
                return el
            }
        }
        curr = curr.parentNode
    }
    return null
}

const DocumentEditor: React.FC = () => {
    const activeTab = useAppSelector(selectEditorActiveTab)
    const documentId = activeTab?.type === "document" ? activeTab.id : ""
    const documentQuery = useDocumentContent(documentId)

    const [markdown, setMarkdown] = useState("")
    const [sourceMode, setSourceMode] = useState(false)
    const [headingLevel, setHeadingLevel] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0)
    const [tableHover, setTableHover] = useState<{
        table: HTMLTableElement
        row: HTMLTableRowElement
        colIndex: number
        tableLeft: number
        tableTop: number
        rowTop: number
        rowHeight: number
        colLeft: number
        colWidth: number
    } | null>(null)
    const [imageHover, setImageHover] = useState<{
        img: HTMLImageElement
        left: number
        top: number
        width: number
        height: number
    } | null>(null)
    const [replaceUrlOpen, setReplaceUrlOpen] = useState(false)
    const [replaceUrlValue, setReplaceUrlValue] = useState("")
    const [replaceUrlStatus, setReplaceUrlStatus] = useState("Auto-renders")

    const liveContainerRef = useRef<HTMLDivElement | null>(null)
    const editorRef = useRef<HTMLDivElement | null>(null)
    const imageFileInputRef = useRef<HTMLInputElement | null>(null)
    const targetPlaceholderRef = useRef<HTMLElement | null>(null)
    const targetImageRef = useRef<HTMLImageElement | null>(null)
    const isResizingImageRef = useRef(false)
    const urlProbeIdRef = useRef(0)
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    const savedRangeRef = useRef<Range | null>(null)
    const savedTextareaSelRef = useRef<{start: number; end: number}>({start: 0, end: 0})
    const activeSyntaxNodesRef = useRef<HTMLElement[]>([])

    const lastSentMarkdownRef = useRef("")
    const loadedDocIdRef = useRef("")
    const loadedVersionRef = useRef("")
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const historyRef = useRef<string[]>([""])
    const historyIndexRef = useRef<number>(0)

    const syncToolbarState = useCallback(
        (override?: Partial<{sourceMode: boolean; headingLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6}>) => {
            dispatchDocumentToolbarState({
                sourceMode: override?.sourceMode ?? sourceMode,
                canUndo: historyIndexRef.current > 0,
                canRedo: historyIndexRef.current < historyRef.current.length - 1,
                headingLevel: override?.headingLevel ?? headingLevel,
            })
        },
        [headingLevel, sourceMode]
    )

    const scheduleSocketSync = useCallback(
        (nextMarkdown: string) => {
            if (!documentId) return
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
            debounceTimerRef.current = setTimeout(() => {
                const prev = lastSentMarkdownRef.current
                if (prev === nextMarkdown) return
                const diff = computeDocumentDiff(prev, nextMarkdown)
                DocumentationServices.emitContentEdit({
                    id: documentId,
                    content: diff.content,
                    startPos: diff.startPos,
                    lenght: diff.lenght,
                })
                lastSentMarkdownRef.current = nextMarkdown
            }, 500)
        },
        [documentId]
    )

    const pushHistoryAndSync = useCallback(
        (nextMarkdown: string, updateDom = false) => {
            setMarkdown(nextMarkdown)
            if (historyRef.current[historyIndexRef.current] !== nextMarkdown) {
                const nextStack = historyRef.current.slice(0, historyIndexRef.current + 1)
                nextStack.push(nextMarkdown)
                if (nextStack.length > 100) nextStack.shift()
                historyRef.current = nextStack
                historyIndexRef.current = nextStack.length - 1
            }
            if (updateDom && editorRef.current) {
                editorRef.current.innerHTML = renderMarkdownToHtml(nextMarkdown)
            }
            syncToolbarState()
            scheduleSocketSync(nextMarkdown)
        },
        [scheduleSocketSync, syncToolbarState]
    )

    // Initialize or refresh content when documentQuery data arrives
    useEffect(() => {
        if (!documentQuery.data) return
        const {id, content, version} = documentQuery.data
        const isNewDoc = loadedDocIdRef.current !== id
        const isExternalRefresh = loadedVersionRef.current !== version && content !== lastSentMarkdownRef.current

        if (isNewDoc || isExternalRefresh) {
            loadedDocIdRef.current = id
            loadedVersionRef.current = version
            lastSentMarkdownRef.current = content
            setMarkdown(content)
            historyRef.current = [content]
            historyIndexRef.current = 0
            if (editorRef.current) {
                editorRef.current.innerHTML = renderMarkdownToHtml(content)
            }
            syncToolbarState()
        }
    }, [documentQuery.data, syncToolbarState])

    // Populate live DOM when toggling back from Source Mode to Live Mode
    useEffect(() => {
        if (!sourceMode && editorRef.current) {
            editorRef.current.innerHTML = renderMarkdownToHtml(markdown)
        }
        syncToolbarState({sourceMode})
    }, [sourceMode]) // eslint-disable-line react-hooks/exhaustive-deps

    // Listen to socket `document:refresh` (only refetch when payload is true)
    useEffect(() => {
        if (!documentId) return
        return DocumentationServices.onDocumentRefresh((shouldRefresh) => {
            if (shouldRefresh) {
                void documentQuery.refetch()
            }
        })
    }, [documentId, documentQuery])

    // Clean up debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [])

    // Track current selection inside contentEditable so toolbar dropdowns can restore it and syntax markers can be shown
    useEffect(() => {
        const handleSelectionChange = () => {
            const sel = window.getSelection()
            if (!sel || sel.rangeCount === 0 || !editorRef.current) return
            const range = sel.getRangeAt(0)
            if (editorRef.current.contains(range.commonAncestorContainer)) {
                savedRangeRef.current = range.cloneRange()
                let node: Node | null = range.startContainer
                let detectedLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0
                // every formatted ancestor reveals its markers, so nested bold+italic shows `***`
                const activeNodes: HTMLElement[] = []

                while (node && node !== editorRef.current) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const el = node as HTMLElement
                        const tag = el.tagName.toLowerCase()
                        if (/^h[1-6]$/.test(tag)) {
                            detectedLevel = Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6
                        }
                        if (
                            el.classList.contains("md-node") ||
                            /^h[1-6]$/.test(tag) ||
                            ["strong", "b", "em", "i", "code", "del", "mark"].includes(tag)
                        ) {
                            activeNodes.push(el)
                        }
                    }
                    node = node.parentNode
                }

                const prevNodes = activeSyntaxNodesRef.current
                prevNodes.forEach((el) => {
                    if (!activeNodes.includes(el)) el.classList.remove("syntax-active")
                })
                activeNodes.forEach((el) => el.classList.add("syntax-active"))
                activeSyntaxNodesRef.current = activeNodes

                if (detectedLevel !== headingLevel) {
                    setHeadingLevel(detectedLevel)
                    syncToolbarState({headingLevel: detectedLevel})
                }
            } else if (activeSyntaxNodesRef.current.length > 0) {
                activeSyntaxNodesRef.current.forEach((el) => el.classList.remove("syntax-active"))
                activeSyntaxNodesRef.current = []
            }
        }
        document.addEventListener("selectionchange", handleSelectionChange)
        return () => {
            document.removeEventListener("selectionchange", handleSelectionChange)
            activeSyntaxNodesRef.current.forEach((el) => el.classList.remove("syntax-active"))
            activeSyntaxNodesRef.current = []
        }
    }, [headingLevel, syncToolbarState])

    // Live inline & block markdown auto-transformation when typing in contentEditable
    const tryLiveTransform = useLiveTransform({
        editorRef,
        placeCaretAtStart,
        headingClasses: HEADING_CLASSES,
    })

    const syncEditorMarkdown = useCallback(
        (updateDom = false) => {
            if (!editorRef.current) return
            const serialized = htmlToMarkdown(editorRef.current).replace(/\u200B/g, "").replace(/\u00A0/g, " ")
            pushHistoryAndSync(serialized, updateDom)
        },
        [pushHistoryAndSync]
    )

    const {handleCodeBlockKeyDown, handleCodeBlockInput, handleCodeBlockClick} = useCodeBlock({
        editorRef,
        placeCaretAtStart,
        onSyncMarkdown: syncEditorMarkdown,
    })

    const updateImageHoverFromElement = useCallback((img: HTMLImageElement) => {
        const container = liveContainerRef.current
        if (!container) return
        const cRect = container.getBoundingClientRect()
        const iRect = img.getBoundingClientRect()
        setImageHover({
            img,
            left: iRect.left - cRect.left,
            top: iRect.top - cRect.top,
            width: iRect.width,
            height: iRect.height,
        })
    }, [])

    const replacePlaceholderWithImage = useCallback(
        (placeholder: HTMLElement, src: string) => {
            const alt = placeholder.getAttribute("data-alt") ?? "image"
            const img = document.createElement("img")
            img.src = src
            img.alt = alt
            img.className = "max-w-full rounded-lg border border-border my-2 inline-block"
            img.onload = () => {
                if (editorRef.current?.contains(img)) {
                    updateImageHoverFromElement(img)
                }
            }
            placeholder.replaceWith(img)
            syncEditorMarkdown(false)
        },
        [syncEditorMarkdown, updateImageHoverFromElement]
    )

    const probeAndApplyImageUrl = useCallback(
        (
            rawUrl: string,
            onValid: (url: string) => void,
            onStatus?: (status: string) => void
        ) => {
            const url = rawUrl.trim()
            if (!url) {
                onStatus?.("Enter URL")
                return
            }
            if (!/^(?:https?:\/\/|data:image\/)/i.test(url)) {
                onStatus?.("Invalid URL")
                return
            }
            const probeId = ++urlProbeIdRef.current
            onStatus?.("Checking...")
            const probe = new window.Image()
            probe.onload = () => {
                if (urlProbeIdRef.current !== probeId) return
                onValid(url)
            }
            probe.onerror = () => {
                if (urlProbeIdRef.current !== probeId) return
                onStatus?.("Cannot load image")
            }
            probe.src = url
        },
        []
    )

    const handleLiveInput = useCallback((e?: React.FormEvent<HTMLDivElement>) => {
        if (!editorRef.current) return
        const target = e?.target as HTMLElement | undefined
        if (target?.getAttribute("data-image-url-input") === "true") {
            const input = target as HTMLInputElement
            const placeholder = input.closest<HTMLElement>("[data-image-placeholder='true']")
            const statusEl = placeholder?.querySelector<HTMLElement>("[data-image-url-status='true']")
            if (placeholder) {
                probeAndApplyImageUrl(
                    input.value,
                    (validUrl) => replacePlaceholderWithImage(placeholder, validUrl),
                    (status) => {
                        if (statusEl) statusEl.textContent = status
                    }
                )
            }
            return
        }
        if (target?.getAttribute("data-lang-input") === "true") {
            handleCodeBlockInput(e)
        } else {
            tryLiveTransform()
            handleCodeBlockInput(e)
        }
        syncEditorMarkdown(false)
    }, [handleCodeBlockInput, probeAndApplyImageUrl, replacePlaceholderWithImage, syncEditorMarkdown, tryLiveTransform])

    const handleLiveClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (handleCodeBlockClick(e)) return
            const target = e.target as HTMLElement
            const actionBtn = target.closest<HTMLElement>("[data-image-action]")
            if (actionBtn) {
                e.preventDefault()
                const placeholder = actionBtn.closest<HTMLElement>("[data-image-placeholder='true']")
                if (!placeholder) return
                const action = actionBtn.getAttribute("data-image-action")
                if (action === "url") {
                    const urlBox = placeholder.querySelector<HTMLElement>("[data-image-url-box='true']")
                    const urlInput = placeholder.querySelector<HTMLInputElement>("[data-image-url-input='true']")
                    if (urlBox) {
                        urlBox.classList.remove("hidden")
                        urlBox.classList.add("flex")
                    }
                    setTimeout(() => urlInput?.focus(), 0)
                } else if (action === "file") {
                    targetPlaceholderRef.current = placeholder
                    targetImageRef.current = null
                    imageFileInputRef.current?.click()
                }
                return
            }
            if (target.tagName.toLowerCase() === "img") {
                updateImageHoverFromElement(target as HTMLImageElement)
                return
            }
            if (target.tagName.toLowerCase() === "input" && (target as HTMLInputElement).type === "checkbox") {
                setTimeout(() => {
                    syncEditorMarkdown(true)
                }, 0)
            } else if (target.tagName.toLowerCase() === "a" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                const href = (target as HTMLAnchorElement).getAttribute("href")
                if (href) {
                    if (window.electronAPI?.openExternal) {
                        void window.electronAPI.openExternal(href)
                    } else {
                        window.open(href, "_blank", "noopener,noreferrer")
                    }
                }
            }
        },
        [handleCodeBlockClick, syncEditorMarkdown, updateImageHoverFromElement]
    )

    const updateTableHoverFromCell = useCallback((cell: HTMLTableCellElement) => {
        const container = liveContainerRef.current
        const row = cell.closest("tr")
        const table = cell.closest("table")
        if (!container || !row || !table) return
        const cRect = container.getBoundingClientRect()
        const tRect = table.getBoundingClientRect()
        const rRect = row.getBoundingClientRect()
        const cellRect = cell.getBoundingClientRect()
        setTableHover({
            table,
            row,
            colIndex: cell.cellIndex,
            tableLeft: tRect.left - cRect.left,
            tableTop: tRect.top - cRect.top,
            rowTop: rRect.top - cRect.top,
            rowHeight: rRect.height,
            colLeft: cellRect.left - cRect.left,
            colWidth: cellRect.width,
        })
    }, [])

    const handleTableMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (isResizingImageRef.current) return
            const target = e.target as HTMLElement

            if (!target.closest("[data-image-controls='true']")) {
                if (target.tagName.toLowerCase() === "img" && editorRef.current?.contains(target)) {
                    const imgEl = target as HTMLImageElement
                    if (imageHover?.img !== imgEl) {
                        setReplaceUrlOpen(false)
                        setReplaceUrlValue("")
                    }
                    updateImageHoverFromElement(imgEl)
                } else if (imageHover) {
                    if (!editorRef.current?.contains(imageHover.img)) {
                        setImageHover(null)
                        setReplaceUrlOpen(false)
                    } else if (!replaceUrlOpen) {
                        const iRect = imageHover.img.getBoundingClientRect()
                        const nearImg =
                            e.clientX >= iRect.left - 16 &&
                            e.clientX <= iRect.right + 16 &&
                            e.clientY >= iRect.top - 40 &&
                            e.clientY <= iRect.bottom + 16
                        if (!nearImg) {
                            setImageHover(null)
                        }
                    }
                }
            }

            if (target.closest("[data-table-controls='true']")) return
            const cell = findClosestTag(target, ["td", "th"], editorRef.current) as HTMLTableCellElement | null
            if (cell) {
                updateTableHoverFromCell(cell)
                return
            }
            if (tableHover && liveContainerRef.current) {
                if (!editorRef.current?.contains(tableHover.table)) {
                    setTableHover(null)
                    return
                }
                const tRect = tableHover.table.getBoundingClientRect()
                const nearTable =
                    e.clientX >= tRect.left - 110 &&
                    e.clientX <= tRect.right + 12 &&
                    e.clientY >= tRect.top - 36 &&
                    e.clientY <= tRect.bottom + 12
                if (!nearTable) {
                    setTableHover(null)
                }
            }
        },
        [imageHover, replaceUrlOpen, tableHover, updateImageHoverFromElement, updateTableHoverFromCell]
    )

    const handleImageFileChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
                const dataUrl = typeof reader.result === "string" ? reader.result : ""
                if (!dataUrl) return
                if (targetPlaceholderRef.current && editorRef.current?.contains(targetPlaceholderRef.current)) {
                    replacePlaceholderWithImage(targetPlaceholderRef.current, dataUrl)
                    targetPlaceholderRef.current = null
                } else if (targetImageRef.current && editorRef.current?.contains(targetImageRef.current)) {
                    const img = targetImageRef.current
                    img.onload = () => {
                        if (editorRef.current?.contains(img)) {
                            updateImageHoverFromElement(img)
                        }
                    }
                    img.style.width = ""
                    img.style.height = ""
                    img.removeAttribute("data-width")
                    img.removeAttribute("data-height")
                    img.src = dataUrl
                    setReplaceUrlOpen(false)
                    syncEditorMarkdown(false)
                    targetImageRef.current = null
                }
            }
            reader.readAsDataURL(file)
        },
        [replacePlaceholderWithImage, syncEditorMarkdown, updateImageHoverFromElement]
    )

    const startImageResize = useCallback(
        (e: React.MouseEvent, mode: "se" | "sw" | "e" | "s") => {
            e.preventDefault()
            e.stopPropagation()
            if (!imageHover || !editorRef.current?.contains(imageHover.img)) return
            const img = imageHover.img
            const startX = e.clientX
            const startY = e.clientY
            const startRect = img.getBoundingClientRect()
            const startWidth = startRect.width
            const startHeight = startRect.height
            const aspectRatio =
                img.naturalWidth > 0 && img.naturalHeight > 0
                    ? img.naturalWidth / img.naturalHeight
                    : startWidth / Math.max(1, startHeight)
            isResizingImageRef.current = true

            const onMouseMove = (moveEvent: MouseEvent) => {
                const dx = moveEvent.clientX - startX
                const dy = moveEvent.clientY - startY
                let nextW: number
                let nextH: number
                if (mode === "s") {
                    nextH = Math.max(40, Math.round(startHeight + dy))
                    nextW = Math.max(60, Math.round(nextH * aspectRatio))
                } else {
                    const rawW = mode === "sw" ? startWidth - dx : startWidth + dx
                    nextW = Math.max(60, Math.round(rawW))
                    nextH = Math.max(40, Math.round(nextW / aspectRatio))
                }
                img.style.width = `${nextW}px`
                img.style.height = `${nextH}px`
                img.setAttribute("data-width", String(nextW))
                img.setAttribute("data-height", String(nextH))
                updateImageHoverFromElement(img)
            }

            const onMouseUp = () => {
                isResizingImageRef.current = false
                window.removeEventListener("mousemove", onMouseMove)
                window.removeEventListener("mouseup", onMouseUp)
                updateImageHoverFromElement(img)
                syncEditorMarkdown(false)
            }

            window.addEventListener("mousemove", onMouseMove)
            window.addEventListener("mouseup", onMouseUp)
        },
        [imageHover, syncEditorMarkdown, updateImageHoverFromElement]
    )

    const handleInsertRowBelow = useCallback(() => {
        if (!tableHover || !editorRef.current?.contains(tableHover.table)) return
        const {table, row, colIndex} = tableHover
        const headerCells = Array.from(table.querySelectorAll<HTMLElement>("thead tr th, thead tr td"))
        const colCount = headerCells.length || row.children.length || 1
        const newTr = document.createElement("tr")
        newTr.className = "even:bg-muted/20"
        for (let i = 0; i < colCount; i++) {
            const td = document.createElement("td")
            td.style.textAlign = headerCells[i]?.style.textAlign || "left"
            td.className = "border border-border px-3 py-2 text-sm text-foreground"
            td.textContent = "\u200B"
            newTr.appendChild(td)
        }
        let tbody = table.querySelector("tbody")
        if (!tbody) {
            tbody = document.createElement("tbody")
            table.appendChild(tbody)
        }
        if (row.parentElement?.tagName.toLowerCase() === "thead") {
            tbody.insertBefore(newTr, tbody.firstChild)
        } else {
            row.parentElement?.insertBefore(newTr, row.nextSibling)
        }
        const targetCell = (newTr.children[colIndex] ?? newTr.firstElementChild) as HTMLTableCellElement | null
        if (targetCell) {
            placeCaretAtStart(targetCell)
            updateTableHoverFromCell(targetCell)
        }
        syncEditorMarkdown(false)
    }, [syncEditorMarkdown, tableHover, updateTableHoverFromCell])

    const handleInsertColRight = useCallback(() => {
        if (!tableHover || !editorRef.current?.contains(tableHover.table)) return
        const {table, row, colIndex} = tableHover
        table.querySelectorAll("thead tr").forEach((tr) => {
            const th = document.createElement("th")
            th.style.textAlign = "left"
            th.className = "border border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground"
            th.textContent = `Header ${tr.children.length + 1}`
            tr.insertBefore(th, tr.children[colIndex + 1] ?? null)
        })
        table.querySelectorAll("tbody tr").forEach((tr) => {
            const td = document.createElement("td")
            td.style.textAlign = "left"
            td.className = "border border-border px-3 py-2 text-sm text-foreground"
            td.textContent = "\u200B"
            tr.insertBefore(td, tr.children[colIndex + 1] ?? null)
        })
        const targetCell = (row.children[colIndex + 1] ?? row.lastElementChild) as HTMLTableCellElement | null
        if (targetCell) {
            placeCaretAtStart(targetCell)
            updateTableHoverFromCell(targetCell)
        }
        syncEditorMarkdown(false)
    }, [syncEditorMarkdown, tableHover, updateTableHoverFromCell])

    const handleRemoveRow = useCallback(() => {
        if (!tableHover || !editorRef.current?.contains(tableHover.table)) return
        const {table, row, colIndex} = tableHover
        const isHeaderRow = row.parentElement?.tagName.toLowerCase() === "thead"
        const tbody = table.querySelector("tbody")

        if (isHeaderRow) {
            const firstBodyRow = tbody?.querySelector("tr")
            if (!firstBodyRow) {
                ;(table.closest("div.my-4") ?? table).remove()
                setTableHover(null)
                syncEditorMarkdown(false)
                return
            }
            const promotedTr = document.createElement("tr")
            Array.from(firstBodyRow.children).forEach((cell, idx) => {
                const th = document.createElement("th")
                th.style.textAlign = (row.children[idx] as HTMLElement | undefined)?.style.textAlign || "left"
                th.className = "border border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-foreground"
                th.innerHTML = cell.innerHTML || `Header ${idx + 1}`
                promotedTr.appendChild(th)
            })
            firstBodyRow.remove()
            row.replaceWith(promotedTr)
            const targetCell = (promotedTr.children[colIndex] ?? promotedTr.firstElementChild) as HTMLTableCellElement | null
            if (targetCell) {
                placeCaretAtStart(targetCell)
                updateTableHoverFromCell(targetCell)
            } else {
                setTableHover(null)
            }
            syncEditorMarkdown(false)
            return
        }

        const nextRow = (row.nextElementSibling ?? row.previousElementSibling ?? table.querySelector("thead tr")) as HTMLTableRowElement | null
        row.remove()
        if (!table.querySelector("tr")) {
            ;(table.closest("div.my-4") ?? table).remove()
            setTableHover(null)
        } else if (nextRow) {
            const targetCell = (nextRow.children[Math.min(colIndex, nextRow.children.length - 1)] ?? nextRow.firstElementChild) as HTMLTableCellElement | null
            if (targetCell) {
                placeCaretAtStart(targetCell)
                updateTableHoverFromCell(targetCell)
            } else {
                setTableHover(null)
            }
        } else {
            setTableHover(null)
        }
        syncEditorMarkdown(false)
    }, [syncEditorMarkdown, tableHover, updateTableHoverFromCell])

    const handleRemoveCol = useCallback(() => {
        if (!tableHover || !editorRef.current?.contains(tableHover.table)) return
        const {table, row, colIndex} = tableHover
        if (row.children.length <= 1) {
            ;(table.closest("div.my-4") ?? table).remove()
            setTableHover(null)
            syncEditorMarkdown(false)
            return
        }
        table.querySelectorAll("tr").forEach((tr) => {
            tr.children[colIndex]?.remove()
        })
        const nextIdx = Math.min(colIndex, row.children.length - 1)
        const targetCell = row.children[nextIdx] as HTMLTableCellElement | undefined
        if (targetCell) {
            placeCaretAtStart(targetCell)
            updateTableHoverFromCell(targetCell)
        } else {
            setTableHover(null)
        }
        syncEditorMarkdown(false)
    }, [syncEditorMarkdown, tableHover, updateTableHoverFromCell])

    // Apply toolbar action to Markdown string (supports both selected ranges in Source mode and Live mode)
    const applyMarkdownTransform = useApplyMarkdownTransform({
        sourceMode,
        setSourceMode,
        markdown,
        setMarkdown,
        editorRef,
        textareaRef,
        savedRangeRef,
        savedTextareaSelRef,
        historyRef,
        historyIndexRef,
        syncToolbarState,
        scheduleSocketSync,
        pushHistoryAndSync,
        setHeadingLevel,
        findClosestTag,
        headingClasses: HEADING_CLASSES,
    })

    if (documentQuery.isLoading) {
        return (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-2 p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600"/>
                <span className="text-xs font-medium">Loading document...</span>
            </div>
        )
    }

    return (
        <div className="flex min-h-[calc(100dvh-260px)] flex-col">
            <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-muted/20">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-sky-600"/>
                    <h2 className="text-sm font-semibold text-foreground">
                        {documentQuery.data?.name || activeTab?.label || "Markdown Editor"}
                    </h2>
                    <span className="rounded bg-sky-100 dark:bg-sky-950/60 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                        {documentId}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500"/>
                    <span>
                        {sourceMode
                            ? "Source Markdown Mode (Auto-syncs in 500ms)"
                            : "Live Markdown Mode — type *bold*, # heading, - list, ~~strike~~ or select text & use toolbar"}
                    </span>
                </div>
            </div>

            {sourceMode ? (
                <div className="grid flex-1 grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
                    <div className="flex flex-col p-4">
                        <span className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Markdown Source
                        </span>
                        <textarea
                            ref={textareaRef}
                            value={markdown}
                            onChange={(e) => {
                                pushHistoryAndSync(e.target.value, false)
                            }}
                            onSelect={(e) => {
                                const target = e.currentTarget
                                savedTextareaSelRef.current = {
                                    start: target.selectionStart,
                                    end: target.selectionEnd,
                                }
                            }}
                            onKeyDown={(e) => {
                                if (BRACKET_PAIRS[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
                                    const ta = e.currentTarget
                                    const start = ta.selectionStart
                                    const end = ta.selectionEnd
                                    if (start !== end) {
                                        e.preventDefault()
                                        const selected = markdown.slice(start, end)
                                        const closeChar = BRACKET_PAIRS[e.key]
                                        const next = markdown.slice(0, start) + e.key + selected + closeChar + markdown.slice(end)
                                        pushHistoryAndSync(next, false)
                                        setTimeout(() => {
                                            ta.setSelectionRange(start + 1, end + 1)
                                        }, 0)
                                        return
                                    }
                                }
                                if (e.key === "Tab") {
                                    e.preventDefault()
                                    const ta = e.currentTarget
                                    const start = ta.selectionStart
                                    const end = ta.selectionEnd
                                    if (!e.shiftKey) {
                                        const next = markdown.slice(0, start) + "  " + markdown.slice(end)
                                        pushHistoryAndSync(next, false)
                                        setTimeout(() => {
                                            ta.setSelectionRange(start + 2, start + 2)
                                        }, 0)
                                    } else {
                                        const lineStart = markdown.lastIndexOf("\n", start - 1) + 1
                                        if (markdown.slice(lineStart, lineStart + 2) === "  ") {
                                            const next = markdown.slice(0, lineStart) + markdown.slice(lineStart + 2)
                                            pushHistoryAndSync(next, false)
                                            setTimeout(() => {
                                                ta.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2))
                                            }, 0)
                                        }
                                    }
                                }
                            }}
                            placeholder="Write your Markdown here..."
                            className="min-h-[460px] w-full flex-1 resize-y rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex flex-col p-4">
                        <span className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Rendered Preview
                        </span>
                        <div
                            className="min-h-[460px] flex-1 rounded-lg border border-border/60 bg-background/50 p-5 text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{__html: renderMarkdownToHtml(markdown)}}
                        />
                    </div>
                </div>
            ) : (
                <div
                    ref={liveContainerRef}
                    className="relative flex-1 p-6"
                    onMouseMove={handleTableMouseMove}
                    onMouseLeave={() => {
                        setTableHover(null)
                        if (!isResizingImageRef.current && !replaceUrlOpen) {
                            setImageHover(null)
                        }
                    }}
                >
                    <input
                        ref={imageFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                    />
                    {imageHover && (
                        <div
                            data-image-controls="true"
                            style={{
                                top: imageHover.top,
                                left: imageHover.left,
                                width: imageHover.width,
                                height: imageHover.height,
                            }}
                            className="pointer-events-none absolute z-20 rounded-lg border-2 border-indigo-500/80 select-none"
                        >
                            <div
                                data-image-controls="true"
                                onMouseDown={(e) => {
                                    if ((e.target as HTMLElement).tagName.toLowerCase() !== "input") {
                                        e.preventDefault()
                                    }
                                }}
                                className="pointer-events-auto absolute top-2 right-2 flex flex-col items-end gap-1.5"
                            >
                                <div className="flex items-center gap-1 rounded-md border border-border bg-background/95 p-1 shadow-md backdrop-blur">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReplaceUrlOpen((prev) => !prev)
                                            setReplaceUrlValue(imageHover.img.src.startsWith("data:") ? "" : imageHover.img.src)
                                            setReplaceUrlStatus("Auto-renders")
                                        }}
                                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
                                    >
                                        <Link2 className="h-3 w-3"/>
                                        Use URL
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            targetImageRef.current = imageHover.img
                                            targetPlaceholderRef.current = null
                                            imageFileInputRef.current?.click()
                                        }}
                                        className="inline-flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-500"
                                    >
                                        <Upload className="h-3 w-3"/>
                                        Select File
                                    </button>
                                </div>
                                {replaceUrlOpen && (
                                    <div className="flex w-72 items-center gap-1.5 rounded-md border border-border bg-background/95 p-1.5 shadow-lg backdrop-blur">
                                        <input
                                            type="url"
                                            value={replaceUrlValue}
                                            autoFocus
                                            placeholder="Paste image URL (https://...)"
                                            onChange={(e) => {
                                                const nextVal = e.target.value
                                                setReplaceUrlValue(nextVal)
                                                probeAndApplyImageUrl(
                                                    nextVal,
                                                    (validUrl) => {
                                                        if (!editorRef.current?.contains(imageHover.img)) return
                                                        imageHover.img.onload = () => {
                                                            if (editorRef.current?.contains(imageHover.img)) {
                                                                updateImageHoverFromElement(imageHover.img)
                                                            }
                                                        }
                                                        imageHover.img.style.width = ""
                                                        imageHover.img.style.height = ""
                                                        imageHover.img.removeAttribute("data-width")
                                                        imageHover.img.removeAttribute("data-height")
                                                        imageHover.img.src = validUrl
                                                        setReplaceUrlOpen(false)
                                                        syncEditorMarkdown(false)
                                                    },
                                                    setReplaceUrlStatus
                                                )
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Escape") {
                                                    e.preventDefault()
                                                    setReplaceUrlOpen(false)
                                                }
                                            }}
                                            className="h-7 flex-1 rounded border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-indigo-500"
                                        />
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {replaceUrlStatus}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="pointer-events-none absolute bottom-1.5 left-2 rounded bg-slate-900/80 px-1.5 py-0.5 font-mono text-[10px] text-white">
                                {Math.round(imageHover.width)} × {Math.round(imageHover.height)}
                            </div>

                            <div
                                data-image-controls="true"
                                onMouseDown={(e) => startImageResize(e, "e")}
                                title="Drag to resize width"
                                className="pointer-events-auto absolute top-1/2 -right-1.5 h-8 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-full border border-white bg-indigo-600 shadow"
                            />
                            <div
                                data-image-controls="true"
                                onMouseDown={(e) => startImageResize(e, "s")}
                                title="Drag to resize height"
                                className="pointer-events-auto absolute -bottom-1.5 left-1/2 h-2.5 w-8 -translate-x-1/2 cursor-ns-resize rounded-full border border-white bg-indigo-600 shadow"
                            />
                            <div
                                data-image-controls="true"
                                onMouseDown={(e) => startImageResize(e, "sw")}
                                title="Drag to resize"
                                className="pointer-events-auto absolute -bottom-1.5 -left-1.5 h-3.5 w-3.5 cursor-nesw-resize rounded-sm border border-white bg-indigo-600 shadow"
                            />
                            <div
                                data-image-controls="true"
                                onMouseDown={(e) => startImageResize(e, "se")}
                                title="Drag to resize"
                                className="pointer-events-auto absolute -right-1.5 -bottom-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border border-white bg-indigo-600 shadow"
                            />
                        </div>
                    )}
                    {tableHover && (
                        <>
                            <div
                                data-table-controls="true"
                                style={{
                                    top: tableHover.rowTop + tableHover.rowHeight / 2,
                                    left: Math.max(4, tableHover.tableLeft - 88),
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                                className="absolute z-20 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-background px-1 py-0.5 shadow-sm select-none"
                            >
                                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/70"/>
                                <Pin className="h-3 w-3 text-muted-foreground"/>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={handleInsertRowBelow}
                                    className="group relative flex h-5 w-5 items-center justify-center rounded text-foreground hover:bg-muted"
                                >
                                    <Plus className="h-3.5 w-3.5"/>
                                    <span className="pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-md group-hover:block">
                                        Insert 1 row below
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={handleRemoveRow}
                                    className="group relative flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                                >
                                    <Trash2 className="h-3.5 w-3.5"/>
                                    <span className="pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-md group-hover:block">
                                        Delete row
                                    </span>
                                </button>
                            </div>
                            <div
                                data-table-controls="true"
                                style={{
                                    top: Math.max(4, tableHover.tableTop - 13),
                                    left: tableHover.colLeft + tableHover.colWidth - 46,
                                }}
                                onMouseDown={(e) => e.preventDefault()}
                                className="absolute z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-background px-1.5 py-0.5 shadow-sm select-none"
                            >
                                <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/70"/>
                                <AlignLeft className="h-3 w-3 text-muted-foreground"/>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={handleInsertColRight}
                                    className="group relative flex h-5 w-5 items-center justify-center rounded text-foreground hover:bg-muted"
                                >
                                    <Plus className="h-3.5 w-3.5"/>
                                    <span className="pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-md group-hover:block">
                                        Insert 1 column to the right
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={handleRemoveCol}
                                    className="group relative flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                                >
                                    <Trash2 className="h-3.5 w-3.5"/>
                                    <span className="pointer-events-none absolute top-full left-1/2 z-30 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white shadow-md group-hover:block">
                                        Delete column
                                    </span>
                                </button>
                            </div>
                        </>
                    )}
                    <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={handleLiveInput}
                        onClick={handleLiveClick}
                        onKeyDown={(e) => {
                            const keyTarget = e.target as HTMLElement | null
                            if (keyTarget?.getAttribute("data-image-url-input") === "true") {
                                if (e.key === "Enter" || e.key === "Escape") {
                                    e.preventDefault()
                                    if (e.key === "Escape") {
                                        const box = keyTarget.closest<HTMLElement>("[data-image-url-box='true']")
                                        if (box) {
                                            box.classList.add("hidden")
                                            box.classList.remove("flex")
                                        }
                                    }
                                }
                                return
                            }
                            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                                e.preventDefault()
                                if (e.shiftKey) {
                                    applyMarkdownTransform({type: "redo"})
                                } else {
                                    applyMarkdownTransform({type: "undo"})
                                }
                                return
                            }
                            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
                                e.preventDefault()
                                applyMarkdownTransform({type: "redo"})
                                return
                            }
                            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
                                e.preventDefault()
                                applyMarkdownTransform({type: "bold"})
                                return
                            }
                            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
                                e.preventDefault()
                                applyMarkdownTransform({type: "italic"})
                                return
                            }

                            if (handleCodeBlockKeyDown(e)) {
                                return
                            }

                            // 2. Bracket wrapping on selection
                            if (!e.ctrlKey && !e.metaKey && !e.altKey && BRACKET_PAIRS[e.key]) {
                                const sel = window.getSelection()
                                if (
                                    sel &&
                                    !sel.isCollapsed &&
                                    sel.rangeCount > 0 &&
                                    editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)
                                ) {
                                    const selectedText = sel.toString()
                                    if (selectedText.length > 0) {
                                        e.preventDefault()
                                        const closeChar = BRACKET_PAIRS[e.key]
                                        const wrapped = `${e.key}${selectedText}${closeChar}`
                                        document.execCommand("insertText", false, wrapped)
                                        handleLiveInput()
                                        return
                                    }
                                }
                            }

                            // 3. Tab key indentation and list hierarchy
                            if (e.key === "Tab") {
                                e.preventDefault()
                                const sel = window.getSelection()
                                if (!sel || sel.rangeCount === 0 || !editorRef.current) return

                                // List item Tab / Shift+Tab
                                const li = findClosestTag(sel.anchorNode, ["li"], editorRef.current)
                                if (li) {
                                    if (!e.shiftKey) {
                                        const prevLi = li.previousElementSibling as HTMLElement | null
                                        if (prevLi) {
                                            let subList = prevLi.querySelector("ul, ol")
                                            if (!subList) {
                                                const parentTag = li.parentElement?.tagName.toLowerCase() === "ol" ? "ol" : "ul"
                                                subList = document.createElement(parentTag)
                                                subList.className =
                                                    parentTag === "ol"
                                                        ? "my-1 space-y-1 list-decimal pl-6"
                                                        : "my-1 space-y-1 list-disc pl-6"
                                                prevLi.appendChild(subList)
                                            }
                                            subList.appendChild(li)
                                            placeCaretAtStart(li)
                                            syncEditorMarkdown(false)
                                            return
                                        }
                                    } else {
                                        const parentList = li.parentElement
                                        const grandParentLi = parentList?.parentElement
                                        if (grandParentLi && grandParentLi.tagName.toLowerCase() === "li") {
                                            grandParentLi.parentElement?.insertBefore(li, grandParentLi.nextSibling)
                                            if (parentList && parentList.children.length === 0) {
                                                parentList.remove()
                                            }
                                            placeCaretAtStart(li)
                                            syncEditorMarkdown(false)
                                            return
                                        } else if (parentList && parentList.parentElement === editorRef.current) {
                                            const p = document.createElement("p")
                                            p.className = "my-2.5 leading-7 text-foreground"
                                            p.innerHTML = li.innerHTML || "<br />"
                                            parentList.parentElement.insertBefore(p, parentList.nextSibling)
                                            li.remove()
                                            if (parentList.children.length === 0) {
                                                parentList.remove()
                                            }
                                            placeCaretAtStart(p)
                                            syncEditorMarkdown(false)
                                            return
                                        }
                                    }
                                    return
                                }

                                // Normal line Tab / Shift+Tab
                                if (!e.shiftKey) {
                                    document.execCommand("insertText", false, "  ")
                                    handleLiveInput()
                                } else {
                                    let block: HTMLElement | null = sel.anchorNode
                                        ? sel.anchorNode.nodeType === Node.TEXT_NODE
                                            ? sel.anchorNode.parentElement
                                            : (sel.anchorNode as HTMLElement)
                                        : null
                                    while (block && block.parentElement && block.parentElement !== editorRef.current) {
                                        block = block.parentElement
                                    }
                                    if (block) {
                                        const text = block.textContent ?? ""
                                        if (text.startsWith("  ")) {
                                            if (block.firstChild && block.firstChild.nodeType === Node.TEXT_NODE) {
                                                block.firstChild.textContent = (block.firstChild.textContent ?? "").replace(/^ {2}/, "")
                                                handleLiveInput()
                                            }
                                        }
                                    }
                                }
                                return
                            }
                        }}
                        data-placeholder="Start typing Markdown (e.g. # Heading, *Bold me*, - list item)..."
                        className="min-h-[480px] w-full rounded-xl border border-transparent pl-16 pr-4 py-2 text-sm leading-relaxed text-foreground outline-none focus:border-indigo-500/30 focus:bg-background/60 empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
                    />
                    <datalist id="code-block-languages">
                        {SUPPORTED_CODE_LANGUAGES.map((lang) => (
                            <option key={lang} value={lang}/>
                        ))}
                    </datalist>
                </div>
            )}
        </div>
    )
}

export default DocumentEditor
