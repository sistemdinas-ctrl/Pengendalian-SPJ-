-- ============================================================
-- FIX NAMA program/kegiatan/sub/uraian BESAR SEMUA -> Besar Kecil
-- Langsung di database (tabel public.budget_lines, tahun 2026).
-- Aturan: kapital tiap kata, kata sambung (dan, di, dari, ...) kecil,
-- singkatan dinas (RAD, APBD, NPD, ...) tetap BESAR semua.
-- Aman diulang (idempotent): dijalankan 2x hasilnya sama.
-- Cara pakai: Supabase Dashboard > SQL Editor > paste > Run.
-- ============================================================

-- 1) Fungsi proper-case Indonesia (dibuat sekali, dipakai UPDATE + ke depan)
CREATE OR REPLACE FUNCTION public.propercase_id(s text)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r text;
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  r := initcap(s);
  -- kata sambung/depan -> kecil (hanya kata utuh, bukan bagian kata lain)
  r := regexp_replace(r, '\mDan\M', 'dan', 'g');
  r := regexp_replace(r, '\mAtau\M', 'atau', 'g');
  r := regexp_replace(r, '\mSerta\M', 'serta', 'g');
  r := regexp_replace(r, '\mMaupun\M', 'maupun', 'g');
  r := regexp_replace(r, '\mDi\M', 'di', 'g');
  r := regexp_replace(r, '\mKe\M', 'ke', 'g');
  r := regexp_replace(r, '\mDari\M', 'dari', 'g');
  r := regexp_replace(r, '\mPada\M', 'pada', 'g');
  r := regexp_replace(r, '\mDalam\M', 'dalam', 'g');
  r := regexp_replace(r, '\mUntuk\M', 'untuk', 'g');
  r := regexp_replace(r, '\mDengan\M', 'dengan', 'g');
  r := regexp_replace(r, '\mOleh\M', 'oleh', 'g');
  r := regexp_replace(r, '\mSebagai\M', 'sebagai', 'g');
  r := regexp_replace(r, '\mTentang\M', 'tentang', 'g');
  r := regexp_replace(r, '\mYang\M', 'yang', 'g');
  r := regexp_replace(r, '\mBagi\M', 'bagi', 'g');
  r := regexp_replace(r, '\mDemi\M', 'demi', 'g');
  r := regexp_replace(r, '\mHingga\M', 'hingga', 'g');
  r := regexp_replace(r, '\mSampai\M', 'sampai', 'g');
  r := regexp_replace(r, '\mSejak\M', 'sejak', 'g');
  r := regexp_replace(r, '\mTanpa\M', 'tanpa', 'g');
  r := regexp_replace(r, '\mKarena\M', 'karena', 'g');
  r := regexp_replace(r, '\mSebab\M', 'sebab', 'g');
  r := regexp_replace(r, '\mJika\M', 'jika', 'g');
  r := regexp_replace(r, '\mKalau\M', 'kalau', 'g');
  r := regexp_replace(r, '\mAgar\M', 'agar', 'g');
  r := regexp_replace(r, '\mSupaya\M', 'supaya', 'g');
  r := regexp_replace(r, '\mPer\M', 'per', 'g');
  r := regexp_replace(r, '\mAntar\M', 'antar', 'g');
  r := regexp_replace(r, '\mBahwa\M', 'bahwa', 'g');
  -- singkatan dinas -> BESAR semua
  r := regexp_replace(r, '\mRad\M', 'RAD', 'g');
  r := regexp_replace(r, '\mApbd\M', 'APBD', 'g');
  r := regexp_replace(r, '\mApbn\M', 'APBN', 'g');
  r := regexp_replace(r, '\mNpd\M', 'NPD', 'g');
  r := regexp_replace(r, '\mSpj\M', 'SPJ', 'g');
  r := regexp_replace(r, '\mSkpd\M', 'SKPD', 'g');
  r := regexp_replace(r, '\mRka\M', 'RKA', 'g');
  r := regexp_replace(r, '\mDpa\M', 'DPA', 'g');
  r := regexp_replace(r, '\mDppa\M', 'DPPA', 'g');
  r := regexp_replace(r, '\mAsn\M', 'ASN', 'g');
  r := regexp_replace(r, '\mPns\M', 'PNS', 'g');
  r := regexp_replace(r, '\mCpns\M', 'CPNS', 'g');
  r := regexp_replace(r, '\mPppk\M', 'PPPK', 'g');
  r := regexp_replace(r, '\mOpd\M', 'OPD', 'g');
  r := regexp_replace(r, '\mRpjmd\M', 'RPJMD', 'g');
  r := regexp_replace(r, '\mRkpd\M', 'RKPD', 'g');
  r := regexp_replace(r, '\mSipd\M', 'SIPD', 'g');
  r := regexp_replace(r, '\mSpp\M', 'SPP', 'g');
  r := regexp_replace(r, '\mSpm\M', 'SPM', 'g');
  r := regexp_replace(r, '\mSp2d\M', 'SP2D', 'g');
  r := regexp_replace(r, '\mLpj\M', 'LPJ', 'g');
  r := regexp_replace(r, '\mDak\M', 'DAK', 'g');
  r := regexp_replace(r, '\mDau\M', 'DAU', 'g');
  r := regexp_replace(r, '\mDbh\M', 'DBH', 'g');
  r := regexp_replace(r, '\mPad\M', 'PAD', 'g');
  r := regexp_replace(r, '\mSilpa\M', 'SILPA', 'g');
  r := regexp_replace(r, '\mKua\M', 'KUA', 'g');
  r := regexp_replace(r, '\mPpas\M', 'PPAS', 'g');
  r := regexp_replace(r, '\mBpk\M', 'BPK', 'g');
  r := regexp_replace(r, '\mBpkp\M', 'BPKP', 'g');
  r := regexp_replace(r, '\mApip\M', 'APIP', 'g');
  r := regexp_replace(r, '\mSakip\M', 'SAKIP', 'g');
  r := regexp_replace(r, '\mRenstra\M', 'RENSTRA', 'g');
  r := regexp_replace(r, '\mRenja\M', 'RENJA', 'g');
  r := regexp_replace(r, '\mBos\M', 'BOS', 'g');
  r := regexp_replace(r, '\mBop\M', 'BOP', 'g');
  r := regexp_replace(r, '\mBtt\M', 'BTT', 'g');
  r := regexp_replace(r, '\mDprd\M', 'DPRD', 'g');
  RETURN r;
END $$;

-- 2) Perbaiki data 2026 (program, kegiatan, sub, uraian)
UPDATE public.budget_lines
SET nama_program = public.propercase_id(nama_program),
    nama_kegiatan = public.propercase_id(nama_kegiatan),
    nama_sub_kegiatan = public.propercase_id(nama_sub_kegiatan),
    nama_uraian = public.propercase_id(nama_uraian),
    updated_at = now()
WHERE tahun = 2026;

-- 3) Verifikasi: tidak boleh ada lagi yang full BESAR semua
SELECT 'masih_besar_semua' AS cek, COUNT(*) AS jumlah
FROM public.budget_lines
WHERE tahun = 2026
  AND (nama_program = UPPER(nama_program)
    OR nama_kegiatan = UPPER(nama_kegiatan)
    OR nama_sub_kegiatan = UPPER(nama_sub_kegiatan)
    OR nama_uraian = UPPER(nama_uraian));

-- Contoh hasil (10 baris)
SELECT nama_program, nama_kegiatan, nama_sub_kegiatan, nama_uraian
FROM public.budget_lines WHERE tahun = 2026 LIMIT 10;
