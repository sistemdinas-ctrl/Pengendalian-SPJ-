-- Migration 010: Sisa pagu juga dikurangi nominal yang sedang DIPROSES
-- Pengajuan status DIAJUKAN/DIPROSES/SIAP_DICAIRKAN mengurangi sisa pagu
-- Agar tidak ada overbooking (2 NPD yang sama uraian)

-- 1. Update view v_budget_realisasi: tambah kolom diproses, sisa = pagu - cair - diproses
-- Harus DROP dulu karena CREATE OR REPLACE tidak bisa ubah nama/posisi kolom
drop view if exists public.v_dashboard_bidang;
drop view if exists public.v_budget_realisasi;

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

-- 2. Update trigger validate_pengajuan_item: cek juga nominal yang sedang diproses
create or replace function public.validate_pengajuan_item()
returns trigger language plpgsql as $$
declare
  v_status text; v_bidang uuid; v_item_bidang uuid;
  v_pagu numeric; v_cair numeric; v_diproses numeric; v_sisa numeric;
  v_new_sub text; v_other int;
begin
  select status, bidang_id into v_status, v_bidang
    from public.pengajuan where id = new.pengajuan_id;

  if v_status not in ('DRAFT','REVISI') then
    raise exception 'Item hanya bisa diubah saat DRAFT/REVISI (status saat ini: %)', v_status;
  end if;

  select bidang_id, pagu into v_item_bidang, v_pagu
    from public.budget_lines where id = new.budget_line_id;

  if v_item_bidang is distinct from v_bidang then
    raise exception 'Uraian bukan milik bidang pengajuan';
  end if;

  -- Sudah cair (realisasi)
  select coalesce(sum(d.nominal),0) into v_cair
    from public.disbursements d
    join public.pengajuan_items pi on pi.id = d.pengajuan_item_id
    where pi.budget_line_id = new.budget_line_id;

  -- Sedang diproses (DIAJUKAN / DIPROSES / SIAP_DICAIRKAN) dari pengajuan lain
  select coalesce(sum(pi.nominal),0) into v_diproses
    from public.pengajuan_items pi
    join public.pengajuan p on p.id = pi.pengajuan_id
    where pi.budget_line_id = new.budget_line_id
      and p.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN');

  v_sisa := v_pagu - v_cair - v_diproses;
  if new.nominal > v_sisa then
    raise exception 'Nominal % melebihi sisa pagu % (sisa: pagu % minus cair % minus dalam proses %)',
      new.nominal, v_sisa, v_pagu, v_cair, v_diproses;
  end if;

  -- Aturan: 1 NPD hanya boleh 1 sub kegiatan (boleh banyak uraian dari sub itu).
  select kode_sub_kegiatan into v_new_sub from public.budget_lines where id = new.budget_line_id;
  select count(*) into v_other
    from public.pengajuan_items pi
    join public.budget_lines bl on bl.id = pi.budget_line_id
   where pi.pengajuan_id = new.pengajuan_id
     and pi.budget_line_id is distinct from new.budget_line_id
     and bl.kode_sub_kegiatan is distinct from v_new_sub;
  if v_other > 0 then
    raise exception '1 NPD hanya boleh 1 sub kegiatan. Buat NPD terpisah untuk sub yang berbeda.';
  end if;

  return new;
end $$;

-- 3. Recreate v_dashboard_bidang (depends on v_budget_realisasi)
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

-- 4. Set security_invoker
alter view public.v_budget_realisasi set (security_invoker = true);
alter view public.v_dashboard_bidang set (security_invoker = true);
