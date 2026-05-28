# VIANovaIA

Travel and taxi platform for Neiva, Huila, Colombia — lets travelers discover hotels, restaurants, and recreation; book services; request taxi rides; and connect via a social feed, all powered by an AI chatbot.

## Run & Operate

- `pnpm --filter @workspace/vianova run dev` — run the frontend (port from `PORT` env)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vite + React + Tailwind CSS, Wouter for routing, TanStack Query
- API: Express 5 + Pino logger + esbuild bundle
- DB: PostgreSQL + Drizzle ORM (schema in `artifacts/api-server/src/shared/`)
- Auth: Session-based (express-session + connect-pg-simple) + JWT token fallback
- Real-time: Socket.IO (taxi ride updates)
- File uploads: Multer + Cloudinary
- Email: Nodemailer
- Mobile: Capacitor (APK builds only)

## Where things live

- `artifacts/vianova/` — React frontend (previewPath `/`)
- `artifacts/api-server/` — Express backend (port 8080)
- `artifacts/api-server/src/shared/schema.ts` — main DB schema (source of truth)
- `artifacts/api-server/src/shared/taxi.schema.ts` — taxi-specific tables
- `artifacts/api-server/src/routes/app.routes.ts` — main route registrar + auth middleware
- `artifacts/api-server/src/storage.ts` — DB storage layer (Drizzle)
- `artifacts/vianova/src/lib/queryClient.ts` — API base URL + fetch client
- `attached_assets/generated_images/` — local placeholder images copied to `src/assets/`

## Architecture decisions

- DB schema pushed directly via SQL (not drizzle-kit push) since schema lives in api-server, not lib/db
- `@assets` alias in Vite points to `src/assets/` (inside Vite root) to avoid fs.strict issues
- ServiceWorker registration is suppressed in dev mode (`import.meta.env.DEV`)
- `on401: "returnNull"` used as default queryFn behavior to avoid unhandled rejections
- Social routes still use `@neondatabase/serverless` neon tagged SQL (added as dependency)

## Product

- **Explore**: browse hotels, restaurants, and recreation in Neiva via map + list
- **Book**: reserve availability slots from service providers
- **Taxi**: request rides, track drivers in real-time via Socket.IO
- **Social**: photo/video feed with likes, comments, follows
- **AI Chatbot**: travel assistant with conversation history
- **Multi-role**: users can be travelers, hotel/restaurant/recreation providers, taxi drivers, or translators

## User preferences

_Populate as you build._

## Gotchas

- The 400/500 browser console errors on the login page are from Google OAuth/FedCM iframes inside the Replit preview sandbox — not our API (api-server only logs 200/304/401)
- Capacitor Google Auth throws non-Error rejections on web — wrapped in try/catch in main.tsx
- `lib/db` schema (in the monorepo's db package) is unused — the real schema is in `artifacts/api-server/src/shared/`
- `@codetrix-studio/capacitor-google-auth` peer dep warning for `@capacitor/core` version mismatch is harmless on web

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
