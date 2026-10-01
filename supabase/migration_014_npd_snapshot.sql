-- Migration 014: bekukan (snapshot) kondisi anggaran NPD saat pertama DIAJUKAN.
-- Masalah: cetak ulang NPD memakai v_budget_realisasi TERKINI, sehingga setelah
-- NPD dicairkan (masuk realisasi), dokumen cetak ulang ikut berubah
-- (pagu/realisasi/sisa berbeda dari saat pertama diajukan).
-- Aturan yang benar:
--   1. Pencairan TETAP masuk realisasi (dashboard/pagu/sisa terkini berubah) — jangan diubah.
--   2. Cetak ulang NPD harus SAMA PERSIS dengan saat pertama diajukan — pakai snapshot.
-- Cara pakai: Supabase Dashboard > SQL Editor > paste file ini > Run (aman diulang).
--
-- Isi:
--   1. Kolom snapshot di public.pengajuan (scope = uraian yang dipakai NPD ini,
--      sama seperti dokumen a/b/c) + rincian per uraian se-sub kegiatan (lembar kendali).
--   2. Trigger: isi snapshot SEKALI saat pertama DRAFT/REVISI -> DIAJUKAN.
--      Revisi + ajukan ulang TIDAK menimpa snapshot (dokumen acuan = pengajuan pertama).
--      Nilai snapshot = kondisi saat itu (pagu & realisasi cair, TANPA nominal NPD ini
--      karena saat DIAJUKAN belum cair dan belum masuk diproses untuk dirinya sendiri).
--   3. Backfill: NPD lama yang sudah pernah DIAJUKAN tapi belum punya snapshot
--      diisi dengan rekonstruksi (nilai terkini MINUS pencairan milik NPD itu sendiri),
--      sehingga cetak ulangnya stabil mulai sekarang.

-- ---------- 1. Kolom snapshot ----------
alter table public.pengajuan
  add column if not exists snapshot_pagu numeric(18,2),
  add column if not exists snapshot_realisasi numeric(18,2),
  add column if not exists snapshot_sisa numeric(18,2),
  add column if not exists snapshot_at timestamptz,
  add column if not exists snapshot_items jsonb not null default '[]'::jsonb;

-- ---------- 2. Fungsi capture snapshot (sekali saja) ----------
create or replace function public.capture_npd_snapshot()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pagu numeric(18,2) := 0;
  v_realisasi numeric(18,2) := 0;
  v_items jsonb := '[]'::jsonb;
begin
  -- Hanya saat pertama kali DRAFT/REVISI -> DIAJUKAN dan belum pernah disnapshot.
  if old.status in ('DRAFT', 'REVISI')
     and new.status = 'DIAJUKAN'
     and old.snapshot_at is null
     and new.snapshot_at is null
  then
    -- Total scope dokumen (uraian yang dipakai NPD ini).
    -- realisasi = yang sudah CAIR saja (disbursements), tanpa nominal NPD ini
    -- (belum cair saat diajukan) — persis angka yang tampil di dokumen pertama.
    select
      coalesce(sum(bl.pagu), 0),
      coalesce(sum(
        (select coalesce(sum(d.nominal), 0)
           from public.disbursements d
           join public.pengajuan_items pi2 on pi2.id = d.pengajuan_item_id
          where pi2.budget_line_id = bl.id)
      ), 0)
      into v_pagu, v_realisasi
      from public.pengajuan_items pi
      join public.budget_lines bl on bl.id = pi.budget_line_id
     where pi.pengajuan_id = new.id;

    new.snapshot_pagu := v_pagu;
    new.snapshot_realisasi := v_realisasi;
    -- Definisi dokumen: sisa = pagu - realisasi (tanpa diproses),
    -- sama seperti rumus cetak NPD (totalSisa = totalPagu - totalRealisasi).
    new.snapshot_sisa := v_pagu - v_realisasi;
    new.snapshot_at := now();

    -- Rincian per uraian se-sub kegiatan (untuk lembar kendali):
    -- seluruh uraian dalam sub kegiatan NPD ini, masing-masing dibekukan
    -- pagu + realisasi-cair saat itu + rencana (nominal NPD ini, 0 bila bukan itemnya).
    select coalesce(jsonb_agg(to_jsonb(x) order by x.kode_uraian), '[]'::jsonb)
      into v_items
      from (
        select
          bl.id as budget_line_id,
          bl.kode_uraian,
          bl.nama_uraian,
          bl.pagu,
          coalesce((
            select sum(d.nominal)
              from public.disbursements d
              join public.pengajuan_items pi2 on pi2.id = d.pengajuan_item_id
             where pi2.budget_line_id = bl.id
          ), 0)::numeric(18,2) as realisasi,
          (bl.pagu - coalesce((
            select sum(d.nominal)
              from public.disbursements d
              join public.pengajuan_items pi2 on pi2.id = d.pengajuan_item_id
             where pi2.budget_line_id = bl.id
          ), 0))::numeric(18,2) as sisa,
          coalesce((
            select sum(pi3.nominal)
              from public.pengajuan_items pi3
             where pi3.pengajuan_id = new.id
               and pi3.budget_line_id = bl.id
          ), 0)::numeric(18,2) as rencana
          from public.budget_lines bl
         where bl.bidang_id = new.bidang_id
           and bl.tahun = new.tahun
           and bl.kode_sub_kegiatan in (
                 select distinct bl2.kode_sub_kegiatan
                   from public.pengajuan_items pi4
                   join public.budget_lines bl2 on bl2.id = pi4.budget_line_id
                  where pi4.pengajuan_id = new.id
               )
      ) x;
    new.snapshot_items := coalesce(v_items, '[]'::jsonb);
  end if;
  return new;
end $$;

drop trigger if exists trg_capture_npd_snapshot on public.pengajuan;
create trigger trg_capture_npd_snapshot
  before update of status on public.pengajuan
  for each row execute function public.capture_npd_snapshot();

-- ---------- 3. Backfill NPD lama (tanpa menimpa yang sudah ada) ----------
-- Rekonstruksi = nilai terkini MINUS pencairan milik NPD itu sendiri.
-- Ini mengembalikan angka ke kondisi sebelum NPD tersebut cair,
-- sehingga cetak ulang NPD lama langsung stabil (tidak berubah lagi oleh cairnya sendiri).
-- Catatan: NPD lain yang cair SESUDAH pengajuan ini tidak bisa direkonstruksi sempurna
-- dari data kini; untuk NPD lama itu adalah pendekatan terbaik tanpa time-travel.
-- NPD baru (setelah migrasi ini) memakai snapshot presisi via trigger di atas.
do $$
declare
  r record;
  v_pagu numeric(18,2);
  v_realisasi_now numeric(18,2);
  v_own numeric(18,2);
  v_items jsonb;
begin
  for r in
    select id, bidang_id, tahun
      from public.pengajuan
     where snapshot_at is null
       and status not in ('DRAFT', 'REVISI')
  loop
    select
      coalesce(sum(bl.pagu), 0),
      coalesce(sum(
        (select coalesce(sum(d.nominal), 0)
           from public.disbursements d
           join public.pengajuan_items pi2 on pi2.id = d.pengajuan_item_id
          where pi2.budget_line_id = bl.id)
      ), 0),
      coalesce(sum(
        (select coalesce(sum(d2.nominal), 0)
           from public.disbursements d2
           join public.pengajuan_items pi_own on pi_own.id = d2.pengajuan_item_id
          where pi_own.budget_line_id = bl.id
            and pi_own.pengajuan_id = r.id)
      ), 0)
      into v_pagu, v_realisasi_now, v_own
      from public.pengajuan_items pi
      join public.budget_lines bl on bl.id = pi.budget_line_id
     where pi.pengajuan_id = r.id;

    select coalesce(jsonb_agg(to_jsonb(x) order by x.kode_uraian), '[]'::jsonb)
      into v_items
      from (
        select
          bl.id as budget_line_id,
          bl.kode_uraian,
          bl.nama_uraian,
          bl.pagu,
          greatest(0, coalesce((
            select sum(d.nominal)
              from public.disbursements d
              join public.pengajuan_items pi2 on pi2.id = d.pengajuan_item_id
             where pi2.budget_line_id = bl.id
          ), 0) - coalesce((
            select sum(d3.nominal)
              from public.disbursements d3
              join public.pengajuan_items pi_own2 on pi_own2.id = d3.pengajuan_item_id
             where pi_own2.budget_line_id = bl.id
               and pi_own2.pengajuan_id = r.id
          ), 0))::numeric(18,2) as realisasi,
          0::numeric(18,2) as sisa,
          coalesce((
            select sum(pi3.nominal)
              from public.pengajuan_items pi3
             where pi3.pengajuan_id = r.id
               and pi3.budget_line_id = bl.id
          ), 0)::numeric(18,2) as rencana
          from public.budget_lines bl
         where bl.bidang_id = r.bidang_id
           and bl.tahun = r.tahun
           and bl.kode_sub_kegiatan in (
                 select distinct bl2.kode_sub_kegiatan
                   from public.pengajuan_items pi4
                   join public.budget_lines bl2 on bl2.id = pi4.budget_line_id
                  where pi4.pengajuan_id = r.id
               )
      ) x;

    -- isi sisa = pagu - realisasi per baris (definisi dokumen)
    select coalesce(jsonb_agg(
      to_jsonb(x) || jsonb_build_object('sisa', (x.pagu::numeric - x.realisasi::numeric))
      order by x.kode_uraian
    ), '[]'::jsonb)
      into v_items
      from (
        select
          (e->>'budget_line_id')::uuid as budget_line_id,
          e->>'kode_uraian' as kode_uraian,
          e->>'nama_uraian' as nama_uraian,
          (e->>'pagu')::numeric as pagu,
          (e->>'realisasi')::numeric as realisasi,
          (e->>'rencana')::numeric as rencana
          from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) e
      ) x;

    update public.pengajuan
       set snapshot_pagu = v_pagu,
           snapshot_realisasi = greatest(0, v_realisasi_now - v_own),
           snapshot_sisa = v_pagu - greatest(0, v_realisasi_now - v_own),
           snapshot_items = coalesce(v_items, '[]'::jsonb),
           snapshot_at = now()
     where id = r.id;
  end loop;
end $$;
