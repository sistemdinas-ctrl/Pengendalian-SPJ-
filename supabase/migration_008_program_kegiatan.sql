-- ============================================================
-- Migration 008: Kolom Program & Kegiatan pada Pagu (budget_lines)
-- Hierarki anggaran: Bidang > Program > Kegiatan > Sub Kegiatan > Uraian
-- Cara pakai: Supabase Dashboard > SQL Editor > paste file ini > Run
-- ============================================================

-- 1) Tambah kolom program & kegiatan (opsional, '' = belum diisi,
--    supaya data lama tetap valid tanpa backfill).
alter table public.budget_lines
  add column if not exists kode_program text not null default '',
  add column if not exists nama_program text not null default '',
  add column if not exists kode_kegiatan text not null default '',
  add column if not exists nama_kegiatan text not null default '';

-- 2) View realisasi dibuat ulang agar kolom baru ikut terbaca aplikasi.
--    HARUS drop dulu karena PostgreSQL tidak izinkan ubah nama/posisi kolom
--    lewat CREATE OR REPLACE (error 42P16: cannot change name of view column).
--    CASCADE sekaligus menghapus v_dashboard_bidang yang bergantung padanya,
--    lalu keduanya dibuat ulang di bawah ini.
drop view if exists public.v_dashboard_bidang cascade;
drop view if exists public.v_budget_realisasi cascade;

-- Definisi WAJIB sama dengan supabase/schema.sql (termasuk kolom `diproses`
-- dari migration_010) supaya halaman History/Dashboard tidak kehilangan kolom.
create view public.v_budget_realisasi as
with disbursed as (
  select pi.budget_line_id, coalesce(sum(d.nominal), 0) as total
  from public.pengajuan_items pi
  join public.disbursements d on d.pengajuan_item_id = pi.id
  group by pi.budget_line_id
),
in_process as (
  select pi.budget_line_id, coalesce(sum(pi.nominal), 0) as total
  from public.pengajuan_items pi
  join public.pengajuan p on p.id = pi.pengajuan_id
  where p.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN')
  group by pi.budget_line_id
)
select
  bl.id as budget_line_id,
  bl.bidang_id,
  bl.tahun,
  bl.kode_program,
  bl.nama_program,
  bl.kode_kegiatan,
  bl.nama_kegiatan,
  bl.kode_sub_kegiatan,
  bl.nama_sub_kegiatan,
  bl.kode_uraian,
  bl.nama_uraian,
  bl.pagu,
  coalesce(d.total, 0)::numeric(18,2) as realisasi,
  coalesce(ip.total, 0)::numeric(18,2) as diproses,
  (bl.pagu - coalesce(d.total, 0) - coalesce(ip.total, 0))::numeric(18,2) as sisa,
  case when bl.pagu = 0 then 0
       else round(coalesce(d.total, 0) / bl.pagu * 100, 2) end as persen_realisasi
from public.budget_lines bl
left join disbursed d on d.budget_line_id = bl.id
left join in_process ip on ip.budget_line_id = bl.id;

-- Recreate v_dashboard_bidang yang bergantung pada v_budget_realisasi
-- (bentuk kolom tetap sama seperti schema.sql / migration_010).
create view public.v_dashboard_bidang as
select
  b.id as bidang_id,
  b.nama as bidang,
  extract(year from now())::int as tahun_ref,
  coalesce(sum(bl.pagu),0)::numeric(18,2) as total_pagu,
  coalesce(sum(v.realisasi),0)::numeric(18,2) as total_realisasi,
  coalesce(sum(v.diproses),0)::numeric(18,2) as total_diproses,
  coalesce(sum(v.sisa),0)::numeric(18,2) as total_sisa,
  case when coalesce(sum(bl.pagu),0) = 0 then 0
       else round(coalesce(sum(v.realisasi),0) / sum(bl.pagu) * 100, 2) end as persen
from public.bidang b
left join public.budget_lines bl on bl.bidang_id = b.id
left join public.v_budget_realisasi v on v.budget_line_id = bl.id
group by b.id, b.nama;

-- View tetap tunduk pada RLS penanya (PostgreSQL 15+).
alter view public.v_budget_realisasi set (security_invoker = true);
alter view public.v_dashboard_bidang set (security_invoker = true);

-- Catatan: kunci unik TIDAK berubah — tetap
-- (bidang_id, kode_sub_kegiatan, kode_uraian, tahun).
-- Kolom program/kegiatan hanyalah pelengkap hierarki tampilan.