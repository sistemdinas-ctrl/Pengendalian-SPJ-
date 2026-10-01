-- Migrasi 001 — untuk database yang sudah menjalankan schema.sql SEBELUM file ini ada.
-- Fungsi: view realisasi ikut RLS user yang query (security_invoker),
-- sehingga user biasa TIDAK bisa mengintip pagu bidang lain lewat view.
-- Jalankan sekali di Supabase Dashboard > SQL Editor. Aman dijalankan ulang.
alter view public.v_budget_realisasi set (security_invoker = true);
alter view public.v_dashboard_bidang set (security_invoker = true);
