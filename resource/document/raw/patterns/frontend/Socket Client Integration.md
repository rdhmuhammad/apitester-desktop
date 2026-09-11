
First you initiate **socket io** client connection for each namespace to `service` of workdir of that component explain here

```typescript
import { io } from "socket.io-client"  
  
const URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8993"  
  
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
```

Then setup hook for that namespace, 