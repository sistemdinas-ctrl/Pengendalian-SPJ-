-- Migration 011: Tambah kolom nip di profiles untuk cetak NPD
-- Jalankan di Supabase Dashboard > SQL Editor

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS nip text;

COMMENT ON COLUMN public.profiles.nip IS 'NIP pejabat untuk cetak NPD';
