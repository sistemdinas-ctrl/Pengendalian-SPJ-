-- Migration 015: ANGKAS SEMESTER 1 & 2 per uraian (budget_lines).
-- Semester 1 = Januari–Juni, Semester 2 = Juli–Desember (dari pengajuan.tanggal_pengajuan).
-- Contoh: pagu 1000, angkas_s1 400, angkas_s2 600 -> pengajuan bertanggal
-- Jan–Jun totalnya (cair + diproses NPD lain di semester yg sama) tidak boleh
-- lebih dari 400, kalau lebih DITOLAK (kena blok) di trigger maupun RPC DIAJUKAN.
-- Konvensi: 0 / NULL = belum diatur = tidak ada batas semester (hanya batas pagu).
-- Jalankan di SQL Editor (aman diulang).

-- ---------- 1. Kolom baru ----------
alter table public.budget_lines
  add column if not exists angkas_s1 numeric(18,2) not null default 0 check (angkas_s1 >= 0);
alter table public.budget_lines
  add column if not exists angkas_s2 numeric(18,2) not null default 0 check (angkas_s2 >= 0);

-- Total angkas tidak boleh melebihi pagu (kecuali keduanya 0 = belum diatur).
alter table public.budget_lines drop constraint if exists chk_angkas_le_pagu;
alter table public.budget_lines
  add constraint chk_angkas_le_pagu
  check (angkas_s1 + angkas_s2 <= pagu);

-- ---------- 2. Helper semester ----------
create or replace function public.semester_of(p_tanggal date)
returns int language sql immutable as $$
  select case when extract(month from p_tanggal) between 1 and 6 then 1 else 2 end
$$;

-- ---------- 3. View realisasi + sisa per semester ----------
drop view if exists public.v_dashboard_bidang;
drop view if exists public.v_budget_realisasi;

create view public.v_budget_realisasi as
with disbursed as (
  select pi.budget_line_id,
    coalesce(sum(case when extract(month from p.tanggal_pengajuan) between 1 and 6 then d.nominal else 0 end), 0) as s1,
    coalesce(sum(case when extract(month from p.tanggal_pengajuan) between 7 and 12 then d.nominal else 0 end), 0) as s2,
    coalesce(sum(d.nominal), 0) as total
  from public.pengajuan_items pi
  join public.disbursements d on d.pengajuan_item_id = pi.id
  join public.pengajuan p on p.id = d.pengajuan_id
  group by pi.budget_line_id
),
in_process as (
  select pi.budget_line_id,
    coalesce(sum(case when extract(month from p.tanggal_pengajuan) between 1 and 6 then pi.nominal else 0 end), 0) as s1,
    coalesce(sum(case when extract(month from p.tanggal_pengajuan) between 7 and 12 then pi.nominal else 0 end), 0) as s2,
    coalesce(sum(pi.nominal), 0) as total
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
  bl.angkas_s1,
  bl.angkas_s2,
  coalesce(d.total, 0)::numeric(18,2) as realisasi,
  coalesce(d.s1, 0)::numeric(18,2) as realisasi_s1,
  coalesce(d.s2, 0)::numeric(18,2) as realisasi_s2,
  coalesce(ip.total, 0)::numeric(18,2) as diproses,
  coalesce(ip.s1, 0)::numeric(18,2) as diproses_s1,
  coalesce(ip.s2, 0)::numeric(18,2) as diproses_s2,
  (bl.pagu - coalesce(d.total, 0) - coalesce(ip.total, 0))::numeric(18,2) as sisa,
  (bl.angkas_s1 - coalesce(d.s1, 0) - coalesce(ip.s1, 0))::numeric(18,2) as sisa_s1,
  (bl.angkas_s2 - coalesce(d.s2, 0) - coalesce(ip.s2, 0))::numeric(18,2) as sisa_s2,
  case when bl.pagu = 0 then 0
       else round(coalesce(d.total, 0) / bl.pagu * 100, 2) end as persen_realisasi
from public.budget_lines bl
left join disbursed d on d.budget_line_id = bl.id
left join in_process ip on ip.budget_line_id = bl.id;

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

alter view public.v_budget_realisasi set (security_invoker = true);
alter view public.v_dashboard_bidang set (security_invoker = true);

-- ---------- 4. Trigger item: cek pagu + cek angkas semester ----------
create or replace function public.validate_pengajuan_item()
returns trigger language plpgsql as $$
declare
  v_status text; v_bidang uuid; v_tanggal date;
  v_item_bidang uuid;
  v_pagu numeric; v_cair numeric; v_diproses numeric; v_sisa numeric;
  v_angkas numeric; v_cair_sem numeric; v_diproses_sem numeric; v_sisa_sem numeric;
  v_sem int;
  v_new_sub text; v_other int;
begin
  select status, bidang_id, tanggal_pengajuan into v_status, v_bidang, v_tanggal
    from public.pengajuan where id = new.pengajuan_id;

  if v_status not in ('DRAFT','REVISI') then
    raise exception 'Item hanya bisa diubah saat DRAFT/REVISI (status saat ini: %)', v_status;
  end if;

  select bidang_id, pagu, angkas_s1, angkas_s2 into v_item_bidang, v_pagu, v_angkas, v_cair_sem
    from public.budget_lines where id = new.budget_line_id;
  -- v_angkas dipakai ulang di bawah; ambil s1/s2 sesuai semester
  v_sem := public.semester_of(v_tanggal);
  if v_sem = 1 then
    select angkas_s1 into v_angkas from public.budget_lines where id = new.budget_line_id;
  else
    select angkas_s2 into v_angkas from public.budget_lines where id = new.budget_line_id;
  end if;

  if v_item_bidang is distinct from v_bidang then
    raise exception 'Uraian bukan milik bidang pengajuan';
  end if;

  -- Sudah cair (realisasi) — semua semester
  select coalesce(sum(d.nominal),0) into v_cair
    from public.disbursements d
    join public.pengajuan_items pi on pi.id = d.pengajuan_item_id
    where pi.budget_line_id = new.budget_line_id;

  -- Sedang diproses dari pengajuan lain
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

  -- BLOK ANGKAS: pemakaian semester yang sama (cair + diproses NPD lain
  -- yang tanggalnya satu semester) tidak boleh melampaui kuota semester.
  if coalesce(v_angkas, 0) > 0 then
    select coalesce(sum(d.nominal),0) into v_cair_sem
      from public.disbursements d
      join public.pengajuan_items pi on pi.id = d.pengajuan_item_id
      join public.pengajuan p on p.id = d.pengajuan_id
      where pi.budget_line_id = new.budget_line_id
        and public.semester_of(p.tanggal_pengajuan) = v_sem
        and extract(year from p.tanggal_pengajuan) = extract(year from v_tanggal);

    select coalesce(sum(pi.nominal),0) into v_diproses_sem
      from public.pengajuan_items pi
      join public.pengajuan p on p.id = pi.pengajuan_id
      where pi.budget_line_id = new.budget_line_id
        and p.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN')
        and public.semester_of(p.tanggal_pengajuan) = v_sem
        and extract(year from p.tanggal_pengajuan) = extract(year from v_tanggal);

    v_sisa_sem := v_angkas - v_cair_sem - v_diproses_sem;
    if new.nominal > v_sisa_sem then
      raise exception 'DIBLOKIR ANGKAS Semester %: nominal % melebihi sisa angkas % (kuota % - cair semester % - diproses semester %). Tanggal pengajuan % masuk Semester % (S1: Jan–Jun, S2: Jul–Des).',
        v_sem, new.nominal, v_sisa_sem, v_angkas, v_cair_sem, v_diproses_sem, v_tanggal, v_sem;
    end if;
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

drop trigger if exists trg_validate_item on public.pengajuan_items;
create trigger trg_validate_item
  before insert or update on public.pengajuan_items
  for each row execute function public.validate_pengajuan_item();

-- ---------- 5. RPC DIAJUKAN: cek ulang pagu + angkas (tanggal bisa berubah) ----------
create or replace function public.ubah_status_pengajuan(p_pengajuan_id uuid, p_to text, p_catatan text default null, p_remark text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_from text; v_admin bool; v_tanggal date;
  v_item record;
  v_pagu numeric; v_cair numeric; v_diproses numeric; v_sisa numeric;
  v_angkas numeric; v_cair_sem numeric; v_diproses_sem numeric; v_sisa_sem numeric;
  v_sem int;
begin
  v_admin := public.is_admin();
  select status, tanggal_pengajuan into v_from, v_tanggal from public.pengajuan where id = p_pengajuan_id for update;
  if not found then raise exception 'Pengajuan tidak ditemukan'; end if;

  if not v_admin and p_to in ('DIPROSES','SIAP_DICAIRKAN','CAIR','SELESAI') then
    raise exception 'Hanya admin yang dapat mengubah ke %', p_to;
  end if;
  if not v_admin and p_to in ('REVISI','DITOLAK') then
    raise exception 'Hanya admin yang dapat memberi revisi/penolakan';
  end if;
  if not v_admin and p_to = 'DRAFT' then
    raise exception 'Hanya admin yang dapat mengembalikan ke DRAFT';
  end if;

  if p_to = 'DIAJUKAN' and v_from in ('DRAFT', 'REVISI') then
    v_sem := public.semester_of(v_tanggal);
    for v_item in
      select pi.nominal, pi.budget_line_id, bl.kode_uraian, bl.nama_uraian,
             bl.pagu, case when v_sem = 1 then bl.angkas_s1 else bl.angkas_s2 end as angkas
        from public.pengajuan_items pi
        join public.budget_lines bl on bl.id = pi.budget_line_id
       where pi.pengajuan_id = p_pengajuan_id
    loop
      v_pagu := v_item.pagu;

      select coalesce(sum(d.nominal), 0) into v_cair
        from public.disbursements d
        join public.pengajuan_items pi2 on pi2.id = d.pengajuan_item_id
       where pi2.budget_line_id = v_item.budget_line_id;

      select coalesce(sum(pi3.nominal), 0) into v_diproses
        from public.pengajuan_items pi3
        join public.pengajuan p3 on p3.id = pi3.pengajuan_id
       where pi3.budget_line_id = v_item.budget_line_id
         and pi3.pengajuan_id <> p_pengajuan_id
         and p3.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN');

      v_sisa := coalesce(v_pagu, 0) - v_cair - v_diproses;
      if v_item.nominal > v_sisa then
        raise exception 'Uraian % (%) nominal % melebihi sisa pagu % (pagu % - cair % - diproses %). Pengajuan ditolak agar sisa tidak minus.',
          v_item.kode_uraian, v_item.nama_uraian, v_item.nominal,
          v_sisa, v_pagu, v_cair, v_diproses;
      end if;

      -- BLOK ANGKAS semester
      v_angkas := coalesce(v_item.angkas, 0);
      if v_angkas > 0 then
        select coalesce(sum(d.nominal), 0) into v_cair_sem
          from public.disbursements d
          join public.pengajuan_items pi2 on pi2.id = d.pengajuan_item_id
          join public.pengajuan p2 on p2.id = d.pengajuan_id
         where pi2.budget_line_id = v_item.budget_line_id
           and public.semester_of(p2.tanggal_pengajuan) = v_sem
           and extract(year from p2.tanggal_pengajuan) = extract(year from v_tanggal);

        select coalesce(sum(pi3.nominal), 0) into v_diproses_sem
          from public.pengajuan_items pi3
          join public.pengajuan p3 on p3.id = pi3.pengajuan_id
         where pi3.budget_line_id = v_item.budget_line_id
           and pi3.pengajuan_id <> p_pengajuan_id
           and p3.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN')
           and public.semester_of(p3.tanggal_pengajuan) = v_sem
           and extract(year from p3.tanggal_pengajuan) = extract(year from v_tanggal);

        v_sisa_sem := v_angkas - v_cair_sem - v_diproses_sem;
        if v_item.nominal > v_sisa_sem then
          raise exception 'DIBLOKIR ANGKAS Semester %: uraian % (%) nominal % melebihi sisa angkas % (kuota % - cair semester % - diproses semester %). Tanggal % masuk Semester % (S1: Jan–Jun, S2: Jul–Des).',
            v_sem, v_item.kode_uraian, v_item.nama_uraian, v_item.nominal,
            v_sisa_sem, v_angkas, v_cair_sem, v_diproses_sem, v_tanggal, v_sem;
        end if;
      end if;
    end loop;
  end if;

  update public.pengajuan set status = p_to where id = p_pengajuan_id;

  if p_to = 'REVISI' and p_remark is not null then
    insert into public.revisi_remarks (pengajuan_id, remark, diberikan_oleh)
    values (p_pengajuan_id, p_remark, auth.uid());
  end if;

  insert into public.status_history (pengajuan_id, from_status, to_status, catatan, diubah_oleh)
  values (p_pengajuan_id, v_from, p_to, p_catatan, auth.uid());

  insert into public.audit_logs (actor, action, entity, entity_id, metadata)
  values (auth.uid(), 'ubah_status', 'pengajuan', p_pengajuan_id::text,
          jsonb_build_object('from', v_from, 'to', p_to, 'catatan', p_catatan));

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to);
end $$;
