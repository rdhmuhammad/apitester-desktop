import React, { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { VariableDialog, type VariableDialogRef } from "./VariableDialog.tsx"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip.tsx"
import { useCollectionVariables } from "@/layout/hooks/useCollectionVariables.ts"
import { cn } from "@/lib/utils.ts"
import { Eye, EyeOff } from "lucide-react"

export interface VariableInputProps
    extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    onValueChange?: (value: string) => void
    inputClassName?: string
}

function getInputCursorCoordinates(
    input: HTMLInputElement,
    cursorIndex: number
): { x: number; y: number } {
    const rect = input.getBoundingClientRect()
    const style = window.getComputedStyle(input)

    const mirror = document.createElement("span")
    mirror.style.fontFamily = style.fontFamily
    mirror.style.fontSize = style.fontSize
    mirror.style.fontWeight = style.fontWeight
    mirror.style.letterSpacing = style.letterSpacing
    mirror.style.whiteSpace = "pre"
    mirror.style.visibility = "hidden"
    mirror.style.position = "absolute"
    mirror.style.top = "-9999px"
    mirror.style.left = "-9999px"

    const textBefore = input.value.slice(0, cursorIndex)
    mirror.textContent = textBefore || " "
    document.body.appendChild(mirror)
    const textWidth = textBefore ? mirror.getBoundingClientRect().width : 0
    document.body.removeChild(mirror)

    const paddingLeft = parseFloat(style.paddingLeft) || 0
    const x = rect.left + paddingLeft + textWidth - input.scrollLeft
    const y = rect.bottom

    return { x, y }
}

export const VariableInput = React.forwardRef<HTMLInputElement, VariableInputProps>(
    (
        {
            value = "",
            onChange,
            onValueChange,
            className,
            inputClassName,
            type = "text",
            disabled,
            readOnly,
            placeholder,
            ...props
        },
        ref
    ) => {
        const inputRef = useRef<HTMLInputElement | null>(null)
        const overlayRef = useRef<HTMLDivElement | null>(null)
        const dialogRef = useRef<VariableDialogRef>(null)
        const { variables } = useCollectionVariables()

        const [isDialogOpen, setIsDialogOpen] = useState(false)
        const [dialogPosition, setDialogPosition] = useState({ x: 0, y: 0 })
        const [dialogFilter, setDialogFilter] = useState("")
        const [showPassword, setShowPassword] = useState(false)

        const isPassword = type === "password"
        const effectiveType = isPassword ? (showPassword ? "text" : "password") : type

        // Fast variable lookup map
        const variablesMap = useMemo(() => {
            const map = new Map<string, string>()
            for (const v of variables) {
                if (v.key) {
                    map.set(v.key, v.value)
                }
            }
            return map
        }, [variables])

        // Parse value into normal text and {{anyword}} tokens
        const tokens = useMemo(() => {
            if (!value || (isPassword && !showPassword)) return []
            const parts: { text: string; isVariable: boolean; key?: string }[] = []
            const regex = /(\{\{[^{}]+\}\})/g
            let lastIndex = 0
            let match: RegExpExecArray | null

            while ((match = regex.exec(value)) !== null) {
                if (match.index > lastIndex) {
                    parts.push({
                        text: value.slice(lastIndex, match.index),
                        isVariable: false,
                    })
                }
                const tokenStr = match[0]
                const key = tokenStr.slice(2, -2).trim()
                parts.push({
                    text: tokenStr,
                    isVariable: true,
                    key,
                })
                lastIndex = regex.lastIndex
            }

            if (lastIndex < value.length) {
                parts.push({
                    text: value.slice(lastIndex),
                    isVariable: false,
                })
            }

            return parts
        }, [value, isPassword, showPassword])

        const hasVariables = useMemo(() => {
            return tokens.some((t) => t.isVariable)
        }, [tokens])

        const syncScroll = useCallback(() => {
            if (inputRef.current && overlayRef.current) {
                overlayRef.current.scrollLeft = inputRef.current.scrollLeft
            }
        }, [])

        useEffect(() => {
            syncScroll()
        }, [value, syncScroll])

        // Check if cursor is right after "{{" or "{{partial"
        const checkForVariableTrigger = useCallback(
            (input: HTMLInputElement) => {
                if (readOnly || disabled) return
                const cursor = input.selectionStart ?? 0
                const textBefore = input.value.slice(0, cursor)

                // Match unclosed {{ before cursor
                const lastDoubleOpen = textBefore.lastIndexOf("{{")
                if (lastDoubleOpen !== -1) {
                    const remainder = textBefore.slice(lastDoubleOpen + 2)
                    if (!remainder.includes("}")) {
                        const coords = getInputCursorCoordinates(input, cursor)
                        setDialogPosition(coords)
                        setDialogFilter(remainder)
                        setIsDialogOpen(true)
                        return
                    }
                }
                setIsDialogOpen(false)
            },
            [readOnly, disabled]
        )

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(e)
            onValueChange?.(e.target.value)
            checkForVariableTrigger(e.target)
        }

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (isDialogOpen && dialogRef.current?.handleKeyDown(e)) {
                return
            }
            if (e.key === "Escape" && isDialogOpen) {
                setIsDialogOpen(false)
            }
            props.onKeyDown?.(e)
        }

        const handleKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.currentTarget) {
                checkForVariableTrigger(e.currentTarget)
            }
            props.onKeyUp?.(e)
        }

        const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
            if (e.currentTarget) {
                checkForVariableTrigger(e.currentTarget)
            }
            props.onClick?.(e)
        }

        // Apply selected variable key to input
        const handleSelectVariable = (selectedKey: string) => {
            const input = inputRef.current
            if (!input) return

            const cursor = input.selectionStart ?? input.value.length
            const textBefore = input.value.slice(0, cursor)
            const textAfter = input.value.slice(cursor)

            const lastDoubleOpen = textBefore.lastIndexOf("{{")
            if (lastDoubleOpen !== -1) {
                const beforeBraces = textBefore.slice(0, lastDoubleOpen)
                const nextValue = `${beforeBraces}{{${selectedKey}}}${textAfter}`
                const newCursorPos = beforeBraces.length + selectedKey.length + 4

                // Trigger change
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    "value"
                )?.set
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(input, nextValue)
                } else {
                    input.value = nextValue
                }

                const ev = new Event("input", { bubbles: true })
                input.dispatchEvent(ev)

                onValueChange?.(nextValue)

                setTimeout(() => {
                    input.focus()
                    input.setSelectionRange(newCursorPos, newCursorPos)
                    syncScroll()
                }, 0)
            }

            setIsDialogOpen(false)
        }

        return (
            <TooltipProvider delayDuration={150}>
                <div className={cn("relative flex items-center w-full min-w-0", className)}>
                    {/* Native Input */}
                    <input
                        ref={(node) => {
                            inputRef.current = node
                            if (typeof ref === "function") ref(node)
                            else if (ref) ref.current = node
                        }}
                        type={effectiveType}
                        value={value}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onKeyUp={handleKeyUp}
                        onClick={handleClick}
                        onScroll={syncScroll}
                        disabled={disabled}
                        readOnly={readOnly}
                        placeholder={placeholder}
                        data-slot="input"
                        className={cn(
                            "file:text-foreground placeholder:text-muted-foreground selection:bg-primary/20 dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm font-mono shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
                            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                            hasVariables && "text-transparent caret-foreground",
                            isPassword && "pr-8",
                            inputClassName
                        )}
                        {...props}
                    />

                    {/* Overlay layer rendering highlighted {{variable}} badges and normal text */}
                    {hasVariables && (
                        <div
                            ref={overlayRef}
                            aria-hidden="true"
                            className={cn(
                                "pointer-events-none absolute inset-0 flex items-center overflow-x-hidden whitespace-pre px-3 py-1 text-sm font-mono border border-transparent select-none",
                                isPassword && "pr-8",
                                disabled && "opacity-50"
                            )}
                        >
                            {tokens.map((token, index) => {
                                if (!token.isVariable) {
                                    return (
                                        <span key={index} className="text-foreground">
                                            {token.text}
                                        </span>
                                    )
                                }

                                const varKey = token.key ?? ""
                                const isFound = variablesMap.has(varKey)
                                const varVal = variablesMap.get(varKey)

                                return (
                                    <Tooltip key={index}>
                                        <TooltipTrigger asChild>
                                            <span
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    inputRef.current?.focus()
                                                }}
                                                className={cn(
                                                    "pointer-events-auto cursor-pointer rounded px-0.5 font-bold transition-colors inline-block",
                                                    isFound
                                                        ? "bg-emerald-500/70 text-emerald-950 dark:bg-emerald-500/70 dark:text-emerald-50"
                                                        : "bg-rose-500/70 text-rose-950 dark:bg-rose-500/70 dark:text-rose-50"
                                                )}
                                            >
                                                {token.text}
                                            </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">
                                            {isFound ? (
                                                <div className="text-xs">
                                                    <span className="font-semibold">{varKey}: </span>
                                                    <span>{varVal}</span>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-rose-300">
                                                    Variable not found
                                                </div>
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                )
                            })}
                        </div>
                    )}

                    {/* Password visibility toggle */}
                    {isPassword && (
                        <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-2 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                        >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    )}

                    {/* Variable auto-complete dialog */}
                    <VariableDialog
                        ref={dialogRef}
                        open={isDialogOpen}
                        position={dialogPosition}
                        initialSearch={dialogFilter}
                        onSelect={handleSelectVariable}
                        onClose={() => setIsDialogOpen(false)}
                    />
                </div>
            </TooltipProvider>
        )
    }
)

VariableInput.displayName = "VariableInput"

export default VariableInput
