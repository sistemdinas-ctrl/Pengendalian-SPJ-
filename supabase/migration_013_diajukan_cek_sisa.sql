-- Migration 013: cegah pengajuan yang bikin sisa pagu MINUS.
-- Kasus: item ditulis saat sisa masih cukup, lalu pagu terkuras NPD lain
-- (cair/diproses) sebelum pengajuan ini diajukan. Trigger validate_pengajuan_item
-- hanya jalan saat tulis item (DRAFT), jadi celah ini lolos sampai DIAJUKAN.
-- Perbaikan dipasang di RPC ubah_status_pengajuan (satu pintu semua jalur:
-- user ajukan, admin, revisi -> diajukan). Jalankan di SQL Editor (aman diulang).
create or replace function public.ubah_status_pengajuan(p_pengajuan_id uuid, p_to text, p_catatan text default null, p_remark text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_from text; v_admin bool;
  v_item record;
  v_pagu numeric; v_cair numeric; v_diproses numeric; v_sisa numeric;
begin
  v_admin := public.is_admin();
  select status into v_from from public.pengajuan where id = p_pengajuan_id for update;
  if not found then raise exception 'Pengajuan tidak ditemukan'; end if;

  -- user tidak boleh memproses pencairan / siap_cair / memaksa ke CAIR
  if not v_admin and p_to in ('DIPROSES','SIAP_DICAIRKAN','CAIR','SELESAI') then
    raise exception 'Hanya admin yang dapat mengubah ke %', p_to;
  end if;
  -- hanya admin yang boleh memberi revisi/ditolak dari jalur proses
  if not v_admin and p_to in ('REVISI','DITOLAK') then
    raise exception 'Hanya admin yang dapat memberi revisi/penolakan';
  end if;
  -- hanya admin yang boleh mengembalikan ke DRAFT; user tinggal ubah + ajukan ulang
  if not v_admin and p_to = 'DRAFT' then
    raise exception 'Hanya admin yang dapat mengembalikan ke DRAFT';
  end if;

  -- CEGAH MINUS: saat diajukan, nominal tiap item tidak boleh melebihi
  -- sisa pagu uraian saat ini (pagu - sudah cair - sedang diproses NPD lain).
  if p_to = 'DIAJUKAN' and v_from in ('DRAFT', 'REVISI') then
    for v_item in
      select pi.nominal, pi.budget_line_id, bl.kode_uraian, bl.nama_uraian
        from public.pengajuan_items pi
        join public.budget_lines bl on bl.id = pi.budget_line_id
       where pi.pengajuan_id = p_pengajuan_id
    loop
      select bl2.pagu into v_pagu
        from public.budget_lines bl2 where bl2.id = v_item.budget_line_id;

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
