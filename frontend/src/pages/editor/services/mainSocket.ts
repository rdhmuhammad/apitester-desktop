import {io} from "socket.io-client"

const URL = (import.meta.env.VITE_SOCKET_URL || "http://localhost:8993").replace(/\/+$/, "")

export const socketCollection = io(`${URL}/restrequest`, {
    path: "/socket.io",
    autoConnect: true,
    transports: ["websocket", "polling"],
})

export const socketAutomation = io(`${URL}/automation`, {
    path: "/socket.io",
    autoConnect: true,
    transports: ["websocket", "polling"],
})
