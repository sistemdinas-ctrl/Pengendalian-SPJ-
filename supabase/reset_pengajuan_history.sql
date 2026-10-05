-- ============================================================
-- HAPUS SEMUA HISTORY PENGAJUAN (aman diulang)
-- Menjaga master: bidang, budget_lines (pagu), ptk, profiles.
-- Menghapus: pengajuan + items + disbursements + status_history
--            + revisi_remarks + audit_logs terkait pengajuan.
-- Cara pakai: Supabase Dashboard > SQL Editor > paste > Run.
-- ============================================================

-- 1) Log & timeline (child dari pengajuan)
DELETE FROM public.audit_logs WHERE entity = 'pengajuan';
DELETE FROM public.status_history;
DELETE FROM public.revisi_remarks;

-- 2) Realisasi (child dari pengajuan_items, restrict ke pengajuan)
DELETE FROM public.disbursements;

-- 3) Item pengajuan (child dari pengajuan)
DELETE FROM public.pengajuan_items;

-- 4) Header pengajuan (history utama)
DELETE FROM public.pengajuan;

-- Verifikasi: semua harus 0
SELECT 'status_history' AS tabel, COUNT(*) AS sisa FROM public.status_history
UNION ALL SELECT 'revisi_remarks', COUNT(*) FROM public.revisi_remarks
UNION ALL SELECT 'disbursements', COUNT(*) FROM public.disbursements
UNION ALL SELECT 'pengajuan_items', COUNT(*) FROM public.pengajuan_items
UNION ALL SELECT 'pengajuan', COUNT(*) FROM public.pengajuan
UNION ALL SELECT 'audit_logs pengajuan', COUNT(*) FROM public.audit_logs WHERE entity = 'pengajuan';
