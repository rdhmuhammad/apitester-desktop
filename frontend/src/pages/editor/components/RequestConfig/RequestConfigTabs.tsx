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
import {useRequestEditor} from "@/layout/context/requestEditorContext.tsx"
import type {ItemUrl} from "@/pages/editor/types/api.ts"

const IndicatorConfigTabs: React.FC = () => {
    const {request, updateHeaders, updateQuery, updateJsonBody, updateFormDataBody, updateScript} = useRequestEditor()
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
        setContentType(request?.body?.mode === "formdata" ? "multipart/form-data" : "application/json")
    }, [request?.body?.mode])

    const query = request?.query ?? []
    const headers = request?.headers ?? []
    const headerShow = showSysHeader ? headers : headers.filter((item) =>
        !["content-type", "user-agent", "accept"].includes(item.key.toLowerCase()))
    const hasBody = !!request?.body

    const updateQueryItem = (next: ItemUrl) => updateQuery(query.map((item) => item.id === next.id ? next : item))
    const updateHeaderItem = (next: ItemUrl) => updateHeaders(headers.map((item) => item.id === next.id ? next : item))

    return (
        <section className="rounded-b-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold text-slate-800">Request Configuration</h2>
                    <p className="text-xs text-slate-500">Manage query params, auth, headers, and payload.</p>
                </div>
            </div>
            <Tabs defaultValue="params" className="gap-0">
                <div className="border-b border-slate-200 px-4 pt-3">
                    <TabsList className="h-10 rounded-lg bg-slate-100">
                        <TabsTrigger value="params">Params</TabsTrigger>
                        <TabsTrigger value="auth">Authorization</TabsTrigger>
                        <TabsTrigger value="headers">Headers</TabsTrigger>
                        <TabsTrigger value="body">Body</TabsTrigger>
                        <TabsTrigger value="scripts">Scripts</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="params" className="p-4">
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                        <div className="grid grid-cols-12 bg-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600">
                            <span className="col-span-3">Key</span><span className="col-span-3">Value</span>
                            <span className="col-span-4">Description</span><span className="col-span-2" />
                        </div>
                        {query.map((item) => (
                            <div key={item.id ?? item.key} className={cn("grid grid-cols-12 border-t border-slate-200 px-3 py-2 items-center", item.disabled && "opacity-50")}>
                                <Input value={item.key} readOnly className="col-span-3 h-8 bg-white" disabled={item.disabled} />
                                <Input value={item.value} onChange={(event) => updateQueryItem({...item, value: event.target.value})} className="col-span-3 ml-3 h-8 bg-white" disabled={item.disabled} />
                                <Input value={item.description ?? ""} onChange={(event) => updateQueryItem({...item, description: event.target.value})} className="col-span-4 ml-3 h-8 bg-white text-xs" disabled={item.disabled} placeholder="description" />
                                <div className="col-span-2 ml-3 flex justify-end gap-1">
                                    <Button type="button" variant="outline" size="sm" onClick={() => updateQueryItem({...item, disabled: !item.disabled})} className="h-8 w-8 p-0">
                                        {item.disabled ? <ToggleLeft className="h-4 w-4 text-slate-400" /> : <ToggleRight className="h-4 w-4 text-emerald-600" />}
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => updateQuery(query.filter((entry) => entry.id !== item.id))} className="h-8 w-8 p-0 text-red-500">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        <div className="grid grid-cols-12 border-t border-slate-200 px-3 py-2 items-center">
                            <Input value={newParamKey} onChange={(event) => setNewParamKey(event.target.value)} className="col-span-3 h-8" placeholder="key" />
                            <Input value={newParamValue} onChange={(event) => setNewParamValue(event.target.value)} className="col-span-3 ml-3 h-8" placeholder="value" />
                            <Input value={newParamDesc} onChange={(event) => setNewParamDesc(event.target.value)} className="col-span-4 ml-3 h-8 text-xs" placeholder="description" />
                            <div className="col-span-2 flex justify-end">
                                <Button type="button" variant="outline" size="sm" onClick={() => {
                                    if (!newParamKey.trim()) return
                                    updateQuery([...query, {id: crypto.randomUUID(), key: newParamKey.trim(), value: newParamValue, description: newParamDesc}])
                                    setNewParamKey(""); setNewParamValue(""); setNewParamDesc("")
                                }} className="h-8 w-8 p-0"><Plus className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="auth" className="p-4">
                    <div className="grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2">
                        <div className="space-y-2"><p className="text-sm font-medium text-slate-700">Auth Type</p>
                            <Select value={authType} onValueChange={(value) => setAuthType(value as AuthType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                                <SelectItem value="none">No Auth</SelectItem><SelectItem value="inherit">Inherit From Parent</SelectItem><SelectItem value="bearer">Bearer Token</SelectItem>
                            </SelectContent></Select>
                        </div>
                        <AuthDropdownOps authType={authType} bearerValue={bearerToken} onBearerChange={setBearerToken} />
                        <div className="md:col-span-2 rounded-md border text-sm"><AuthLabel authType={authType} /></div>
                    </div>
                </TabsContent>

                <TabsContent value="headers" className="p-4">
                    <Button variant="ghost" size="xs" className="mb-4 rounded-full bg-gray-100" onClick={() => setShowSysHeader((value) => !value)}>
                        {showSysHeader ? <><Eye className="text-slate-600" size={10} /><span className="text-[10px]">Show system headers</span></> : <><EyeOff className="text-slate-600" size={10} /><span className="text-[10px]">Show system headers</span></>}
                    </Button>
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                        <div className="grid grid-cols-12 bg-slate-100 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600"><span className="col-span-5">Header</span><span className="col-span-5">Value</span><span className="col-span-2" /></div>
                        {headerShow.map((item) => <div key={item.id ?? item.key} className={cn("grid grid-cols-12 border-t border-slate-200 px-3 py-2 items-center", item.disabled && "opacity-50")}>
                            <Input value={item.key} readOnly className="col-span-5 h-8 bg-white" disabled={item.disabled} />
                            <Input value={item.value} onChange={(event) => updateHeaderItem({...item, value: event.target.value})} className="col-span-5 ml-3 h-8 bg-white" disabled={item.disabled} />
                            <div className="col-span-2 ml-3 flex justify-end gap-1"><Button type="button" variant="outline" size="sm" onClick={() => updateHeaderItem({...item, disabled: !item.disabled})} className="h-8 w-8 p-0">{item.disabled ? <ToggleLeft className="h-4 w-4 text-slate-400" /> : <ToggleRight className="h-4 w-4 text-emerald-600" />}</Button><Button type="button" variant="ghost" size="sm" onClick={() => updateHeaders(headers.filter((entry) => entry.id !== item.id))} className="h-8 w-8 p-0 text-red-500"><Trash2 className="h-4 w-4" /></Button></div>
                        </div>)}
                        <div className="grid grid-cols-12 border-t border-slate-200 px-3 py-2 items-center"><Input value={newHeaderKey} onChange={(event) => setNewHeaderKey(event.target.value)} className="col-span-5 h-8" placeholder="header key" /><Input value={newHeaderValue} onChange={(event) => setNewHeaderValue(event.target.value)} className="col-span-5 ml-3 h-8" placeholder="header value" /><div className="col-span-2 flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => { if (!newHeaderKey.trim()) return; updateHeaders([...headers, {id: crypto.randomUUID(), key: newHeaderKey.trim(), value: newHeaderValue}]); setNewHeaderKey(""); setNewHeaderValue("") }} className="h-8 w-8 p-0"><Plus className="h-4 w-4" /></Button></div></div>
                    </div>
                </TabsContent>

                <TabsContent value="body" className="p-4"><div className="space-y-3"><div className="flex items-center justify-between"><Select value={contentType} onValueChange={(value) => setContentType(value as ContentType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="application/json"><FileJson2 className="h-4 w-4 text-indigo-500" />JSON Payload</SelectItem><SelectItem value="multipart/form-data"><FileText className="h-4 w-4 text-indigo-500" />Multipart Form</SelectItem></SelectContent></Select><div className="flex items-center gap-2"><Badge variant="outline" className="text-slate-600">{contentType}</Badge><Button type="button" variant="ghost" size="sm" onClick={() => contentType === "application/json" ? updateJsonBody("") : updateFormDataBody([])} className="h-8 w-8 p-0">{hasBody ? <ToggleRight className="h-4 w-4 text-emerald-600" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />}</Button></div></div>{hasBody ? <BodyEditor contentType={contentType} body={request?.body} onJsonChange={updateJsonBody} onFormDataChange={updateFormDataBody} /> : <div className="flex items-center justify-center py-12 text-sm text-slate-400">Body disabled</div>}</div></TabsContent>
                <TabsContent value="scripts" className="p-4"><ScriptEditor value={request?.script ?? ""} onChange={updateScript} /></TabsContent>
            </Tabs>
        </section>
    )
}

export default IndicatorConfigTabs
