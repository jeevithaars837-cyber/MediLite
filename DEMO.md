# CareSync — Hackathon Demo Script (3-Minute Presentation)

## 🎤 One-Liner Pitch
> *"Remote healthcare fails when the network does. CareSync is text-first, compresses photos on the device, saves consultations offline, and syncs idempotently when the connection returns."*

---

## 🎬 Live Presentation Walkthrough (3 Minutes)

### Minute 1: The Offline Problem & Local Submission
1. Open CareSync Patient Dashboard (`/patient`). Show the sleek, minimal, high-contrast dark UI.
2. Toggle **Simulate Offline** using the bottom-right Demo Panel widget (or Chrome DevTools Network Offline).
3. Refresh the page to prove PWA offline caching works.
4. Click **New Consultation**:
   - Select Category: **Skin / Rash**
   - Symptoms: *"Spreading red rash on arm with mild fever"*
   - Duration: *"2 days"*
   - Attach a large high-res photo.
5. Highlight the **Measured Compression Badge**:
   > *"Notice how the 4.2 MB photo is compressed right inside the browser canvas to 180 KB — 96% less data transfer, with EXIF/GPS stripped for privacy."*
6. Click **Save & Submit Consultation**. Show the immediate feedback:
   > *"Saved on this device — will send when you're online. Pending Sync counter shows 1 item."*

### Minute 2: Network Recovery & Idempotent Sync
1. Turn the network back ON (toggle offline off in Demo Panel).
2. Point to the status badge transitioning automatically:
   `Saved on device` → `Sending…` → `Sent — waiting for a doctor`.
3. Open a second browser tab in Doctor Portal (`/doctor`).
4. Show the new case appearing in the **Doctor Consultation Queue**: `CS-1001 · Skin · Priority: Needs Attention`.

### Minute 3: Doctor Review & Patient Loop
1. As Doctor, click **Start Review** to claim the case.
2. View the compressed image thumbnail (loads full view via 5-minute signed URL).
3. Type guidance: *"Keep area clean and dry. Apply over-the-counter hydrocortisone."*
4. Click **Send Guidance**.
5. Switch back to the Patient tab: show the unread badge and doctor reply instantly appearing via delta pull.

---

## 🔑 Demo Credentials
- **Doctor:** `doctor@demo.caresync` / `Password123!`
- **Patient 1:** `patient1@demo.caresync` / `Password123!`
- **Patient 2:** `patient2@demo.caresync` / `Password123!`
