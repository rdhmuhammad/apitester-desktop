import {io} from "socket.io-client"

const URL = (import.meta.env.VITE_SOCKET_URL || "http://localhost:8993").replace(/\/+$/, "")

export const socketRestRequest = io(`${URL}/restrequest`, {
    path: "/socket.io",
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket", "polling"],
})

export const socketCollection = io(`${URL}/collection`, {
    path: "/socket.io",
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket", "polling"],
})

export const socketAutomation = io(`${URL}/automation`, {
    path: "/socket.io",
    autoConnect: false,
    transports: ["websocket", "polling"],
})

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        socketRestRequest.disconnect()
        socketCollection.disconnect()
        socketAutomation.disconnect()
    })
}
