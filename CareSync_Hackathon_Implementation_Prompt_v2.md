# CareSync — Agent Build Prompt (v2, prototype-grade)

> **Tagline:** Healthcare that works even when the network doesn't.
> **Principle:** Text first, low data, offline capable, synchronize later.

---

# 0. How you must work (read first)

You are a senior full-stack engineer building a **working hackathon prototype** of CareSync. "Working" means: a judge can run the golden path (§3) live, end to end, in a phone-sized browser on a throttled connection, and it does not break.

Operating rules:

1. **Inspect first.** If a repo already exists, identify framework, package manager, auth, DB and styling; reuse them; do not rewrite working code. If the repo is empty, scaffold per §2.
2. **Plan briefly, then execute.** Post a plan of ≤15 lines. Do not ask questions unless truly blocked. Where this prompt is silent, pick the simplest option and record it in the README under "Assumptions".
3. **Work in the phases in §16.** Each phase has a **gate**. Do not start the next phase until the gate passes. Commit at each gate (`phase-N: <summary>`).
4. **Depth over breadth.** The chain *offline save → compress → queue → idempotent sync → doctor reply → patient sees reply* must be rock solid before any polish or bonus feature.
5. **No fake results.** Never hardcode sizes, counts, sync outcomes or "data saved" numbers. Anything mocked must be labelled in the UI and the README.
6. **Never claim something works unless you ran it.** The final report (§19) must contain real command results.
7. **Always buildable.** If an env var or service is missing, fail with a clear, actionable message — never a crash loop or a blank screen.

---

# 1. Scope

**In scope**
- Patient: register/login, create consultation (symptoms + optional photos), works offline, automatic sync, read doctor replies, reply to follow-up questions, history.
- Doctor: login, queue with filters, open/claim case, view symptoms + images, send guidance or follow-up question, recommend in-person care, complete case.
- Bandwidth: browser-side image compression, Low Data Mode, cached app shell, no realtime connections.
- Safety: disclaimers, emergency banner, conservative rule-based priority hint (no diagnosis).

**Out of scope — do not build**
Video/voice calls, WebSockets/Realtime, AI diagnosis or chatbot, payments, admin panel, native apps, e-prescriptions, doctor-side offline mode, push notifications (P2 only if everything else is done).

---

# 2. Locked decisions (do not re-debate)

| Area | Decision |
|---|---|
| Framework | Next.js (latest stable, App Router), React, TypeScript `strict`, Tailwind CSS, Lucide icons. Use the repo's package manager, else `pnpm`. |
| Backend | Supabase: Auth (email + password), Postgres, private Storage. README documents both **local** (Supabase CLI) and **cloud project** setup. |
| Supabase client | `@supabase/supabase-js` in the browser for the patient area; `@supabase/ssr` only where server auth is needed (doctor portal, login). |
| Offline store | IndexedDB via Dexie. |
| Validation | `zod` on the client; Postgres `CHECK` constraints are the source of truth. |
| Roles | `patient`, `doctor`. Public registration creates **patients only**. Doctors are created by the seed script or the Supabase dashboard. A role can never be set from the client. |
| Doctor assignment | Shared pool. All doctors can see all consultations. A doctor presses **Start review** to claim a case (`doctor_id` set, status `doctor_reviewing`). Only the claiming doctor can reply/modify it; other doctors see it as claimed. |
| Offline scope | Patient side is fully offline-capable. Doctor portal is online-only (doctors are assumed to have better connectivity). |
| State model | Two separate concepts: `syncState` (local only) and `status` (server). Never mix them into one enum. |
| Freshness | No realtime. Delta polling + refresh on app focus / `online` event (§6.6). |
| Patient URL key | `client_submission_id` (UUID made on the device) identifies a consultation everywhere on the patient side, so URLs work offline and after sync. The human number `CS-####` appears only after sync; before that show `Local-XXXX` (first 4 chars of the UUID). |
| Images | Max 3 per consultation, WebP (JPEG fallback), one thumbnail + one full image each, private bucket, signed URLs (5-minute expiry). |
| PII shown to doctors | Case number, optional age, category, symptoms, images. **No patient name or phone.** |
| PWA | Must work on the **production build** (`build` + `start`). Service workers are unreliable in `dev`; never test offline there. |
| i18n | English only, but every UI string lives in one dictionary module so translation can be added later. |

---

# 3. Golden path (the acceptance test that matters)

This exact scenario must pass, manually and as an automated Playwright test (§17):

1. Patient logs in online. App shell is cached (visit dashboard + new-consultation screen once).
2. **Go offline** (browser offline mode, or the in-app *Simulate offline* toggle in §18).
3. Reload the page → the app still opens and the dashboard shows cached data.
4. Create a consultation: category, symptoms, duration, attach a ≥3 MB photo.
5. UI shows the measured compression result (e.g. `4.2 MB → 180 KB · 96% less data`).
6. Submit → immediate confirmation "Saved on this device — will send when you're online". Dashboard shows **Pending sync: 1**.
7. Close the tab, reopen the app (still offline) → the consultation is still there as pending.
8. **Go online** → without any user action the status moves `Sending…` → `Sent — waiting for a doctor`. Pending sync returns to 0.
9. Doctor portal (separate browser profile) shows **exactly one** new request with a thumbnail. Full image loads on tap.
10. Doctor starts review, sends guidance → patient's dashboard shows "Doctor replied" (after next pull), patient reads it.
11. **Lost-response test:** repeat 4–8 but make the network drop *after the server accepted the request and before the client got the response* → after retry there is still **exactly one** consultation and one set of images.

---

# 4. Architecture rules that prevent the classic failures

1. **One code path for online and offline.** Submitting *always* writes to Dexie + the outbox first, then wakes the sync engine. Online submissions are simply "offline submissions that sync in a few hundred ms". This removes a whole class of data-loss bugs.
2. **Never show "saved" before the Dexie transaction commits.** If the write fails (e.g. `QuotaExceededError`), tell the user it was **not** saved and keep the form contents.
3. **Offline-critical routes are client-rendered.** Server middleware/SSR redirects cannot run offline. `/patient/**` and `/login` must render from a cached static shell, read the session from the browser client (persisted session), read data from Dexie first, and refresh from the network in the background. Server-side auth guards are used only for `/doctor/**`.
4. **Auth must not block offline use.** If a persisted session exists and the network is down, treat the user as signed in. Never redirect to login just because a token refresh failed offline (§6.4).
5. **Idempotency lives in the database**, not only in client logic (§5: unique `(patient_id, client_submission_id)` + `submit_consultation` RPC).
6. **Storage before row.** Upload images to deterministic paths first (safe to repeat), then create the consultation + image rows in one atomic RPC. A doctor never sees a consultation whose images are missing.
7. **`navigator.onLine` is only a hint.** Actual sync attempts decide truth. A tiny connectivity probe drives the indicator (§6.5).
8. **The service worker caches static assets and the app shell only.** Never API responses, Supabase calls, signed image URLs or patient data.

```text
UI (client-rendered patient shell)
   │ writes/reads
Dexie: submissions · images(blobs) · outbox · remote cache · meta
   │ wakes
SyncEngine ──(retry/backoff/lock)──► Supabase Storage (images) ─► RPC submit_consultation ─► Postgres (RLS)
   ▲                                                                   │
   └──────────── delta pull (consultations + messages) ◄───────────────┘
```

---

# 5. Database & security (Supabase migration)

Put this in `supabase/migrations/0001_init.sql`. **It is reference SQL: you must run it (local Supabase or cloud) and fix any errors.** You may rename things, but every guarantee in the list below must still hold and be tested (§17).

```sql
create extension if not exists pgcrypto;

create type public.user_role as enum ('patient','doctor');
create type public.symptom_category as enum ('fever','skin','respiratory','pain','digestive','injury','other');
create type public.priority_level as enum ('normal','needs_attention','urgent_review');
create type public.consultation_status as enum ('submitted','doctor_reviewing','doctor_replied','completed');
create type public.message_kind as enum ('patient_message','follow_up_question','guidance','system');

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- profiles: id = auth user id
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'patient',
  full_name text not null check (char_length(full_name) between 1 and 100),
  phone text check (phone is null or char_length(phone) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- new users are ALWAYS patients; metadata can never choose a role
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role, full_name)
  values (new.id, 'patient',
          coalesce(nullif(left(new.raw_user_meta_data->>'full_name', 100), ''), 'Patient'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_doctor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'doctor');
$$;

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  case_number bigint generated always as identity (start with 1001),
  client_submission_id uuid not null,
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid references public.profiles(id),
  category public.symptom_category not null,
  symptoms text not null check (char_length(symptoms) between 5 and 2000),
  duration text not null check (char_length(duration) between 1 and 100),
  additional_notes text check (additional_notes is null or char_length(additional_notes) <= 2000),
  patient_age_years smallint check (patient_age_years is null or patient_age_years between 0 and 120),
  suggested_priority public.priority_level not null default 'normal', -- untrusted client hint
  priority public.priority_level,                                    -- doctor override (null = none)
  status public.consultation_status not null default 'submitted',
  in_person_recommended boolean not null default false,
  client_created_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, client_submission_id)
);
create index on public.consultations (status, created_at desc);
create index on public.consultations (patient_id, updated_at desc);
create trigger consultations_touch before update on public.consultations
  for each row execute function public.touch_updated_at();

create table public.consultation_images (
  id uuid primary key default gen_random_uuid(),
  client_image_id uuid not null,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  original_size integer not null check (original_size > 0),
  compressed_size integer not null check (compressed_size > 0 and compressed_size <= 1048576),
  mime_type text not null check (mime_type in ('image/jpeg','image/webp')),
  width integer, height integer,
  created_at timestamptz not null default now(),
  unique (consultation_id, client_image_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_message_id uuid not null,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  kind public.message_kind not null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (sender_id, client_message_id)
);
create index on public.messages (consultation_id, created_at);

-- a message moves the case status (runs with owner rights)
create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_doctor_id(new.sender_id) then
    update public.consultations
       set status = 'doctor_replied'::public.consultation_status
     where id = new.consultation_id and status <> 'completed';
  else
    update public.consultations
       set status = (case when doctor_id is null then 'submitted' else 'doctor_reviewing' end)::public.consultation_status
     where id = new.consultation_id and status <> 'completed';
  end if;
  return new;
end $$;
create or replace function public.is_doctor_id(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = uid and role = 'doctor');
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- ───────── Row Level Security ─────────
alter table public.profiles enable row level security;
alter table public.consultations enable row level security;
alter table public.consultation_images enable row level security;
alter table public.messages enable row level security;

-- profiles: read/update own row; role is not updatable
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- consultations
create policy consultations_select on public.consultations for select to authenticated
  using (patient_id = auth.uid() or public.is_doctor());
create policy consultations_insert_patient on public.consultations for insert to authenticated
  with check (patient_id = auth.uid() and status = 'submitted' and doctor_id is null
              and priority is null and in_person_recommended = false);
revoke update on public.consultations from authenticated, anon;
grant update (status, priority, in_person_recommended, doctor_id) on public.consultations to authenticated;
-- only a doctor, and only on unclaimed cases or cases they claimed
create policy consultations_update_doctor on public.consultations for update to authenticated
  using (public.is_doctor() and (doctor_id is null or doctor_id = auth.uid()))
  with check (public.is_doctor() and doctor_id = auth.uid());

-- images
create policy images_select on public.consultation_images for select to authenticated
  using (exists (select 1 from public.consultations c
                 where c.id = consultation_id and (c.patient_id = auth.uid() or public.is_doctor())));
create policy images_insert_patient on public.consultation_images for insert to authenticated
  with check (exists (select 1 from public.consultations c
                      where c.id = consultation_id and c.patient_id = auth.uid()));

-- messages
create policy messages_select on public.messages for select to authenticated
  using (exists (select 1 from public.consultations c
                 where c.id = consultation_id and (c.patient_id = auth.uid() or public.is_doctor())));
create policy messages_insert_patient on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and kind = 'patient_message'
              and exists (select 1 from public.consultations c
                          where c.id = consultation_id and c.patient_id = auth.uid() and c.status <> 'completed'));
create policy messages_insert_doctor on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_doctor()
              and kind in ('follow_up_question','guidance','system')
              and exists (select 1 from public.consultations c
                          where c.id = consultation_id and c.doctor_id = auth.uid()));
revoke update on public.messages from authenticated, anon;
grant update (read_at) on public.messages to authenticated;
create policy messages_mark_read on public.messages for update to authenticated
  using (sender_id <> auth.uid() and exists (select 1 from public.consultations c
        where c.id = consultation_id and (c.patient_id = auth.uid() or public.is_doctor())))
  with check (sender_id <> auth.uid());

-- ───────── Idempotent, atomic submit ─────────
create or replace function public.submit_consultation(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_csid uuid := (p->>'client_submission_id')::uuid;
  v_id uuid;
  v_img jsonb;
begin
  if jsonb_array_length(coalesce(p->'images', '[]'::jsonb)) > 3 then
    raise exception 'too_many_images' using errcode = '22023';
  end if;

  select id into v_id from public.consultations
   where patient_id = auth.uid() and client_submission_id = v_csid;
  if v_id is not null then return v_id; end if;          -- duplicate → same id, no new rows

  begin
    insert into public.consultations
      (client_submission_id, patient_id, category, symptoms, duration, additional_notes,
       patient_age_years, suggested_priority, client_created_at)
    values
      (v_csid, auth.uid(), (p->>'category')::public.symptom_category, p->>'symptoms', p->>'duration',
       nullif(p->>'additional_notes',''), nullif(p->>'patient_age_years','')::smallint,
       coalesce((p->>'suggested_priority')::public.priority_level, 'normal'),
       coalesce((p->>'client_created_at')::timestamptz, now()))
    returning id into v_id;
  exception when unique_violation then                    -- concurrent duplicate
    select id into v_id from public.consultations
     where patient_id = auth.uid() and client_submission_id = v_csid;
    return v_id;
  end;

  for v_img in select value from jsonb_array_elements(coalesce(p->'images', '[]'::jsonb)) loop
    if left(v_img->>'storage_path', length(auth.uid()::text) + 1) <> auth.uid()::text || '/' then
      raise exception 'invalid_path' using errcode = '22023';
    end if;
    insert into public.consultation_images
      (consultation_id, client_image_id, storage_path, thumb_path, original_size, compressed_size,
       mime_type, width, height)
    values
      (v_id, (v_img->>'client_image_id')::uuid, v_img->>'storage_path', v_img->>'thumb_path',
       (v_img->>'original_size')::int, (v_img->>'compressed_size')::int, v_img->>'mime_type',
       nullif(v_img->>'width','')::int, nullif(v_img->>'height','')::int);
  end loop;
  return v_id;
end $$;
revoke execute on function public.submit_consultation(jsonb) from public, anon;
grant execute on function public.submit_consultation(jsonb) to authenticated;

-- ───────── Storage (private) ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consultation-images', 'consultation-images', false, 1048576, array['image/jpeg','image/webp'])
on conflict (id) do nothing;

-- path convention: {patient_uid}/{client_submission_id}/{client_image_id}.webp  and  ..._thumb.webp
create policy storage_patient_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'consultation-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_patient_update on storage.objects for update to authenticated   -- needed for upsert retries
  using (bucket_id = 'consultation-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_read on storage.objects for select to authenticated
  using (bucket_id = 'consultation-images'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_doctor()));
```

**Security invariants to preserve and test:**
1. Anonymous users can read/write nothing.
2. A patient can never read another patient's consultations, messages, images or storage objects.
3. A patient cannot set `role`, `status`, `priority`, `doctor_id`, `in_person_recommended`, and cannot update a consultation after submission.
4. Only the claiming doctor can update or reply to a case; claiming is `update … where id = $1 and doctor_id is null` (0 rows updated = someone else claimed it).
5. Submitting the same `client_submission_id` twice yields the same consultation id and exactly one consultation and one set of image rows.
6. Storage paths must start with the caller's user id.

---

# 6. Offline data & sync engine (highest priority)

## 6.1 Dexie schema (suggested)

```ts
db.version(1).stores({
  submissions:    'clientSubmissionId, userId, syncState, createdAt', // form fields, syncState, serverId?, caseNumber?, attempts, lastErrorCode
  images:         'clientImageId, clientSubmissionId',                // full+thumb Blobs, sizes, uploaded flags
  outbox:         'id, userId, status, nextAttemptAt, createdAt',     // type: submit_consultation | send_message
  remote:         'id, userId, updatedAt',                            // cached server consultations for this patient
  remoteMessages: 'id, consultationId, createdAt',
  meta:           'key',                                              // per-user pull cursor, lowDataMode, prefs
});
```

`syncState`: `queued | syncing | retry_scheduled | needs_login | failed_permanent | synced`.
Every row is keyed to `userId`; the engine only processes the signed-in user's rows.

## 6.2 Submit flow (same offline or online)

1. Validate with zod (symptoms 5–2000 chars, duration required, category required, ≤3 images).
2. Images were already compressed when attached (§7). Store blobs in `images`.
3. In **one Dexie transaction**: write `submissions` (`queued`), `images`, and an `outbox` item.
4. Only after the transaction resolves: show "Saved on this device — will send when you're online" and call `syncEngine.kick()`.
5. If the transaction throws: show the "couldn't save" message (§13), keep the form intact.

## 6.3 `processQueue()` algorithm

```text
acquire lock (navigator.locks 'caresync-sync', ifAvailable; fallback: localStorage lease with expiry)
if lock not acquired → return
loop: take next outbox item where status='queued' and nextAttemptAt <= now, FIFO, concurrency = 1
  submit_consultation:
    set syncState='syncing'
    for each image not yet uploaded:
       upload thumb + full with upsert:true to deterministic path; on success persist uploaded=true   (retries skip finished images)
    call rpc submit_consultation(payload)                     ← atomic + idempotent
    on success: store serverId + caseNumber, syncState='synced', delete outbox item,
                delete full-size blobs (keep thumbnails), record real byte counts
  send_message:
    insert into messages (client_message_id …); duplicate key (23505) counts as success
on failure → classify (§6.4), schedule retry or park item
```

Timeouts via `AbortController`: 15 s for API calls, 45 s per image upload (60 s / 90 s when Low Data Mode is on). Upload images **sequentially**, never in parallel.

## 6.4 Error classification

| Failure | Meaning | Action |
|---|---|---|
| Network error, timeout, `fetch` throws, HTTP 5xx, 429, 408 | Transient | `retry_scheduled`; backoff `min(5 min, 2^attempt × 2 s) × random(0.7–1.3)`. Never give up permanently. After 10 attempts stop the timer but retry on app open / `online` / manual **Retry now**. |
| 401 / expired JWT | Session | Try `auth.refreshSession()`. If it fails offline → just retry later. If it fails online (refresh token invalid) → `needs_login`; pause the queue; show "Sign in again to send". **Do not delete data.** Resume after login (same user only). |
| Postgres `23505` on submit | Duplicate | Treat as **success**; fetch the existing row/id. |
| 400 / 422 / check-violation (`23514`, `22023`, `22P02`) | Data invalid | `failed_permanent`; show friendly "needs a change" with **Edit and resend** (reuses the same `client_submission_id` only if nothing was created server-side; else generate a new one). |
| 403 / RLS violation | Not allowed | `failed_permanent`; friendly message; log for developers (console + `sync_events` optional). |
| Quota exceeded while saving | Local | Not saved; explain; suggest removing an image. |

## 6.5 Connectivity & triggers

- Run `processQueue` on: app start, `window` `online` event, `visibilitychange` → visible, right after enqueue, and every 30 s **only while the outbox is non-empty**. (Optional progressive enhancement: Background Sync API on Chromium.)
- Indicator states: **Online**, **Offline**, **Connected but unreachable/slow** (browser says online but the last probe or sync attempt failed). Probe: `GET /api/health` (`Cache-Control: no-store`, returns `204`), 4 s timeout, at most once per 30 s, and only while the app is visible. Probe results never block sync attempts.

## 6.6 Pull (server → device)

- After each successful queue run, on app open/focus/`online`, and on a timer while visible: normal mode every 60 s, Low Data Mode every 5 min, hidden tab → no polling.
- Delta query: consultations `where updated_at > cursor order by updated_at limit 50` (RLS scopes to the patient), then messages for those consultations `created_at > cursor`. Cursor = max **server** `updated_at` seen (never the client clock). First login: latest 50.
- Unread badge = messages from a doctor with `read_at is null`. Mark read when the thread is opened (best effort, online only).

## 6.7 Multi-tab, logout, storage

- Only one tab may run the engine (lock above). Other tabs read Dexie and update via a `BroadcastChannel`.
- On logout with unsent items: warn ("You have N unsent consultations. They stay on this device until you sign in again."). Offer **Remove data from this device**. Never expose one user's rows to another account.
- Call `navigator.storage.persist()` after first successful save; check `navigator.storage.estimate()` before storing images.
- Known limitation to document in the README: IndexedDB is not encrypted at rest.

---

# 7. Image compression

Reusable utility `compressImage(file, preset): Promise<Result>` in `lib/image`.

**Input rules:** accept `image/jpeg`, `image/png`, `image/webp` (HEIC only if the browser can decode it, else a friendly message). Reject > 25 MB or non-image (check the real decoded result, not just the extension). Max 3 images per consultation.

**Pipeline**
1. Decode with `createImageBitmap(file, { imageOrientation: 'from-image' })` (fallback: `<img>` + canvas). Prefer `OffscreenCanvas` in a Worker when available so low-end phones don't freeze.
2. Resize so the long edge ≤ preset max (never upscale).
3. Fill a white background before encoding (PNG transparency).
4. Encode WebP; **verify `blob.type === 'image/webp'`** and fall back to JPEG if the browser silently returned PNG/other.
5. Start at quality 0.80; step down by 0.08 to a floor of 0.45 until `size ≤ target`. If still too large, shrink dimensions by 15% and retry (max 3 rounds).
6. Create a thumbnail: long edge 240 px, target ≤ 15 KB.
7. Re-encoding strips EXIF (including GPS) — keep it that way and mention it in the UI ("location data removed").

| Preset | Max long edge | Full-image target | Default when |
|---|---|---|---|
| Low | 800 px | ≤ 100 KB | Low Data Mode ON |
| Medium | 1280 px | ≤ 300 KB | Default |
| High | 1600 px | ≤ 500 KB | User chooses |

**Result:** `{ blob, thumbBlob, width, height, mime, originalSize, compressedSize, savedPercent }`. `savedPercent` uses real sizes and is clamped at 0. Targets are goals, not guarantees; the hard cap is 1 MB (matches the DB/bucket constraints).

**UI:** show a preview, the exact `4.2 MB → 180 KB · 96% less data`, a remove button, and a spinner while compressing. Compression failures show the friendly invalid-image message (§13).

---

# 8. Low Data Mode

A visible toggle in the header and settings; persisted in `meta`. Initial default: ON if `navigator.connection?.saveData` is true, else OFF (Chromium-only hints; never a hard dependency). After 3 sync/probe failures or slow uploads in a session, show a dismissible **suggestion** to enable it — never switch silently.

When ON: image preset Low; polling every 5 min; lists show **no images** (text + thumbnail only in detail view, tap to load the full image); `loading="lazy"` on all images; `html[data-low-data]` disables animations/transitions via CSS; longer request timeouts; skip non-essential requests (e.g. analytics card refresh).

Always (regardless of mode): system font stack (no web fonts), no background images, no autoplay, no large decorative assets.

---

# 9. PWA

- `manifest.webmanifest`: name, short_name, `display: standalone`, `start_url: /patient`, theme/background colors, icons 192 & 512 + maskable.
- Service worker (hand-written `public/sw.js` is acceptable and often more reliable than a plugin; if using a plugin, verify it supports the installed Next.js bundler).
  - Precache: app shell for `/login`, `/patient`, `/patient/new`, `/offline`, plus `_next/static` assets.
  - Navigations: network-first with a 3 s timeout, fall back to the cached shell. Any `/patient/**` navigation (including dynamic ids) falls back to the cached patient shell and the client router renders the page.
  - Runtime caching: stale-while-revalidate for same-origin static assets only.
  - **Never cache:** `/api/**`, `/doctor/**`, Supabase domains, signed URLs, anything with cookies/authorization.
  - Versioned caches, delete old caches on activate, show "New version available — Reload" instead of force-reloading mid-form.
- Register the SW only in production. Verify with Lighthouse "installable" and the golden path.

---

# 10. Screens & status labels

## Patient (mobile-first, bottom navigation)

- **Login / Register**: email, password, name; a checkbox "I understand CareSync is not for emergencies". Register creates patients only.
- **Dashboard** `/patient`: greeting, connectivity indicator, Low Data Mode toggle, **New consultation** button, counters (Pending sync / Active / Completed), latest doctor response, **Data saved** card (sum of `original_size − compressed_size`, real numbers), permanent disclaimer footer.
- **New consultation** `/patient/new`: category (Fever, Skin, Respiratory, Pain, Digestive, Injury, Other), symptoms, duration, optional age, optional notes, up to 3 photos with compression feedback, live emergency banner when red-flag text is detected (§11), submit. Draft auto-saved locally while typing.
- **Consultation detail** `/patient/consultations/[clientSubmissionId]`: status, summary, images (thumbnails first), message thread, reply box (only after sync), in-person-care banner if recommended.
- **History** `/patient/history`: paginated (20/page), reads Dexie first.
- **Settings**: Low Data Mode, image quality, sign out, remove data from this device.

## Status labels (icon + text; never color alone)

| Local `syncState` / server `status` | Label shown to patient |
|---|---|
| `queued` | ✓ Saved on this device — waiting for network |
| `syncing` | ⟳ Sending… |
| `retry_scheduled` | ! Couldn't send yet — will retry automatically |
| `needs_login` | ! Sign in again to send (your data is safe) |
| `failed_permanent` | ! This needs a small change before it can be sent — [Edit] |
| server `submitted` | ✓ Sent — waiting for a doctor |
| server `doctor_reviewing` | A doctor is reviewing your request |
| server `doctor_replied` | Doctor replied (unread badge) |
| server `completed` | Completed |

Sync status changes are announced in an `aria-live="polite"` region (`role="status"`).

## Doctor (tablet/desktop, sidebar layout)

- **Queue** `/doctor`: tabs *New · In review (mine) · Replied · Completed · Urgent*, filters for category and priority, server-side pagination (20/page), sorted urgent → oldest first. Card: `CS-1042 · Skin · 10:32 AM · 1 photo · Priority · Status`. Priority displayed = `coalesce(priority, suggested_priority)` with the label "Priority suggestion — final assessment must be made by a qualified healthcare professional."
- **Case view** `/doctor/consultations/[id]`: symptoms, duration, age, category, thumbnails (full image on tap via 5-min signed URL), message thread, and actions:
  **Start review** (claim) · **Send guidance** · **Ask follow-up question** · **Recommend in-person care** (sets `in_person_recommended`, priority `urgent_review`, posts a `system` message with standard text) · **Mark completed**.
- If claimed by another doctor: read-only with "Claimed by another doctor".

---

# 11. Triage hint & safety copy

**Rule-based, client-side, conservative.** Implement as a pure function `suggestPriority({symptoms, notes, category, age})` in `lib/triage` with unit tests. It never names a disease and never says "you have…".

- **Urgent review + emergency banner immediately** if text matches red flags (case-insensitive, word-boundary): chest pain, difficulty/trouble breathing, can't breathe, shortness of breath, unconscious, fainted, seizure, severe bleeding, heavy bleeding, stroke, face drooping, slurred speech, poison, overdose, snake bite, suicidal, throat swelling, severe allergic.
- **Needs attention:** vomiting blood, blood in stool/urine, high fever > 3 days, fever with rash, infant/baby (or age < 2), pregnant, spreading redness, getting worse, severe pain, head injury.
- Otherwise **Normal**.
- Never block submission, including offline — the banner explains not to wait for an online reply. Keyword matching has false negatives; the disclaimer says so.

**Exact safety copy (use verbatim):**

- Footer/disclaimer: *CareSync provides communication and consultation support. It does not replace professional medical diagnosis or emergency medical care.*
- Emergency banner: *If you believe this is an emergency, contact your local emergency medical service or visit the nearest emergency facility immediately. Do not wait for an online response.*
- Priority label: *Priority suggestion — final assessment must be made by a qualified healthcare professional.*
- In-person recommendation (patient view): *The doctor recommends in-person care for this consultation. Please visit a local clinic or hospital as soon as you can.*

---

# 12. Security checklist

- Only the anon/publishable key reaches the browser. `SUPABASE_SERVICE_ROLE_KEY` is used **only** by `scripts/seed-demo.ts`, never imported by app code, never `NEXT_PUBLIC_`. No secrets committed; `.env.example` provided; `.env*` git-ignored.
- RLS enabled on every table; §5 invariants tested with two real users.
- Private bucket, MIME/size limits, path-prefix policy, signed URLs (5 min), no permanent public URLs.
- Validate all input (zod client-side + DB constraints). Render user text as plain text (no `dangerouslySetInnerHTML`).
- Security headers via `next.config`: CSP (self + Supabase origin), `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy` limiting camera/mic to self.
- Doctor routes protected server-side (session + role check) **and** by RLS.
- No PII in logs; do not put case content in URLs or analytics.

---

# 13. Friendly error messages

Patients never see raw errors, status codes or SQL.

| Situation | Message |
|---|---|
| Offline at submit | Saved on this device. We'll send it automatically when you're back online. |
| Transient sync failure | We couldn't send this yet. Your information is safe on this device and we'll retry automatically. |
| Local save failed | We couldn't save this on your device (storage may be full). Nothing was lost from the form — try removing a photo. |
| Invalid image | That file doesn't look like a photo we can use. Please choose a JPG, PNG or WebP image. |
| Image too large | That photo is very large. Try a different one or take a new picture. |
| Session expired | Please sign in again to send your consultation. Your data is still saved. |
| Doctor already claimed case | Another doctor already started this case. |
| Generic | Something went wrong. Please try again in a moment. |

Technical details go to `console.error` (dev) only.

---

# 14. Accessibility & performance budgets

**Accessibility:** semantic HTML, labelled inputs, inline validation messages tied via `aria-describedby`, visible focus rings, keyboard operable, touch targets ≥ 44×44 px, contrast ≥ WCAG AA, meaningful alt text for images, icons always paired with text, respects `prefers-reduced-motion`.

**Performance (measure, don't guess):**
- Patient dashboard first-load JS ≲ 150 KB gzip (report the real number from the build output).
- Lazy-load the doctor bundle, the image compressor (until a photo is chosen) and non-critical components.
- Skeletons instead of blocking spinners; render from Dexie immediately.
- Lighthouse mobile Performance ≥ 85 on the production build, best effort; report the real score.
- No unnecessary dependencies; justify any library > 30 KB gzip.

---

# 15. Repo layout, env, scripts

```text
src/
├── app/
│   ├── (auth)/login, register
│   ├── patient/{page, new, history, settings, consultations/[id]}
│   ├── doctor/{page, consultations/[id]}
│   └── api/health/route.ts
├── components/{ui, patient, doctor, shared}
├── lib/{supabase, offline (dexie), sync (engine, outbox, backoff), image, network, triage, i18n}
├── hooks/  types/
public/{sw.js, manifest.webmanifest, icons/, offline.html}
supabase/{migrations/0001_init.sql, config.toml}
scripts/seed-demo.ts
tests/{unit, integration, e2e}
README.md  DEMO.md  .env.example
```

**Env (`.env.example`):**
```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=          # anon / publishable key
NEXT_PUBLIC_DEMO_TOOLS=0                # 1 shows the demo panel (§18)
SUPABASE_SERVICE_ROLE_KEY=              # seed script only — never expose to the browser
```

**Scripts:** `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:e2e`, `db:seed`.

**README must contain:** ≤5-command setup (local + cloud), env vars, how to create a doctor, how to run tests, how to run the golden path, Assumptions, Known limitations (unencrypted IndexedDB, keyword triage is crude, doctor portal online-only, shared doctor pool).

---

# 16. Build phases & gates

Time guidance (hackathon): Phases 0–4 ≈ 60% of the time. Do not trade Phase 4 quality for polish.

| Phase | Build | Gate (must pass before moving on) |
|---|---|---|
| **0 Setup** | Repo, deps, Tailwind, env validation, Supabase project/local, migration applied, seed script (1 doctor, 2 patients) | `build` passes; both seeded roles can sign in; migration applies cleanly on a fresh DB |
| **1 Auth + RLS** | Register (patient only), login, role routing, doctor server guard, RLS integration tests | All six security invariants (§5) proven by automated tests with two patients + one doctor |
| **2 Compression** | `compressImage` + thumbnails + UI feedback | Tests in a real browser: a generated 4000×3000 noisy image compresses under target, EXIF stripped, invalid file rejected |
| **3 Local-first form** | Dexie schema, new-consultation form, save + outbox, dashboard reading Dexie | With the network fully off: submit, reload, close/reopen → item still pending; no server code needed yet |
| **4 Sync engine** | Lock, queue, image upload, RPC submit, backoff, error classes, connectivity probe, pull | Golden-path steps 1–8 and **11 (lost response)** pass; unit tests for every row of §6.4 |
| **5 Doctor + messages** | Queue, filters, claim, guidance/follow-up, in-person, complete, patient thread + queued replies | Golden-path steps 9–10 pass; doctor B cannot modify doctor A's case |
| **6 PWA + Low Data + status UI** | SW, manifest, offline shell, Low Data Mode, full status label table, history, data-saved card | Production build opens offline after first visit; installable; Low Data Mode measurably changes preset/polling |
| **7 Hardening** | Triage hint, a11y/perf pass, demo tools, README/DEMO.md, final full test run | §19 checklist fully green |

P2 items (push notifications, network-quality auto-recommendation beyond the suggestion, multilingual UI) only after Phase 7.

---

# 17. Testing (write and run them)

**Unit (Vitest + `fake-indexeddb`)**
- Outbox/backoff: delay growth, cap, jitter bounds.
- Sync engine with a mocked Supabase client, one test per §6.4 row.
- **Lost response:** the mock performs the RPC successfully server-side, then throws client-side → retry returns the same id → exactly one consultation row and one image set.
- **Multi-tab:** two engines started simultaneously → only one processes the item.
- Triage: red-flag words, false-positive guard (e.g. "chest" alone doesn't trigger), age rule.
- Validation schemas.

**Browser-level (Playwright / Vitest browser mode)** — canvas behaviour cannot be trusted in jsdom.
- Compression: generated large image → under target, correct orientation, WebP or JPEG fallback, EXIF removed; bad file rejected.

**Integration (real Supabase, two patients + doctor):** all six §5 invariants, including storage path-prefix and signed-URL access for doctor vs. other patient.

**E2E (Playwright, production build)**
- Golden path (§3) using `context.setOffline(true/false)`, including close/reopen of the page while offline.
- **Lost response:** intercept the RPC with `route.fetch()` (server processes it) then `route.abort()`; go through a retry; assert one consultation in the doctor queue.
- Auth: unauthenticated user is redirected from `/doctor` and `/patient` (online); a patient cannot open `/doctor`.
- Doctor flow: claim → guidance → patient sees reply after pull.
- Low Data Mode switches the image preset and polling interval.

Run `lint`, `typecheck`, `test`, `test:e2e`, `build` and report the results.

---

# 18. Demo support

- `db:seed` creates: doctor (`doctor@demo.caresync`), two patients, and a few consultations with small generated placeholder images clearly labelled **DEMO**. Credentials are printed by the script and listed in DEMO.md. Seed data must never appear unless the seed script was run.
- When `NEXT_PUBLIC_DEMO_TOOLS=1`, show a small **Demo panel**: *Simulate offline* toggle (makes the engine/probe behave as if the network is down — app-level only, clearly labelled) and a live outbox counter. This makes live demos reliable when Wi-Fi toggling is flaky.
- `DEMO.md`: a 3-minute script following §3, plus the one-liner pitch: *Remote healthcare fails when the network does. CareSync is text-first, compresses photos on the device, saves consultations offline, and syncs exactly once when the connection returns.*
- Compression demo and Data-saved card must show real measured sizes only.

---

# 19. Definition of done & final report

**All must be true (verified, not assumed):**

- [ ] Patient and doctor authentication work; public sign-up cannot create doctors.
- [ ] Golden path (§3) passes manually **and** in Playwright, including close/reopen offline.
- [ ] Lost-response test yields exactly one consultation.
- [ ] Images are compressed in the browser before any upload; real sizes displayed and stored.
- [ ] Pending sync count and per-item status labels are accurate.
- [ ] Doctor can view queue, thumbnails, full images, claim, reply, ask follow-up, recommend in-person, complete.
- [ ] Patient sees replies and can answer follow-ups (queued when offline).
- [ ] All six security invariants proven by tests.
- [ ] Production build opens offline after first visit and is installable.
- [ ] Low Data Mode works and is visibly reflected.
- [ ] Disclaimer visible everywhere required; emergency banner appears for red-flag text.
- [ ] No raw technical errors shown to patients; no console errors in the golden path.
- [ ] No secrets committed; `.env.example` present; service-role key only in the seed script.
- [ ] `lint`, `typecheck`, `test`, `test:e2e`, `build` all pass.

**Final report format (concise):**
1. What works (mapped to the checklist above).
2. Commands run and their real results (test counts, build output, measured JS size, Lighthouse scores if run).
3. What is not done / known limitations.
4. Remaining configuration the human must do (env vars, Supabase project, creating a doctor).
5. Assumptions you made.

**Most important requirement:** prove, with the tests above, that the app stays useful when the internet is slow or gone, that no consultation is ever lost, and that none is ever created twice.
