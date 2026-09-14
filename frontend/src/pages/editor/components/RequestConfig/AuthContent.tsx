import React from "react";
import {ShieldCheck} from "lucide-react";
import {Input} from "@/components/ui/input.tsx";

export type AuthType = "none" | "inherit" | "bearer";

interface AuthValueProps {
    authType: AuthType;
    bearerValue?: string;
    onBearerChange?: (value: string) => void;
}

export const AuthDropdownOps: React.FC<AuthValueProps> = ({authType, bearerValue, onBearerChange})=>{
    switch (authType) {
        case "none":
            return (
                <div>
                    <p className="text-sm font-medium text-foreground">Authorization Value</p>
                    <Input className="bg-muted" disabled={true} type="text" readOnly/>
                </div>
            );
        case "bearer":
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
        case "bearer":
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
