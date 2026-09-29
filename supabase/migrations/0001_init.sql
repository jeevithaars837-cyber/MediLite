-- CareSync Database Migration (0001_init.sql)
create extension if not exists pgcrypto;

-- Enums
create type public.user_role as enum ('patient','doctor');
create type public.symptom_category as enum ('fever','skin','respiratory','pain','digestive','injury','other');
create type public.priority_level as enum ('normal','needs_attention','urgent_review');
create type public.consultation_status as enum ('submitted','doctor_reviewing','doctor_replied','completed');
create type public.message_kind as enum ('patient_message','follow_up_question','guidance','system');

-- Touch updated_at function
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Profiles table (linked to auth.users)
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

-- New users are ALWAYS patients; metadata can never choose a role
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

-- Helper function to check if caller is doctor
create or replace function public.is_doctor() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'doctor');
$$;

-- Consultations table
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
  suggested_priority public.priority_level not null default 'normal', -- client hint
  priority public.priority_level,                                    -- doctor override
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

-- Consultation Images table
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

-- Messages table
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

-- Helper function to check if user ID is a doctor
create or replace function public.is_doctor_id(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = uid and role = 'doctor');
$$;

-- Message insert trigger moves consultation status
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

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_insert();

-- ───────── Row Level Security ─────────
alter table public.profiles enable row level security;
alter table public.consultations enable row level security;
alter table public.consultation_images enable row level security;
alter table public.messages enable row level security;

-- profiles policy
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid() or public.is_doctor());
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- consultations policy
create policy consultations_select on public.consultations for select to authenticated
  using (patient_id = auth.uid() or public.is_doctor());
create policy consultations_insert_patient on public.consultations for insert to authenticated
  with check (patient_id = auth.uid() and status = 'submitted' and doctor_id is null
              and priority is null and in_person_recommended = false);
revoke update on public.consultations from authenticated, anon;
grant update (status, priority, in_person_recommended, doctor_id) on public.consultations to authenticated;
create policy consultations_update_doctor on public.consultations for update to authenticated
  using (public.is_doctor() and (doctor_id is null or doctor_id = auth.uid()))
  with check (public.is_doctor() and doctor_id = auth.uid());

-- consultation_images policy
create policy images_select on public.consultation_images for select to authenticated
  using (exists (select 1 from public.consultations c
                 where c.id = consultation_id and (c.patient_id = auth.uid() or public.is_doctor())));
create policy images_insert_patient on public.consultation_images for insert to authenticated
  with check (exists (select 1 from public.consultations c
                      where c.id = consultation_id and c.patient_id = auth.uid()));

-- messages policy
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

-- ───────── Idempotent, atomic submit RPC function ─────────
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
  if v_id is not null then return v_id; end if;          -- duplicate → return same id

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

-- ───────── Storage Bucket Policy ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consultation-images', 'consultation-images', false, 1048576, array['image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy storage_patient_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'consultation-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_patient_update on storage.objects for update to authenticated
  using (bucket_id = 'consultation-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_read on storage.objects for select to authenticated
  using (bucket_id = 'consultation-images'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_doctor()));
