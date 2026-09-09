import {useEffect, useMemo, useState} from "react";
import type {Socket} from "socket.io-client";
import {createSocket, type SocketQuery} from "@/config/socket.ts";

export type SocketStatus = "connecting" | "connected" | "disconnected" | "error";

type UseSocketResult = {
    socket: Socket;
    status: SocketStatus;
    error: Error | null;
};

export function useSocket(namespace = "", query?: SocketQuery): UseSocketResult {
    const queryKey = JSON.stringify(query ?? {});
    const socket = useMemo(
        () => createSocket(namespace, JSON.parse(queryKey) as SocketQuery),
        [namespace, queryKey],
    );
    const [status, setStatus] = useState<SocketStatus>("disconnected");
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const handleConnect = () => {
            setStatus("connected");
            setError(null);
        };
        const handleDisconnect = () => setStatus("disconnected");
        const handleConnectError = (connectionError: Error) => {
            setStatus("error");
            setError(connectionError);
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);
        setStatus("connecting");
        socket.connect();

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleConnectError);
            socket.disconnect();
        };
    }, [socket]);

    return {socket, status, error};
}
