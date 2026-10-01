-- Migrasi 005 — hanya admin yang boleh mengembalikan ke DRAFT.
-- User tinggal mengubah nominal/sub/uraian setelah dikembalikan admin, lalu mengajukan ulang.
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
create or replace function public.ubah_status_pengajuan(p_pengajuan_id uuid, p_to text, p_catatan text default null, p_remark text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_from text; v_admin bool;
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
