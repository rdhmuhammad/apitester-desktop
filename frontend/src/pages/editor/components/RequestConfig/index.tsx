import React, {useEffect, useState} from "react"
import {Badge} from "@/components/ui/badge.tsx"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx"
import {Input} from "@/components/ui/input.tsx"
import {Button} from "@/components/ui/button.tsx"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx"
import {cn} from "@/lib/utils.ts"
import {Eye, EyeOff, FileJson2, FileText, Plus, ToggleLeft, ToggleRight, Trash2} from "lucide-react"
import {AuthDropdownOps, AuthLabel, type AuthType} from "@/pages/editor/components/RequestConfig/AuthContent.tsx"
import {BodyEditor, type ContentType} from "@/pages/editor/components/RequestConfig/BodyEditor.tsx"
import ScriptEditor from "@/pages/editor/components/RequestConfig/ScriptEditor.tsx"
import {useAppSelector} from "@/app/store/hooks.ts"
import {selectEditorActiveTabId} from "@/app/slices/editorTabsSlice.ts"
import {useQueryClient} from "@tanstack/react-query"
import {type Collection} from "@/layout/services/collection"
import {useDebouncedCallback} from "use-debounce"
import {useRequestConfig} from "@/pages/editor/hooks/useRequestConfig.ts"
import type {RestRequestResponse} from "@/pages/editor/services/requestConfig.ts"
import type {CollectionAuth, ItemUrl} from "@/pages/editor/types/api.ts"
import {useCollection} from "@/layout/hooks/useCollection.ts";

const RequestConfigTabs: React.FC = () => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)
    const queryClient = useQueryClient()
    const activeCollection = queryClient.getQueryData<Collection>(["collection", "active"])
    const {
        request, updateHeaders, updateQuery,
        updateJsonBody, updateFormDataBody,
        updateAuth,
        saveScript,
    } = useRequestConfig(activeCollection?.id ?? "", activeTabId)
    const {
        auth
    } = useCollection(activeCollection?.id ?? "")

    const resolveAuthFromRequest = (req?: RestRequestResponse | null): { type: AuthType; token: string } => {
        const auth = req?.auth
        if (!auth)
            return {
                type: "none",
                token: ""
            }
        const source = auth.authSource?.toLowerCase()
        let type: AuthType = "none"
        if (source === "onrequest" || (!source && auth.type?.toLowerCase() === "bearer")) {
            type = "onrequest"
        } else if (source === "inherit") {
            type = "inherit"
        } else if (source === "none") {
            type = "none"
        }
        const tokenProperty = auth.bearer?.find((item) => item.key?.toLowerCase() === "token")
        let token = tokenProperty?.value ?? auth.bearer?.[0]?.value ?? ""
        if (!token && type === "onrequest") {
            const authHeader = req?.headers?.find((h) => h.key.trim().toLowerCase() === "authorization")
            if (authHeader && authHeader.value) {
                const headerVal = authHeader.value.trim()
                token = headerVal.toLowerCase().startsWith("bearer ") ? headerVal.slice(7).trim() : headerVal
            }
        }
        return {type, token}
    }

    const [newParamKey, setNewParamKey] = useState("")
    const [newParamValue, setNewParamValue] = useState("")
    const [newParamDesc, setNewParamDesc] = useState("")
    const [newHeaderKey, setNewHeaderKey] = useState("")
    const [newHeaderValue, setNewHeaderValue] = useState("")
    const [showSysHeader, setShowSysHeader] = useState(false)
    const [contentType, setContentType] = useState<ContentType>(request?.body?.mode === "formdata" ? "multipart/form-data" : "application/json")
    const [authType, setAuthType] = useState<AuthType>("none")
    const [bearerToken, setBearerToken] = useState("")

    useEffect(() => {
        const resolved = resolveAuthFromRequest(request)
        setAuthType(resolved.type)
        setBearerToken(resolved.token)
    }, [request?.id, request?.auth])

    const handleAuthTypeChange = async (newType: AuthType) => {
        setAuthType(newType)

        if (newType === "onrequest") {
            const updatedReq = await updateAuth({
                type: "bearer",
                authSource: "onrequest",
                bearer: [
                    {
                        id: crypto.randomUUID(),
                        key: "token",
                        value: bearerToken,
                        type: "string",
                    },
                ],
            })

            const currentHeaders = updatedReq?.headers ?? request?.headers ?? []
            const authHeaderValue = bearerToken.trim().toLowerCase().startsWith("bearer ")
                ? bearerToken.trim()
                : (bearerToken.trim() ? `Bearer ${bearerToken.trim()}` : "Bearer ")

            const hasAuthHeader = currentHeaders.some(
                (item) => item.key.trim().toLowerCase() === "authorization"
            )

            const updatedHeaders: ItemUrl[] = hasAuthHeader
                ? currentHeaders.map((item) =>
                    item.key.trim().toLowerCase() === "authorization"
                        ? {...item, key: "Authorization", value: authHeaderValue, disabled: false}
                        : item
                )
                : [
                    ...currentHeaders,
                    {
                        id: crypto.randomUUID(),
                        key: "Authorization",
                        value: authHeaderValue,
                        disabled: false,
                    },
                ]

            await updateHeaders(updatedHeaders)
        } else if (newType === "inherit") {
            const authQueryState = queryClient.getQueryState<CollectionAuth | null>(["collection", "auth"])
            let collectionAuth = queryClient.getQueryData<CollectionAuth | null>(["collection", "auth"]) ?? authQueryState?.data ?? null
            if (!collectionAuth) {
                collectionAuth = auth
            }

            const parsedType = collectionAuth?.type || "bearer"
            const parsedBearer: ItemUrl[] = (collectionAuth?.bearer ?? []).map((item) => ({
                id: (item as any).id ?? crypto.randomUUID(),
                key: item.key,
                value: item.value,
                type: item.type ?? "string",
            }))

            const parsedToken = parsedBearer.find((b) => b.key?.toLowerCase() === "token")?.value
                ?? parsedBearer[0]?.value
                ?? ""
            setBearerToken(parsedToken)

            const updatedReq = await updateAuth({
                type: parsedType,
                authSource: "inherit",
                bearer: parsedBearer,
            })

            const currentHeaders = updatedReq?.headers ?? request?.headers ?? []
            const hasAuthHeader = currentHeaders.some(
                (item) => item.key.trim().toLowerCase() === "authorization"
            )

            const authHeaderValue = parsedType === "bearer" 
                ? (parsedToken.trim() ? `Bearer ${parsedToken.trim()}` : "Bearer ") 
                : parsedToken

            const updatedHeaders = hasAuthHeader
                ? currentHeaders.map(
                    item =>
                        item.key.trim().toLowerCase() === "authorization" ?
                            {
                                ...item,
                                value: authHeaderValue
                            } : item
                )
                : [
                    ...currentHeaders,
                    {
                        id: crypto.randomUUID(),
                        key: "Authorization",
                        value: authHeaderValue,
                        disabled: false,
                    }
                ]

            await updateHeaders(updatedHeaders)
        } else {
            setBearerToken("")
            const updatedReq = await updateAuth({
                type: "",
                authSource: "none",
                bearer: [],
            })

            const currentHeaders = updatedReq?.headers ?? request?.headers ?? []
            const updatedHeaders = currentHeaders.filter(
                (item) => item.key.trim().toLowerCase() !== "authorization"
            )
            await updateHeaders(updatedHeaders)
        }
    }

    const debouncedUpdateBearer = useDebouncedCallback((token: string) => {
        updateAuth({
            type: "bearer",
            authSource: "onrequest",
            bearer: [
                {
                    id: crypto.randomUUID(),
                    key: "token",
                    value: token,
                    type: "string",
                },
            ],
        })

        const currentHeaders = request?.headers ?? []
        const hasAuthHeader = currentHeaders.some(
            (item) => item.key.trim().toLowerCase() === "authorization"
        )
        if (hasAuthHeader) {
            const authHeaderValue = token.trim().toLowerCase().startsWith("bearer ")
                ? token.trim()
                : (token.trim() ? `Bearer ${token.trim()}` : "Bearer ")

            updateHeaders(
                currentHeaders.map((item) =>
                    item.key.trim().toLowerCase() === "authorization"
                        ? {...item, key: "Authorization", value: authHeaderValue, disabled: false}
                        : item
                )
            )
        }
    }, 400)

    const handleBearerChange = (value: string) => {
        setBearerToken(value)
        debouncedUpdateBearer(value)
    }

    useEffect(() => {
        setContentType(request?.body?.mode === "formdata" ? "multipart/form-data" : "application/json")
    }, [request?.body?.mode])

    const query = request?.query ?? []
    const headers = request?.headers ?? []
    const headerShow = showSysHeader ? headers : headers.filter((item) =>
        !["user-agent", "accept"].includes(item.key.toLowerCase()))
    const contentTypeHeader = headers.find((item) => item.key.toLowerCase() === "content-type")
    const hasBody = !!contentTypeHeader && !contentTypeHeader.disabled

    const updateQueryItem = (next: ItemUrl) => updateQuery(query.map((item) => item.id === next.id ? next : item))
    const updateHeaderItem = (next: ItemUrl) => updateHeaders(headers.map((item) => item.id === next.id ? next : item))

    const handleToggleBody = () => {
        const existingHeader = headers.find((item) => item.key.toLowerCase() === "content-type")
        if (existingHeader) {
            updateHeaders(
                headers.map((item) =>
                    item.key.toLowerCase() === "content-type"
                        ? {...item, disabled: hasBody}
                        : item
                )
            )
        } else {
            updateHeaders([
                ...headers,
                {
                    id: crypto.randomUUID(),
                    key: "Content-Type",
                    value: contentType,
                    disabled: false,
                },
            ])
        }
    }

    return (
        <section className="rounded-b-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">Request Configuration</h2>
                    <p className="text-xs text-muted-foreground">Manage query params, auth, headers, and payload.</p>
                </div>
            </div>
            <Tabs defaultValue="params" className="gap-0">
                <div className="border-b border-border px-4 pt-3">
                    <TabsList className="h-10 rounded-lg bg-muted">
                        <TabsTrigger value="params">Params</TabsTrigger>
                        <TabsTrigger value="auth">Authorization</TabsTrigger>
                        <TabsTrigger value="headers">Headers</TabsTrigger>
                        <TabsTrigger value="body">Body</TabsTrigger>
                        <TabsTrigger value="scripts">Scripts</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="params" className="p-4">
                    <div className="overflow-hidden rounded-lg border border-border">
                        <div
                            className="grid grid-cols-12 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <span className="col-span-3">Key</span><span className="col-span-3">Value</span>
                            <span className="col-span-4">Description</span><span className="col-span-2"/>
                        </div>
                        {query.map((item) => (
                            <div key={item.id ?? item.key}
                                 className={cn("grid grid-cols-12 border-t border-border px-3 py-2 items-center", item.disabled && "opacity-50")}>
                                <Input value={item.key} readOnly className="col-span-3 h-8"
                                       disabled={item.disabled}/>
                                <Input value={item.value}
                                       onChange={(event) => updateQueryItem({...item, value: event.target.value})}
                                       className="col-span-3 ml-3 h-8" disabled={item.disabled}/>
                                <Input value={item.description ?? ""}
                                       onChange={(event) => updateQueryItem({...item, description: event.target.value})}
                                       className="col-span-4 ml-3 h-8 text-xs" disabled={item.disabled}
                                       placeholder="description"/>
                                <div className="col-span-2 ml-3 flex justify-end gap-1">
                                    <Button type="button" variant="outline" size="sm"
                                            onClick={() => updateQueryItem({...item, disabled: !item.disabled})}
                                            className="h-8 w-8 p-0">
                                        {item.disabled ?
                                            <ToggleLeft className="h-4 w-4 text-slate-400"/> :
                                            <ToggleRight className="h-4 w-4 text-emerald-600"/>
                                        }
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm"
                                            onClick={() => updateQuery(query.filter((entry) => entry.id !== item.id))}
                                            className="h-8 w-8 p-0 text-red-500">
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </div>
                            </div>
                        ))}
                        <div className="grid grid-cols-12 border-t border-border px-3 py-2 items-center">
                            <Input value={newParamKey} onChange={(event) => setNewParamKey(event.target.value)}
                                   className="col-span-3 h-8" placeholder="key"/>
                            <Input value={newParamValue} onChange={(event) => setNewParamValue(event.target.value)}
                                   className="col-span-3 ml-3 h-8" placeholder="value"/>
                            <Input value={newParamDesc} onChange={(event) => setNewParamDesc(event.target.value)}
                                   className="col-span-4 ml-3 h-8 text-xs" placeholder="description"/>
                            <div className="col-span-2 flex justify-end">
                                <Button type="button" variant="outline" size="sm" onClick={() => {
                                    if (!newParamKey.trim()) return
                                    updateQuery([...query, {
                                        id: crypto.randomUUID(),
                                        key: newParamKey.trim(),
                                        value: newParamValue,
                                        description: newParamDesc
                                    }])
                                    setNewParamKey("");
                                    setNewParamValue("");
                                    setNewParamDesc("")
                                }} className="h-8 w-8 p-0"><Plus className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="auth" className="p-4">
                    <div className="grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2">
                        <div className="space-y-2"><p className="text-sm font-medium text-slate-700">Auth Type</p>
                            <Select value={authType}
                                    onValueChange={(value) => handleAuthTypeChange(value as AuthType)}>
                                <SelectTrigger>
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No Auth</SelectItem>
                                    <SelectItem value="inherit">Inherit From Parent</SelectItem>
                                    <SelectItem value="onrequest">Bearer Token</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <AuthDropdownOps authType={authType} bearerValue={bearerToken}
                                         onBearerChange={handleBearerChange}/>
                        <div className="md:col-span-2 rounded-md border text-sm"><AuthLabel authType={authType}/></div>
                    </div>
                </TabsContent>

                <TabsContent value="headers" className="p-4">
                    <Button variant="ghost" size="xs" className="mb-4 rounded-full bg-gray-100"
                            onClick={() => setShowSysHeader((value) => !value)}>
                        {showSysHeader ?
                            <>
                                <Eye className="text-slate-600" size={10}/>
                                <span className="text-[10px]">Show system headers</span>
                            </> : <>
                                <EyeOff className="text-slate-600" size={10}/>
                                <span className="text-[10px]">Show system headers</span>
                            </>}
                    </Button>
                    <div className="overflow-hidden rounded-lg border border-border">
                        <div
                            className="grid grid-cols-12 bg-muted px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <span className="col-span-5">Header</span><span className="col-span-5">Value</span><span
                            className="col-span-2"/></div>
                        {headerShow.map((item) => <div key={item.id ?? item.key}
                                                       className={cn("grid grid-cols-12 border-t border-border px-3 py-2 items-center", item.disabled && "opacity-50")}>
                            <Input value={item.key} readOnly className="col-span-5 h-8"
                                   disabled={item.disabled}/>
                            <Input value={item.value}
                                   onChange={(event) => updateHeaderItem({...item, value: event.target.value})}
                                   className="col-span-5 ml-3 h-8" disabled={item.disabled}/>
                            <div className="col-span-2 ml-3 flex justify-end gap-1">
                                <Button type="button"
                                        variant="outline" size="sm"
                                        onClick={() => updateHeaderItem({
                                            ...item,
                                            disabled: !item.disabled
                                        })}
                                        className="h-8 w-8 p-0">
                                    {item.disabled ?
                                        <ToggleLeft className="h-4 w-4 text-slate-400"/> :
                                        <ToggleRight className="h-4 w-4 text-emerald-600"/>
                                    }</Button>
                                <Button type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => updateHeaders(headers.filter((entry) => entry.id !== item.id))}
                                        className="h-8 w-8 p-0 text-red-500">
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </div>
                        </div>)}
                        <div className="grid grid-cols-12 border-t border-border px-3 py-2 items-center">
                            <Input
                                value={newHeaderKey} onChange={(event) => setNewHeaderKey(event.target.value)}
                                className="col-span-5 h-8" placeholder="header key"/>
                            <Input value={newHeaderValue}
                                   onChange={(event) => setNewHeaderValue(event.target.value)}
                                   className="col-span-5 ml-3 h-8"
                                   placeholder="header value"/>
                            <div className="col-span-2 flex justify-end">
                                <Button type="button" variant="outline"
                                        size="sm" onClick={() => {
                                    if (!newHeaderKey.trim()) return;
                                    updateHeaders([...headers, {
                                        id: crypto.randomUUID(),
                                        key: newHeaderKey.trim(),
                                        value: newHeaderValue,
                                        disabled: false,
                                    }]);
                                    setNewHeaderKey("");
                                    setNewHeaderValue("")
                                }} className="h-8 w-8 p-0">
                                    <Plus className="h-4 w-4"/>
                                </Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="body" className="p-4">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Select value={contentType} onValueChange={(value) => setContentType(value as ContentType)}>
                                <SelectTrigger>
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="application/json"><FileJson2
                                        className="h-4 w-4 text-indigo-500"/>
                                        JSON Payload
                                    </SelectItem>
                                    <SelectItem
                                        value="multipart/form-data"><FileText className="h-4 w-4 text-indigo-500"/>
                                        Multipart Form
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline"
                                       className="text-slate-600">{contentType}</Badge>
                                <Button
                                    type="button" variant="ghost" size="sm"
                                    onClick={handleToggleBody}
                                    className="h-8 w-8 p-0">{hasBody ?
                                    <ToggleRight className="h-4 w-4 text-emerald-600"/> :
                                    <ToggleLeft className="h-4 w-4 text-slate-400"/>}
                                </Button>
                            </div>
                        </div>
                        {hasBody ?
                            <BodyEditor contentType={contentType} body={request?.body} onJsonChange={updateJsonBody}
                                        onFormDataChange={updateFormDataBody}/> :
                            <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                                Body disabled
                            </div>
                        }
                    </div>
                </TabsContent>
                <TabsContent value="scripts" className="p-4"><ScriptEditor value={request?.script ?? ""}
                                                                           onChange={saveScript}/></TabsContent>
            </Tabs>
        </section>
    )
}

export default RequestConfigTabs
