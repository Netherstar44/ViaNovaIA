# Project Overview – ViaNovaIA

---

## 📖 Project Summary
ViaNovaIA is a **full‑stack, multi‑role travel ecosystem** built with a monorepo managed by **pnpm**.  It supports several user roles (Tourist, Restaurant, Hotel, Recreation, Taxi, Translator, Admin) each with their own dashboards and APIs.  The current codebase lives in:

```
C:\Users\esqui\OneDrive\Desktop\Proyecto ViaNova\ViaNovaIA
```

---

## 🛠️ Tech Stack
| Layer | Technology |
|------|------------|
| **Package manager** | pnpm (workspace) |
| **Language** | TypeScript (Node.js) |
| **Build / type‑check** | `tsc --build`, `pnpm run typecheck` |
| **Concurrent dev server** | `concurrently` – runs API server and Front‑end together |
| **Styling / UI** | React (TSX components – e.g., `RestaurantDashboard.tsx`) |
| **Database** | PostgreSQL (Neon) |
| **Media** | Cloudinary |
| **Email** | Gmail SMTP (app password) |
| **Auth** | Google OAuth (client ID/secret) |
| **Hosting / Tunneling** | ngrok (for dev callbacks) |
| **AI** | GROQ (LLM integration) |

---

## 📦 Important Files
| File | Purpose |
|------|---------|
| `package.json` | Workspace scripts (`dev`, `build`, `typecheck`) |
| `pnpm-workspace.yaml` | Defines workspace packages (`@workspace/api-server`, `@workspace/vianova`, etc.) |
| `.env` | Environment variables – DB, Cloudinary, Google OAuth, SMTP, ngrok URL, GROQ key |
| `PENDING_FEATURES.md` | Feature backlog per role (see below) |
| `tsconfig*.json` | TypeScript configuration |
| `scripts/` | Custom helper scripts |
| `lib/` | Shared libraries used across packages |
| `node_modules/` | Dependencies |

---

## 📋 Pending Features (from `PENDING_FEATURES.md`)
### 1️⃣ Tourist (Traveler)
- **Itinerary Planner** – add hotels, restaurants, activities per day
- **Wallet** – balance, payment methods, coupons
- **Global Interactive AR Map** – AR overlay of points of interest
- **Advanced Reviews** – photo/video‑rich reviews

### 2️⃣ Restaurant
- **Table Manager** – visual map of occupied/free tables, real‑time reservations
- **POS System** – send orders to kitchen displays / printers
- **Inventory Control** – auto‑deduct ingredients per order

### 3️⃣ Hotel
- **Dedicated Dashboard** – rooms, housekeeping status
- **Reservation & Calendar (PMS)** – visual occupancy calendar, check‑in/out workflow
- **Room Service Integration** – view restaurant orders for guest rooms

### 4️⃣ Recreation / Guide
- **Dedicated Dashboard** – groups, live schedule, capacity
- **QR Ticket System** – digital tickets with QR codes & scanner
- **Calendar Management** – block‑time booking UI

### 5️⃣ Taxi
- **Turn‑by‑Turn Navigation** – Mapbox‑style routing for drivers
- **Heat‑map Demand** – real‑time city zones with high tourist demand
- **Panic / Safety Button** – instant alert to central support

### 6️⃣ Translator
- **Translator Dashboard** – languages, rates, availability
- **Live Video/Voice Calls** – WebRTC or Agora integration for instant translation
- **Appointment System** – schedule interpreters for meetings

### 7️⃣ Admin
- **Dispute Resolution** – ticket system for user complaints
- **Advanced Content Moderation** – review photos/videos in ViaSocial
- **System Settings** – configure commissions, taxes, withdrawal limits

---

## ▶️ How to Run the Project (development)
```bash
# From the repository root
pnpm install            # install all workspace deps
pnpm run dev            # starts API server & front‑end concurrently
```
The dev server uses **concurrently** to launch:
- `pnpm --filter @workspace/api-server run dev`
- `pnpm --filter @workspace/vianova run dev`

Make sure the `.env` file is filled with the appropriate credentials (DB URL, Google OAuth, Cloudinary, SMTP, GROQ, NGROK_URL).

---

## 📂 Directory Layout (high‑level)
```
.
├─ .env                     # environment variables
├─ .git/ & .gitignore
├─ PENDING_FEATURES.md      # backlog (see above)
├─ PROJECT_OVERVIEW.md      # **this file**
├─ package.json
├─ pnpm-workspace.yaml
├─ lib/                     # shared utilities
├─ scripts/                 # helper scripts
├─ node_modules/
├─ workspace/               # (implicit) packages such as api-server, vianova, etc.
└─ ... (frontend apps, dashboards, etc.)
```

---

## 🎯 Next Steps for a ChatGPT Prompt
You can now feed this **PROJECT_OVERVIEW.md** to ChatGPT to obtain:
- A concise pitch (e.g., 2‑sentence elevator pitch)
- A detailed project description for documentation
- Answers to specific “what does this project do?” questions
- Guidance on how to extend a particular role’s feature set

Feel free to modify or expand this overview as the codebase evolves.
