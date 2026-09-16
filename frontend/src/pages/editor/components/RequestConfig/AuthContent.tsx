import React, {useEffect, useState} from "react";
import {ShieldCheck} from "lucide-react";
import {Input} from "@/components/ui/input.tsx";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select.tsx";
import {useQueryClient} from "@tanstack/react-query";
import {useDebouncedCallback} from "use-debounce";
import {type Collection} from "@/layout/services/collection";
import {useCollection} from "@/layout/hooks/useCollection.ts";
import type {CollectionAuth, ItemUrl} from "@/pages/editor/types/api.ts";
import type {RestRequestResponse} from "@/pages/editor/services/requestConfig.ts";
import {useRequestConfig} from "@/pages/editor/hooks/useRequestConfig.ts";
import {useAppSelector} from "@/app/store/hooks.ts";
import {selectEditorActiveTabId} from "@/app/slices/editorTabsSlice.ts";

export type AuthType = "none" | "inherit" | "onrequest";

interface AuthValueProps {
    authType: AuthType;
    bearerValue?: string;
    onBearerChange?: (value: string) => void;
}

export const AuthDropdownOps: React.FC<AuthValueProps> = ({authType, bearerValue, onBearerChange}) => {
    switch (authType) {
        case "none":
            return (
                <div>
                    <p className="text-sm font-medium text-foreground">Authorization Value</p>
                    <Input className="bg-muted" disabled={true} type="text" readOnly/>
                </div>
            );
        case "onrequest":
            return (
                <div>
                    <p className="text-sm font-medium text-foreground">Bearer Token</p>
                    <Input
                        type="password"
                        value={bearerValue ?? ""}
                        onChange={(e) => onBearerChange?.(e.target.value)}
                        placeholder="Enter bearer token..."
                    />
                </div>
            );
        case "inherit":
        default:
            return (
                <div>
                    <p className="text-sm font-medium text-foreground">Inherited Authorization</p>
                    <Input className="bg-muted" type="text" value="****************************" readOnly/>
                </div>
            );
    }
}

export const AuthLabel: React.FC<AuthValueProps> = ({authType}) => {
    switch (authType) {
        case "none":
            return (
                <div
                    className="flex items-center gap-2 font-medium border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/40 p-3 text-orange-700 dark:text-orange-300">
                    <ShieldCheck className="h-4 w-4"/>
                    No auth will be sent for this request.
                </div>
            );
        case "onrequest":
            return (
                <div
                    className="flex items-center gap-2 font-medium border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 p-3 text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4"/>
                    Authorization is scoped to this request only.
                </div>
            );
        case "inherit":
        default:
            return (
                <div
                    className="flex items-center gap-2 font-medium border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 p-3 text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4"/>
                    Using token from parent collection
                </div>
            );

    }
}

export const resolveAuthFromRequest = (req?: RestRequestResponse | null): { type: AuthType; token: string } => {
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

export interface AuthContentProps {
    request?: RestRequestResponse | null
    className?: string
}

export const AuthContent: React.FC<AuthContentProps> = ({
                                                            className = "grid gap-4 rounded-lg border border-slate-200 p-4 md:grid-cols-2",
                                                        }) => {
    const activeTabId = useAppSelector(selectEditorActiveTabId)

    const queryClient = useQueryClient()
    const activeCollection = queryClient.getQueryData<Collection>(["collection", "active"])
    const {auth} = useCollection(activeCollection?.id ?? "")
    const {updateAuth, updateHeaders, request} = useRequestConfig(activeCollection?.id ?? "", activeTabId)

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

    return (
        <div className={className}>
            <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Auth Type</p>
                <Select value={authType} onValueChange={(value) => handleAuthTypeChange(value as AuthType)}>
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
            <AuthDropdownOps
                authType={authType}
                bearerValue={bearerToken}
                onBearerChange={handleBearerChange}
            />
            <div className="md:col-span-2 rounded-md border text-sm">
                <AuthLabel authType={authType}/>
            </div>
        </div>
    )
}

export default AuthContent;

