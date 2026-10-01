-- ============================================================
-- RESET DATA TRANSAKSI + HISTORY (aman diulang)
-- Menjaga master: bidang, ptk, profiles (akun & role tetap).
-- Menghapus: pengajuan + items + disbursements + status_history
--            + revisi_remarks + audit_logs + budget_lines (pagu/angkas).
-- Urutan child-dulu agar lolos foreign key.
-- Cara pakai: Supabase Dashboard > SQL Editor > paste > Run.
-- ============================================================

-- 1) Log & timeline (child dari pengajuan)
DELETE FROM public.audit_logs;
DELETE FROM public.status_history;
DELETE FROM public.revisi_remarks;

-- 2) Realisasi (child dari pengajuan_items, restrict ke pengajuan)
DELETE FROM public.disbursements;

-- 3) Item pengajuan (child dari pengajuan)
DELETE FROM public.pengajuan_items;

-- 4) Header pengajuan
DELETE FROM public.pengajuan;

-- 5) Pagu / budget lines (di-restrict oleh items, tapi items sudah kosong)
DELETE FROM public.budget_lines;

-- Verifikasi: semua harus 0
SELECT 'audit_logs' AS tabel, COUNT(*) AS sisa FROM public.audit_logs
UNION ALL SELECT 'status_history', COUNT(*) FROM public.status_history
UNION ALL SELECT 'revisi_remarks', COUNT(*) FROM public.revisi_remarks
UNION ALL SELECT 'disbursements', COUNT(*) FROM public.disbursements
UNION ALL SELECT 'pengajuan_items', COUNT(*) FROM public.pengajuan_items
UNION ALL SELECT 'pengajuan', COUNT(*) FROM public.pengajuan
UNION ALL SELECT 'budget_lines', COUNT(*) FROM public.budget_lines;
