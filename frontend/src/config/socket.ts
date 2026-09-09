import {io, type Socket} from "socket.io-client";

export const SOCKET_NAMESPACES = {
    collection: "/collection",
} as const;

export const SOCKET_EVENTS = {
    collectionWrite: "collection:write",
    collectionWriteError: "collection:write:error",
} as const;

export type SocketQuery = Record<string, string | number | boolean>;

function getSocketUrl() {
    const configuredUrl = import.meta.env.VITE_SOCKET_URL;
    if (configuredUrl) {
        return configuredUrl.replace(/\/+$/, "");
    }

    const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
    return new URL(apiUrl, window.location.origin).origin;
}

export function createSocket(namespace = "", query?: SocketQuery): Socket {
    return io(`${getSocketUrl()}${namespace}`, {
        autoConnect: false,
        path: import.meta.env.VITE_SOCKET_PATH || "/socket.io",
        query,
        transports: ["websocket", "polling"],
    });
}
