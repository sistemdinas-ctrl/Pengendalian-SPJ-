-- Migration 009: REVISI → DIPROSES (admin klik "Proses" untuk memproses ulang)
-- Dari REVISI admin bisa: Proses (→ DIPROSES) atau Kembalikan ke DRAFT

-- Update is_valid_transition: REVISI bisa ke DIPROSES dan DRAFT
create or replace function public.is_valid_transition(p_from text, p_to text)
returns boolean language sql immutable as $$
  select case
    when p_from = 'DRAFT' and p_to in ('DIAJUKAN','DITOLAK') then true
    when p_from = 'DIAJUKAN' and p_to in ('DIPROSES','REVISI','DITOLAK','DRAFT') then true
    when p_from = 'DIPROSES' and p_to in ('REVISI','SIAP_DICAIRKAN','DITOLAK','DRAFT') then true
    when p_from = 'REVISI' and p_to in ('DRAFT','DIPROSES','DITOLAK') then true
    when p_from = 'SIAP_DICAIRKAN' and p_to in ('CAIR','SELESAI','REVISI','DITOLAK','DRAFT') then true
    when p_from = 'CAIR' and p_to in ('SELESAI') then true
    else false
  end
$$;
