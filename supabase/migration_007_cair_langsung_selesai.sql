-- Migrasi 007 — pencairan langsung berstatus SELESAI (tanpa status CAIR).
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
-- Catatan: baris lama yang masih CAIR tetap valid (transisi CAIR -> SELESAI masih diizinkan).
create or replace function public.is_valid_transition(p_from text, p_to text)
returns boolean language sql immutable as $$
  select case
    when p_from = 'DRAFT' and p_to in ('DIAJUKAN','DITOLAK') then true
    when p_from = 'DIAJUKAN' and p_to in ('DIPROSES','REVISI','DITOLAK','DRAFT') then true
    when p_from = 'DIPROSES' and p_to in ('REVISI','SIAP_DICAIRKAN','DITOLAK','DRAFT') then true
    when p_from = 'REVISI' and p_to in ('DRAFT','DIAJUKAN','DITOLAK') then true
    when p_from = 'SIAP_DICAIRKAN' and p_to in ('CAIR','SELESAI','REVISI','DITOLAK','DRAFT') then true
    when p_from = 'CAIR' and p_to in ('SELESAI') then true
    else false
  end
$$;

create or replace function public.cairkan_pengajuan(p_pengajuan_id uuid, p_idempotency_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_status text; v_total numeric; r record; v_count int := 0;
begin
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mencairkan';
  end if;

  select status, total_nominal into v_status, v_total
    from public.pengajuan where id = p_pengajuan_id for update;

  if not found then raise exception 'Pengajuan tidak ditemukan'; end if;
  if v_status <> 'SIAP_DICAIRKAN' then
    raise exception 'Hanya status SIAP_DICAIRKAN yang bisa dicairkan (saat ini: %)', v_status;
  end if;

  -- idempotency: jika key sudah dipakai untuk pengajuan ini, kembalikan hasil lama
  if exists (select 1 from public.disbursements where pengajuan_id = p_pengajuan_id and idempotency_key = p_idempotency_key) then
    return jsonb_build_object('ok', true, 'idempotent', true, 'total', v_total);
  end if;

  for r in select id, nominal from public.pengajuan_items where pengajuan_id = p_pengajuan_id loop
    insert into public.disbursements (pengajuan_id, pengajuan_item_id, nominal, idempotency_key, dicairkan_oleh)
    values (p_pengajuan_id, r.id, r.nominal, p_idempotency_key || ':' || r.id::text, auth.uid())
    on conflict (pengajuan_item_id) do nothing;
    get diagnostics v_count = row_count;
  end loop;

  -- Langsung SELESAI, tanpa mampir ke CAIR.
  update public.pengajuan set status = 'SELESAI' where id = p_pengajuan_id;

  insert into public.audit_logs (actor, action, entity, entity_id, metadata)
  values (auth.uid(), 'pencairan', 'pengajuan', p_pengajuan_id::text,
          jsonb_build_object('total', v_total, 'idempotency_key', p_idempotency_key));

  return jsonb_build_object('ok', true, 'idempotent', false, 'total', v_total);
end $$;
