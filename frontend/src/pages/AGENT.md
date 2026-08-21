# AGENT.md

### API Client
- **Axios instance** in `config/axios.ts`: base URL from `VITE_API_URL` env (default `http://localhost:8999/api/v1`)
- Request interceptor: tracks `startTime` for duration measurement; has commented-out auth token injection slots
- Response interceptor: calculates duration, logs errors
- **Service layer:** `layout/services/` provides typed HTTP methods using `Response<T>` wrapper
- Backend API: `VITE_API_URL=http://localhost:8999/api/v1` (configured in `frontend/.env`)

### Styling
- Tailwind CSS v4 with `@tailwindcss/vite` plugin (no PostCSS)
- CSS theme variables in `index.css` with OKLCH dark mode (`.dark` class)
- Custom primary color: `#046C4E` (green)
- shadcn/ui New York style, neutral base, all CSS variables enabled
- `cn()` utility: `twMerge(clsx(inputs))`
