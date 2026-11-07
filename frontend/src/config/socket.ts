import {io, type Socket} from "socket.io-client";
import {getBackendUrl} from "@/config/backend.ts";

export const SOCKET_NAMESPACES = {
    collection: "/collection",
    restrequest: "/restrequest",
    documentation: "/documentation",
} as const;

export const SOCKET_EVENTS = {
    collectionWrite: "collection:write",
    collectionWriteError: "collection:write:error",
    collectionRefresh: "collection:refresh",
    documentContentEdit: "document:content:edit",
    documentRefresh: "document:refresh",
} as const;

export type SocketQuery = Record<string, string | number | boolean>;

export function createSocket(namespace = "", query?: SocketQuery): Socket {
    return io(`${getBackendUrl()}${namespace}`, {
        autoConnect: false,
        path: import.meta.env.VITE_SOCKET_PATH || "/socket.io",
        query,
        transports: ["websocket", "polling"],
    });
}
