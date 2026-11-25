-- Fix: generator nomor NPD bentrok saat ada data dihapus (gap).
-- Lama: count(*)+1 -> bisa sama dengan nomor yang sudah ada -> error 23505.
-- Baru: max(nomor urut)+1, dengan advisory lock per bidang+tahun agar aman
-- kalau dua user submit bersamaan.

create or replace function public.generate_nomor_pengajuan()
returns trigger
language plpgsql
as $function$
declare
  v_kode text;
  v_max  int;
  v_seq  int;
  v_lock bigint;
begin
  select kode into v_kode from public.bidang where id = new.bidang_id;

  -- Kunci satu "slot" per bidang+tahun supaya dua insert bersamaan tidak dapat nomor sama.
  v_lock := hashtextextended(coalesce(v_kode,'XX') || ':' || new.tahun::text, 0);
  perform pg_advisory_xact_lock(v_lock);

  select coalesce(max(substring(nomor_pengajuan from '\d+$')::int), 0)
    into v_max
    from public.pengajuan
   where bidang_id = new.bidang_id
     and tahun = new.tahun;

  v_seq := v_max + 1;
  new.nomor_pengajuan := format('NPD/%s/%s/%s', new.tahun, coalesce(v_kode,'XX'), lpad(v_seq::text, 4, '0'));
  return new;
end
$function$;
