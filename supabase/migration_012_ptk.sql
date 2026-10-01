-- ============================================================
-- Migration 012: Data PTK (Pejabat Pelaksana Teknis Kegiatan)
-- Dipakai untuk mencetak NPD: nama + NIP penanda tangan per bidang.
-- Cara pakai: Supabase Dashboard > SQL Editor > paste file ini > Run
-- Aman dijalankan berulang (idempotent).
-- ============================================================

-- 1) Tabel master PTK: satu bidang boleh punya beberapa PTK.
create table if not exists public.ptk (
  id uuid primary key default gen_random_uuid(),
  bidang_id uuid not null references public.bidang(id) on delete cascade,
  nama text not null,                          -- nama + gelar, mis. "DENNI JAMRUDINAVIA, S.IP., MM"
  nip text not null default '',                -- format dokumen, mis. "19810604 201001 2 001"
  jabatan text not null default 'Pejabat Pelaksana Teknis Kegiatan',
  aktif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_ptk_bidang_nama unique (bidang_id, nama)
);
create index if not exists idx_ptk_bidang on public.ptk(bidang_id);

-- 2) Kolom ptk_id pada pengajuan: PTK yang ditunjuk saat mengajukan NPD.
alter table public.pengajuan
  add column if not exists ptk_id uuid references public.ptk(id) on delete set null;

-- 3) RLS: semua user terautentikasi boleh baca PTK bidangnya (untuk dropdown),
--    tulis hanya admin.
alter table public.ptk enable row level security;

drop policy if exists "ptk_select" on public.ptk;
create policy "ptk_select" on public.ptk for select to authenticated
  using (public.is_admin() or bidang_id = public.my_bidang_id());

drop policy if exists "ptk_admin_write" on public.ptk;
create policy "ptk_admin_write" on public.ptk for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 4) updated_at otomatis (fungsi touch_updated_at sudah ada dari schema.sql).
drop trigger if exists trg_touch_ptk on public.ptk;
create trigger trg_touch_ptk before update on public.ptk
  for each row execute function public.touch_updated_at();

-- 5) Verifikasi:
--    select b.nama as bidang, p.nama, p.nip from public.ptk p
--      join public.bidang b on b.id = p.bidang_id order by b.nama, p.nama;
