# CareSync — Low-Bandwidth & Offline Healthcare Platform

> **Tagline:** Healthcare that works even when the network doesn't.  
> **Principle:** Text first, low data, offline capable, synchronize later.

CareSync is a full-stack progressive web app (PWA) built with **Next.js (App Router), TypeScript, Tailwind CSS, Dexie (IndexedDB)**, and **Supabase (Auth, Postgres RLS, Private Storage)**.

---

## 🚀 Quick Setup (<= 5 Commands)

### 1. Install Dependencies & Build
```bash
pnpm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase Project details:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEMO_TOOLS=1`
- `SUPABASE_SERVICE_ROLE_KEY` (Used only for local/cloud database seeding)

### 3. Run Database Migrations
Apply `supabase/migrations/0001_init.sql` in your Supabase SQL Editor or locally via Supabase CLI:
```bash
supabase db push
```

### 4. Seed Demo Accounts & Data
Run the demo seeding script to create doctor & patient accounts:
```bash
pnpm db:seed
```

### 5. Start Development Server
```bash
pnpm dev
```
Open `http://localhost:3000` in your browser.

---

## 👨‍⚕️ How to Access Doctor & Patient Portals

| Role | Email | Password | URL |
|---|---|---|---|
| **Doctor** | `doctor@demo.caresync` | `Password123!` | `/doctor` |
| **Patient 1** | `patient1@demo.caresync` | `Password123!` | `/patient` |
| **Patient 2** | `patient2@demo.caresync` | `Password123!` | `/patient` |

> Public registration via `/register` creates **Patient** accounts only. Doctors can only be created via the database seed script or Supabase Dashboard.

---

## 🧪 Running Automated Tests

Run unit tests (Vitest):
```bash
pnpm test
```

Run TypeScript strict type checking:
```bash
pnpm typecheck
```

---

## 🏆 The Golden Path Scenario (§3 Acceptance Test)

1. **Sign in as Patient** at `/login` online.
2. **Go Offline**: Toggle browser offline mode in Chrome DevTools Network tab OR click the floating **Demo Panel** at the bottom right and select **Simulate Offline**.
3. **Reload the page**: The PWA app shell opens offline; dashboard displays cached data.
4. **Create Consultation**: Go to `/patient/new`, enter category, symptoms, duration, and attach a photo (>3 MB).
5. **Real Compression**: Observe the measured compression badge (e.g., `4.2 MB → 180 KB · 96% less data`).
6. **Submit**: Receive instant confirmation: `"Saved on this device — will send when you're online"`. Pending sync counter increases by 1.
7. **Close/Reopen Tab**: Tab closes and reopens offline — consultation remains saved safely in Dexie.
8. **Go Online**: Turn network back on. The sync engine automatically processes the outbox queue (`Sending…` → `Sent — waiting for doctor`).
9. **Doctor Review**: Sign in as Doctor (`doctor@demo.caresync`) in another browser profile. See the consultation request, thumbnails, full signed images, and claim the case with **Start review**.
10. **Guidance & Patient Reply**: Doctor sends clinical guidance. Patient receives the update on the next delta pull.

---

## 📌 Assumptions & Known Limitations

- **IndexedDB Storage**: Local IndexedDB is persistent on device but not encrypted at rest by the browser.
- **Triage Hint**: Triage uses conservative rule-based keyword matching to highlight red flags. It is not an automated medical diagnosis tool.
- **Doctor Portal**: Doctor portal requires an active network connection (doctors are assumed to have better connectivity).
- **Shared Doctor Pool**: Consultations enter a shared pool where any doctor can review; pressing **Start review** locks the case to that doctor.

---

## 🌐 Netlify & Supabase Hosting Instructions

### 1. Host Database & Auth on Supabase
1. Create a new project at [supabase.com](https://supabase.com).
2. Go to SQL Editor and run `supabase/migrations/0001_init.sql`.
3. In Storage settings, ensure `consultation-images` bucket policies are active (included in migration).

### 2. Deploy Web App to Netlify
1. Connect your GitHub repository to Netlify.
2. Build Settings:
   - **Build Command**: `pnpm build`
   - **Publish Directory**: `.next`
3. Environment Variables in Netlify Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase Anon Key
   - `NEXT_PUBLIC_DEMO_TOOLS` = `1`
4. Deploy! The `@netlify/plugin-nextjs` included in `netlify.toml` will handle Next.js SSR and client routing automatically.
