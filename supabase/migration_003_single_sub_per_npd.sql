-- Migrasi 003 — tegakkan 1 NPD = 1 sub kegiatan (boleh banyak uraian dari sub itu).
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
-- Catatan: jika ada data lama yang 1 NPD berisi 2 sub berbeda, migrasi fungsi tetap
-- berhasil, tapi insert/update berikutnya ke NPD tersebut akan ditolak sampai
-- disisakan 1 sub saja (pisahkan ke NPD terpisah).
create or replace function public.validate_pengajuan_item()
returns trigger language plpgsql as $$
declare
  v_status text; v_bidang uuid; v_item_bidang uuid;
  v_pagu numeric; v_cair numeric; v_sisa numeric;
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

  select coalesce(sum(d.nominal),0) into v_cair
    from public.disbursements d
    join public.pengajuan_items pi on pi.id = d.pengajuan_item_id
    where pi.budget_line_id = new.budget_line_id;

  v_sisa := v_pagu - v_cair;
  if new.nominal > v_sisa then
    raise exception 'Nominal % melebihi sisa pagu % (kode uraian terkait)', new.nominal, v_sisa;
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
