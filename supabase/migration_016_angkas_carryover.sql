-- Migration 016: SOP ANGKAS carryover S1 → S2.
-- Aturan baru: sisa angkas Semester 1 yang belum terpakai (belum cair +
-- belum diproses) tetap bisa dipakai di Semester 2.
--   kuota S2 efektif = angkas_s2 + max(0, angkas_s1 − pakai_S1)
--   sisa S2 efektif  = kuota S2 efektif − pakai_S2
-- S1 tetap dibatasi angkas_s1 (tidak bisa meminjam dari S2).
-- Konvensi: S1 = 0 berarti tanpa batas S1. S2 tanpa batas HANYA bila
-- S1 dan S2 keduanya 0. Bila S1 > 0 sedangkan S2 = 0, maka S2 efektif
-- = sisa S1 (kasus "S1 ada 11 juta, S2 belum diatur" tetap bisa dipakai
-- di S2 sampai sisa S1).
-- Jalankan di SQL Editor (aman diulang).

-- ---------- 1. Helper kuota efektif ----------
create or replace function public.angkas_s2_efektif(
  p_angkas_s1 numeric, p_angkas_s2 numeric, p_pakai_s1 numeric
)
returns numeric language sql immutable as $$
  select coalesce(p_angkas_s2, 0)
    + case when coalesce(p_angkas_s1, 0) > 0
        then greatest(0::numeric, coalesce(p_angkas_s1, 0) - coalesce(p_pakai_s1, 0))
        else 0::numeric end
$$;

-- ---------- 2. View realisasi + sisa per semester (S2 = efektif) ----------
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
  -- Sisa S1 yang belum terpakai boleh dipakai lagi di S2 (juga bila S2 = 0):
  case
    when coalesce(bl.angkas_s1, 0) > 0
      then greatest(0::numeric, bl.angkas_s1 - coalesce(d.s1, 0) - coalesce(ip.s1, 0))
    else 0::numeric
  end::numeric(18,2) as carryover_s1,
  case
    when coalesce(bl.angkas_s1, 0) > 0
      then (bl.angkas_s2 + greatest(0::numeric, bl.angkas_s1 - coalesce(d.s1, 0) - coalesce(ip.s1, 0)))
    else bl.angkas_s2
  end::numeric(18,2) as angkas_s2_efektif,
  case
    when coalesce(bl.angkas_s2, 0) > 0 or coalesce(bl.angkas_s1, 0) > 0
      then (bl.angkas_s2 + case when coalesce(bl.angkas_s1, 0) > 0
              then greatest(0::numeric, bl.angkas_s1 - coalesce(d.s1, 0) - coalesce(ip.s1, 0))
              else 0::numeric end
            - coalesce(d.s2, 0) - coalesce(ip.s2, 0))
    else (bl.angkas_s2 - coalesce(d.s2, 0) - coalesce(ip.s2, 0))
  end::numeric(18,2) as sisa_s2,
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

-- ---------- 3. Trigger item: S2 memakai kuota efektif (S2 + sisa S1) ----------
create or replace function public.validate_pengajuan_item()
returns trigger language plpgsql as $$
declare
  v_status text; v_bidang uuid; v_tanggal date;
  v_item_bidang uuid;
  v_pagu numeric; v_cair numeric; v_diproses numeric; v_sisa numeric;
  v_angkas numeric; v_angkas_s1 numeric; v_cair_sem numeric; v_diproses_sem numeric; v_sisa_sem numeric;
  v_cair_s1 numeric; v_diproses_s1 numeric; v_carry numeric;
  v_sem int;
  v_new_sub text; v_other int;
begin
  select status, bidang_id, tanggal_pengajuan into v_status, v_bidang, v_tanggal
    from public.pengajuan where id = new.pengajuan_id;

  if v_status not in ('DRAFT','REVISI') then
    raise exception 'Item hanya bisa diubah saat DRAFT/REVISI (status saat ini: %)', v_status;
  end if;

  select bidang_id, pagu, angkas_s1, angkas_s2 into v_item_bidang, v_pagu, v_angkas_s1, v_angkas
    from public.budget_lines where id = new.budget_line_id;
  v_sem := public.semester_of(v_tanggal);
  if v_sem = 1 then
    v_angkas := v_angkas_s1;
  end if;
  -- v_sem = 2: v_angkas masih angkas_s2, nanti ditambah carryover di bawah.

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

  -- BLOK ANGKAS: S1 dibatasi kuota S1; S2 dibatasi kuota efektif
  -- (angkas_s2 + sisa S1 yang belum terpakai, berlaku juga bila S2 = 0).
  -- S2 tanpa batas hanya bila S1 & S2 keduanya 0.
  if coalesce(v_angkas, 0) > 0 or (v_sem = 2 and coalesce(v_angkas_s1, 0) > 0) then
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

    if v_sem = 2 and coalesce(v_angkas_s1, 0) > 0 then
      -- Carryover = sisa S1 (kuota S1 − cair S1 − diproses S1), minimal 0.
      select coalesce(sum(d.nominal),0) into v_cair_s1
        from public.disbursements d
        join public.pengajuan_items pi on pi.id = d.pengajuan_item_id
        join public.pengajuan p on p.id = d.pengajuan_id
        where pi.budget_line_id = new.budget_line_id
          and public.semester_of(p.tanggal_pengajuan) = 1
          and extract(year from p.tanggal_pengajuan) = extract(year from v_tanggal);

      select coalesce(sum(pi.nominal),0) into v_diproses_s1
        from public.pengajuan_items pi
        join public.pengajuan p on p.id = pi.pengajuan_id
        where pi.budget_line_id = new.budget_line_id
          and p.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN')
          and public.semester_of(p.tanggal_pengajuan) = 1
          and extract(year from p.tanggal_pengajuan) = extract(year from v_tanggal);

      v_carry := greatest(0::numeric, coalesce(v_angkas_s1, 0) - coalesce(v_cair_s1, 0) - coalesce(v_diproses_s1, 0));
      v_angkas := coalesce(v_angkas, 0) + v_carry;
    end if;

    v_sisa_sem := v_angkas - v_cair_sem - v_diproses_sem;
    if new.nominal > v_sisa_sem then
      if v_sem = 2 then
        raise exception 'DIBLOKIR ANGKAS Semester 2: nominal % melebihi sisa angkas efektif % (kuota S2 % + sisa S1 % - cair S2 % - diproses S2 %). Tanggal pengajuan % masuk Semester 2 (sisa S1 yang belum terpakai tetap bisa dipakai di S2).',
          new.nominal, v_sisa_sem, (v_angkas - coalesce(v_carry, 0)), coalesce(v_carry, 0), v_cair_sem, v_diproses_sem, v_tanggal;
      else
        raise exception 'DIBLOKIR ANGKAS Semester %: nominal % melebihi sisa angkas % (kuota % - cair semester % - diproses semester %). Tanggal pengajuan % masuk Semester % (S1: Jan–Jun, S2: Jul–Des).',
          v_sem, new.nominal, v_sisa_sem, v_angkas, v_cair_sem, v_diproses_sem, v_tanggal, v_sem;
      end if;
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

-- ---------- 4. RPC DIAJUKAN: cek ulang pagu + angkas efektif ----------
create or replace function public.ubah_status_pengajuan(p_pengajuan_id uuid, p_to text, p_catatan text default null, p_remark text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_from text; v_admin bool; v_tanggal date;
  v_item record;
  v_pagu numeric; v_cair numeric; v_diproses numeric; v_sisa numeric;
  v_angkas numeric; v_angkas_s1 numeric; v_cair_sem numeric; v_diproses_sem numeric; v_sisa_sem numeric;
  v_cair_s1 numeric; v_diproses_s1 numeric; v_carry numeric;
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
             bl.pagu, bl.angkas_s1,
             case when v_sem = 1 then bl.angkas_s1 else bl.angkas_s2 end as angkas
        from public.pengajuan_items pi
        join public.budget_lines bl on bl.id = pi.budget_line_id
       where pi.pengajuan_id = p_pengajuan_id
    loop
      v_pagu := v_item.pagu;
      v_angkas_s1 := v_item.angkas_s1;

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

      -- BLOK ANGKAS semester (S2 memakai kuota efektif = S2 + sisa S1;
      -- S2 tanpa batas hanya bila S1 & S2 keduanya 0)
      v_angkas := coalesce(v_item.angkas, 0);
      if v_angkas > 0 or (v_sem = 2 and coalesce(v_angkas_s1, 0) > 0) then
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

        v_carry := 0;
        if v_sem = 2 and coalesce(v_angkas_s1, 0) > 0 then
          select coalesce(sum(d.nominal), 0) into v_cair_s1
            from public.disbursements d
            join public.pengajuan_items pi2 on pi2.id = d.pengajuan_item_id
            join public.pengajuan p2 on p2.id = d.pengajuan_id
           where pi2.budget_line_id = v_item.budget_line_id
             and public.semester_of(p2.tanggal_pengajuan) = 1
             and extract(year from p2.tanggal_pengajuan) = extract(year from v_tanggal);

          select coalesce(sum(pi3.nominal), 0) into v_diproses_s1
            from public.pengajuan_items pi3
            join public.pengajuan p3 on p3.id = pi3.pengajuan_id
           where pi3.budget_line_id = v_item.budget_line_id
             and pi3.pengajuan_id <> p_pengajuan_id
             and p3.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN')
             and public.semester_of(p3.tanggal_pengajuan) = 1
             and extract(year from p3.tanggal_pengajuan) = extract(year from v_tanggal);

          v_carry := greatest(0::numeric, coalesce(v_angkas_s1, 0) - coalesce(v_cair_s1, 0) - coalesce(v_diproses_s1, 0));
          v_angkas := v_angkas + v_carry;
        end if;

        v_sisa_sem := v_angkas - v_cair_sem - v_diproses_sem;
        if v_item.nominal > v_sisa_sem then
          if v_sem = 2 then
            raise exception 'DIBLOKIR ANGKAS Semester 2: uraian % (%) nominal % melebihi sisa angkas efektif % (kuota S2 % + sisa S1 % - cair S2 % - diproses S2 %). Tanggal % masuk Semester 2 (sisa S1 yang belum terpakai tetap bisa dipakai di S2).',
              v_item.kode_uraian, v_item.nama_uraian, v_item.nominal,
              v_sisa_sem, (v_angkas - v_carry), v_carry, v_cair_sem, v_diproses_sem, v_tanggal;
          else
            raise exception 'DIBLOKIR ANGKAS Semester %: uraian % (%) nominal % melebihi sisa angkas % (kuota % - cair semester % - diproses semester %). Tanggal % masuk Semester % (S1: Jan–Jun, S2: Jul–Des).',
              v_sem, v_item.kode_uraian, v_item.nama_uraian, v_item.nominal,
              v_sisa_sem, v_angkas, v_cair_sem, v_diproses_sem, v_tanggal, v_sem;
          end if;
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
