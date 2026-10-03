import path from "path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import http from "node:http"
import https from "node:https"

function corsBypassPlugin(): Plugin {
  return {
    name: "vite-plugin-cors-bypass",
    configureServer(server) {
      server.middlewares.use("/__cors_proxy__", (req, res) => {
        const urlObj = new URL(req.url || "", "http://localhost")
        const target = urlObj.searchParams.get("target")

        res.setHeader("Access-Control-Allow-Origin", "*")
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
        res.setHeader("Access-Control-Allow-Headers", "*")
        res.setHeader("Access-Control-Allow-Credentials", "true")
        res.setHeader("Access-Control-Expose-Headers", "*")

        if (req.method === "OPTIONS") {
          res.statusCode = 204
          res.end()
          return
        }

        if (!target) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: "Missing target query parameter" }))
          return
        }

        try {
          const targetUrl = new URL(target)
          const client = targetUrl.protocol === "https:" ? https : http

          const clientHeaders = { ...req.headers }
          delete clientHeaders["host"]
          delete clientHeaders["origin"]
          delete clientHeaders["referer"]

          const proxyReq = client.request(
            targetUrl,
            {
              method: req.method,
              headers: clientHeaders,
              rejectUnauthorized: false,
            },
            (proxyRes) => {
              res.statusCode = proxyRes.statusCode || 200
              for (const [k, v] of Object.entries(proxyRes.headers)) {
                if (k.toLowerCase().startsWith("access-control-")) continue
                if (v !== undefined) {
                  res.setHeader(k, v)
                }
              }
              res.setHeader("Access-Control-Allow-Origin", "*")
              res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD")
              res.setHeader("Access-Control-Allow-Headers", "*")
              res.setHeader("Access-Control-Allow-Credentials", "true")
              res.setHeader("Access-Control-Expose-Headers", "*")
              proxyRes.pipe(res)
            }
          )

          proxyReq.on("error", (err) => {
            res.statusCode = 502
            res.end(JSON.stringify({ error: err.message }))
          })

          req.pipe(proxyReq)
        } catch (err: any) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), corsBypassPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-radix": [
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
          ],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-editor": ["@codesandbox/sandpack-react"],
          "vendor-router": ["react-router-dom"],
          "vendor-misc": ["axios", "crypto-js", "lucide-react", "sonner"],
        },
      },
    },
  },
})
