-- Migrasi 002 — izinkan REVISI -> DRAFT agar revisi nominal dikerjakan di DRAFT.
-- Remark revisi tetap tersimpan (tabel revisi_remarks append-only, tidak dihapus saat pindah status).
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
create or replace function public.is_valid_transition(p_from text, p_to text)
returns boolean language sql immutable as $$
  select case
    when p_from = 'DRAFT' and p_to in ('DIAJUKAN','DITOLAK') then true
    when p_from = 'DIAJUKAN' and p_to in ('DIPROSES','REVISI','DITOLAK','DRAFT') then true
    when p_from = 'DIPROSES' and p_to in ('REVISI','SIAP_DICAIRKAN','DITOLAK') then true
    when p_from = 'REVISI' and p_to in ('DRAFT','DIAJUKAN','DITOLAK') then true
    when p_from = 'SIAP_DICAIRKAN' and p_to in ('CAIR','REVISI','DITOLAK') then true
    when p_from = 'CAIR' and p_to in ('SELESAI') then true
    else false
  end
$$;
