-- Migrasi 004 — izinkan kembali ke DRAFT dari DIPROSES / SIAP_DICAIRKAN.
-- Mendukung flow History: DIPROSES -> [Revisi | Kembali draft | Cairkan].
-- Cairkan langsung dari DIPROSES ditangani aplikasi (otomatis via SIAP_DICAIRKAN dulu).
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
create or replace function public.is_valid_transition(p_from text, p_to text)
returns boolean language sql immutable as $$
  select case
    when p_from = 'DRAFT' and p_to in ('DIAJUKAN','DITOLAK') then true
    when p_from = 'DIAJUKAN' and p_to in ('DIPROSES','REVISI','DITOLAK','DRAFT') then true
    when p_from = 'DIPROSES' and p_to in ('REVISI','SIAP_DICAIRKAN','DITOLAK','DRAFT') then true
    when p_from = 'REVISI' and p_to in ('DRAFT','DIAJUKAN','DITOLAK') then true
    when p_from = 'SIAP_DICAIRKAN' and p_to in ('CAIR','REVISI','DITOLAK','DRAFT') then true
    when p_from = 'CAIR' and p_to in ('SELESAI') then true
    else false
  end
$$;
