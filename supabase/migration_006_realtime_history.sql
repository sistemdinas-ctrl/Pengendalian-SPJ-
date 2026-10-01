-- Migrasi 006 — aktifkan realtime untuk halaman History (tanpa refresh manual).
-- Polling 10 detik di aplikasi tetap jalan sebagai cadangan bila realtime belum aktif.
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pengajuan'
  ) then
    alter publication supabase_realtime add table public.pengajuan;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pengajuan_items'
  ) then
    alter publication supabase_realtime add table public.pengajuan_items;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'revisi_remarks'
  ) then
    alter publication supabase_realtime add table public.revisi_remarks;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'status_history'
  ) then
    alter publication supabase_realtime add table public.status_history;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'disbursements'
  ) then
    alter publication supabase_realtime add table public.disbursements;
  end if;
end $$;
