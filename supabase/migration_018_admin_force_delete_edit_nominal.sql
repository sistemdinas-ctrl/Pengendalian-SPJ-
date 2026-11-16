-- Migration 018: akses khusus ADMIN untuk
--   1. Menghapus permanen pengajuan dalam status apa pun (termasuk CAIR/SELESAI),
--      sehingga dana cair dikeluarkan dari realisasi dan sisa pagu kembali.
--   2. Mengoreksi nominal item pengajuan yang sudah terkunci (CAIR/SELESAI),
--      sekaligus menyinkronkan nominal disbursements + snapshot dokumen.
--
-- Kedua RPC di bawah hanya bisa dipanggil oleh admin (public.is_admin()).
-- Jalankan di Supabase Dashboard > SQL Editor (aman diulang).

-- ---------- 1. Izinkan RPC koreksi nominal melewati trigger validasi ----------
-- Validasi pagu/angkas tetap dilakukan LENGKAP di RPC, tetapi dengan
-- mengeluarkan kontribusi NPD ini sendiri agar nominal lama tidak dihitung ganda.
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
  -- Koreksi nominal oleh admin via RPC: validasi lengkap dilakukan di RPC.
  if coalesce(current_setting('sicair.admin_nominal_edit', true), '') = 'on'
     and public.is_admin() then
    return new;
  end if;

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

  if v_item_bidang is distinct from v_bidang then
    raise exception 'Uraian bukan milik bidang pengajuan';
  end if;

  -- Sudah cair (realisasi) - semua semester
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
      -- Carryover = sisa S1 (kuota S1 - cair S1 - diproses S1), minimal 0.
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
        raise exception 'DIBLOKIR ANGKAS Semester %: nominal % melebihi sisa angkas % (kuota % - cair semester % - diproses semester %). Tanggal pengajuan % masuk Semester % (S1: Jan-Jun, S2: Jul-Des).',
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

-- ---------- 2. RPC: hapus permanen pengajuan (admin, status apa pun) ----------
-- Dana cair dihapus dari disbursements -> realisasi turun dan sisa pagu kembali.
-- Item, history, dan remark ikut terhapus (cascade). Jejak aksi tetap disimpan
-- di audit_logs.
create or replace function public.admin_hapus_pengajuan(
  p_pengajuan_id uuid,
  p_alasan text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_row record;
  v_items int := 0;
  v_dana numeric := 0;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menghapus pengajuan';
  end if;

  select id, nomor_pengajuan, status, total_nominal, bidang_id, tahun
    into v_row
    from public.pengajuan
   where id = p_pengajuan_id
   for update;
  if not found then
    raise exception 'Pengajuan tidak ditemukan';
  end if;

  select count(*) into v_items
    from public.pengajuan_items where pengajuan_id = p_pengajuan_id;

  select coalesce(sum(nominal), 0) into v_dana
    from public.disbursements where pengajuan_id = p_pengajuan_id;

  insert into public.audit_logs (actor, action, entity, entity_id, metadata)
  values (auth.uid(), 'admin_hapus_pengajuan', 'pengajuan', p_pengajuan_id::text,
          jsonb_build_object(
            'nomor_pengajuan', v_row.nomor_pengajuan,
            'status', v_row.status,
            'total_nominal', v_row.total_nominal,
            'jumlah_item', v_items,
            'dana_dikembalikan', v_dana,
            'alasan', p_alasan
          ));

  delete from public.disbursements where pengajuan_id = p_pengajuan_id;
  delete from public.pengajuan_items where pengajuan_id = p_pengajuan_id;
  delete from public.pengajuan where id = p_pengajuan_id;

  return jsonb_build_object(
    'ok', true,
    'nomor_pengajuan', v_row.nomor_pengajuan,
    'status', v_row.status,
    'total', v_row.total_nominal,
    'jumlah_item', v_items,
    'dana_dikembalikan', v_dana
  );
end $$;

-- ---------- 3. RPC: koreksi nominal item (admin, status apa pun) ----------
-- p_items = [{"id": "<pengajuan_item_id>", "nominal": 123456}, ...]
-- Nominal baru divalidasi terhadap sisa pagu + sisa angkas semester, dengan
-- mengeluarkan kontribusi NPD ini sendiri (karena nominal lama diganti).
create or replace function public.admin_ubah_nominal_pengajuan(
  p_pengajuan_id uuid,
  p_items jsonb,
  p_alasan text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_status text; v_tanggal date; v_nomor text; v_snapshot_at timestamptz;
  v_elem jsonb; v_item_id uuid; v_bl_id uuid;
  v_old numeric; v_new numeric;
  v_pagu numeric; v_angkas_s1 numeric; v_angkas_s2 numeric;
  v_kode text; v_nama text;
  v_sem int; v_angkas numeric;
  v_cair numeric; v_diproses numeric; v_sisa numeric;
  v_cair_sem numeric; v_diproses_sem numeric; v_sisa_sem numeric;
  v_cair_s1 numeric; v_diproses_s1 numeric; v_carry numeric;
  v_changes jsonb := '[]'::jsonb;
  v_total numeric := 0;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mengubah nominal pengajuan';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Daftar item nominal tidak boleh kosong';
  end if;

  select status, tanggal_pengajuan, nomor_pengajuan, snapshot_at
    into v_status, v_tanggal, v_nomor, v_snapshot_at
    from public.pengajuan
   where id = p_pengajuan_id
   for update;
  if not found then
    raise exception 'Pengajuan tidak ditemukan';
  end if;

  if jsonb_array_length(p_items) <>
     (select count(distinct (e->>'id')) from jsonb_array_elements(p_items) e) then
    raise exception 'Ada item duplikat dalam permintaan';
  end if;

  -- Trigger validasi item dilewati; validasi lengkap dilakukan di loop ini.
  perform set_config('sicair.admin_nominal_edit', 'on', true);

  for v_elem in select * from jsonb_array_elements(p_items) loop
    v_item_id := (v_elem->>'id')::uuid;
    v_new := (v_elem->>'nominal')::numeric;

    select pi.nominal, pi.budget_line_id
      into v_old, v_bl_id
      from public.pengajuan_items pi
     where pi.id = v_item_id
       and pi.pengajuan_id = p_pengajuan_id;
    if not found then
      raise exception 'Item % bukan milik pengajuan ini', v_item_id;
    end if;
    if v_new is null or v_new <= 0 then
      raise exception 'Nominal item harus lebih dari 0';
    end if;

    select pagu, angkas_s1, angkas_s2, kode_uraian, nama_uraian
      into v_pagu, v_angkas_s1, v_angkas_s2, v_kode, v_nama
      from public.budget_lines
     where id = v_bl_id
     for update;

    -- Realisasi + diproses dari NPD LAIN (milik sendiri dikeluarkan).
    select coalesce(sum(d.nominal), 0) into v_cair
      from public.disbursements d
      join public.pengajuan_items pi on pi.id = d.pengajuan_item_id
     where pi.budget_line_id = v_bl_id
       and d.pengajuan_id <> p_pengajuan_id;

    select coalesce(sum(pi.nominal), 0) into v_diproses
      from public.pengajuan_items pi
      join public.pengajuan p on p.id = pi.pengajuan_id
     where pi.budget_line_id = v_bl_id
       and pi.pengajuan_id <> p_pengajuan_id
       and p.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN');

    v_sisa := coalesce(v_pagu, 0) - v_cair - v_diproses;
    if v_new > v_sisa then
      raise exception 'Nominal % melebihi sisa pagu % untuk uraian % (%) (pagu % - cair NPD lain % - diproses NPD lain %)',
        v_new, v_sisa, v_kode, v_nama, v_pagu, v_cair, v_diproses;
    end if;

    -- Cek angkas semester (S2 = kuota efektif S2 + sisa S1).
    v_sem := public.semester_of(v_tanggal);
    v_angkas := case when v_sem = 1 then coalesce(v_angkas_s1, 0) else coalesce(v_angkas_s2, 0) end;
    v_carry := 0;

    if v_sem = 2 and coalesce(v_angkas_s1, 0) > 0 then
      select coalesce(sum(d.nominal), 0) into v_cair_s1
        from public.disbursements d
        join public.pengajuan_items pi on pi.id = d.pengajuan_item_id
        join public.pengajuan p on p.id = d.pengajuan_id
       where pi.budget_line_id = v_bl_id
         and d.pengajuan_id <> p_pengajuan_id
         and public.semester_of(p.tanggal_pengajuan) = 1
         and extract(year from p.tanggal_pengajuan) = extract(year from v_tanggal);

      select coalesce(sum(pi.nominal), 0) into v_diproses_s1
        from public.pengajuan_items pi
        join public.pengajuan p on p.id = pi.pengajuan_id
       where pi.budget_line_id = v_bl_id
         and pi.pengajuan_id <> p_pengajuan_id
         and p.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN')
         and public.semester_of(p.tanggal_pengajuan) = 1
         and extract(year from p.tanggal_pengajuan) = extract(year from v_tanggal);

      v_carry := greatest(0::numeric, coalesce(v_angkas_s1, 0) - v_cair_s1 - v_diproses_s1);
      v_angkas := v_angkas + v_carry;
    end if;

    if v_angkas > 0 or (v_sem = 2 and coalesce(v_angkas_s1, 0) > 0) then
      select coalesce(sum(d.nominal), 0) into v_cair_sem
        from public.disbursements d
        join public.pengajuan_items pi on pi.id = d.pengajuan_item_id
        join public.pengajuan p on p.id = d.pengajuan_id
       where pi.budget_line_id = v_bl_id
         and d.pengajuan_id <> p_pengajuan_id
         and public.semester_of(p.tanggal_pengajuan) = v_sem
         and extract(year from p.tanggal_pengajuan) = extract(year from v_tanggal);

      select coalesce(sum(pi.nominal), 0) into v_diproses_sem
        from public.pengajuan_items pi
        join public.pengajuan p on p.id = pi.pengajuan_id
       where pi.budget_line_id = v_bl_id
         and pi.pengajuan_id <> p_pengajuan_id
         and p.status in ('DIAJUKAN', 'DIPROSES', 'SIAP_DICAIRKAN')
         and public.semester_of(p.tanggal_pengajuan) = v_sem
         and extract(year from p.tanggal_pengajuan) = extract(year from v_tanggal);

      v_sisa_sem := v_angkas - v_cair_sem - v_diproses_sem;
      if v_new > v_sisa_sem then
        raise exception 'DIBLOKIR ANGKAS Semester %: uraian % (%) nominal % melebihi sisa angkas % (kuota efektif % - cair % - diproses %)',
          v_sem, v_kode, v_nama, v_new, v_sisa_sem, v_angkas, v_cair_sem, v_diproses_sem;
      end if;
    end if;

    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'id', v_item_id,
      'budget_line_id', v_bl_id,
      'kode_uraian', v_kode,
      'dari', v_old,
      'menjadi', v_new
    ));

    update public.pengajuan_items set nominal = v_new where id = v_item_id;
    update public.disbursements set nominal = v_new where pengajuan_item_id = v_item_id;

    -- Sinkronkan rencana pada snapshot dokumen (lembar kendali) bila sudah ada.
    if v_snapshot_at is not null then
      update public.pengajuan
         set snapshot_items = coalesce((
           select jsonb_agg(
             case when e->>'budget_line_id' = v_bl_id::text
                  then e || jsonb_build_object('rencana', v_new)
                  else e end
             order by e->>'kode_uraian')
           from jsonb_array_elements(snapshot_items) e
         ), '[]'::jsonb)
       where id = p_pengajuan_id;
    end if;
  end loop;

  perform set_config('sicair.admin_nominal_edit', 'off', true);

  select coalesce(sum(nominal), 0) into v_total
    from public.pengajuan_items where pengajuan_id = p_pengajuan_id;

  insert into public.audit_logs (actor, action, entity, entity_id, metadata)
  values (auth.uid(), 'admin_ubah_nominal', 'pengajuan', p_pengajuan_id::text,
          jsonb_build_object(
            'nomor_pengajuan', v_nomor,
            'status', v_status,
            'alasan', p_alasan,
            'perubahan', v_changes
          ));

  return jsonb_build_object(
    'ok', true,
    'nomor_pengajuan', v_nomor,
    'status', v_status,
    'total', v_total,
    'items', v_changes
  );
end $$;
