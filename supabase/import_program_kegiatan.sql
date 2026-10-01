-- ============================================================
-- Import Program & Kegiatan ke budget_lines
-- Jalankan SETELAH migration_008 berhasil
-- ============================================================

-- Pastikan bidang ada dulu
-- INSERT INTO public.bidang (nama, kode) VALUES
--   ('Sekretariat', 'SEK'),
--   ('Keolahragaan', 'OLG'),
--   ('Kepemudaan', 'MUDA'),
--   ('Kepramukaan', 'PRAMUKA')
-- ON CONFLICT (kode) DO NOTHING;

-- Insert data program & kegiatan (hierarchy saja, pagu=0 sementara)
-- Catatan: kode_uraian dan nama_uraian diisi '-' dulu, bisa diupdate nanti
DO $$
DECLARE
  v_bidang_id uuid;
  v_tahun int := 2026;
BEGIN
  -- SEKRETARIAT
  SELECT id INTO v_bidang_id FROM public.bidang WHERE kode = 'SEK' OR nama ILIKE '%sekretariat%' LIMIT 1;
  IF v_bidang_id IS NOT NULL THEN
    INSERT INTO public.budget_lines (bidang_id, tahun, kode_program, nama_program, kode_kegiatan, nama_kegiatan, kode_sub_kegiatan, nama_sub_kegiatan, kode_uraian, nama_uraian, pagu, created_by)
    VALUES
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.01', 'Perencanaan, Penganggaran, Dan Evaluasi Kinerja Perangkat Daerah', '2.19.01.2.01.0001', 'Penyusunan Dokumen Perencanaan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.01', 'Perencanaan, Penganggaran, Dan Evaluasi Kinerja Perangkat Daerah', '2.19.01.2.01.0002', 'Penyusunan Dokumen Perencanaan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.01', 'Perencanaan, Penganggaran, Dan Evaluasi Kinerja Perangkat Daerah', '2.19.01.2.01.0003', 'Penyusunan Dokumen Perencanaan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.01', 'Perencanaan, Penganggaran, Dan Evaluasi Kinerja Perangkat Daerah', '2.19.01.2.01.0004', 'Penyusunan Dokumen Perencanaan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.01', 'Perencanaan, Penganggaran, Dan Evaluasi Kinerja Perangkat Daerah', '2.19.01.2.01.0005', 'Penyusunan Dokumen Perencanaan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.01', 'Perencanaan, Penganggaran, Dan Evaluasi Kinerja Perangkat Daerah', '2.19.01.2.01.0006', 'Penyusunan Dokumen Perencanaan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.01', 'Perencanaan, Penganggaran, Dan Evaluasi Kinerja Perangkat Daerah', '2.19.01.2.01.0007', 'Penyusunan Dokumen Perencanaan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.02', 'Administrasi Keuangan Perangkat Daerah', '2.19.01.2.02.0001', 'Administrasi Keuangan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.02', 'Administrasi Keuangan Perangkat Daerah', '2.19.01.2.02.0002', 'Administrasi Keuangan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.02', 'Administrasi Keuangan Perangkat Daerah', '2.19.01.2.02.0003', 'Administrasi Keuangan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.02', 'Administrasi Keuangan Perangkat Daerah', '2.19.01.2.02.0005', 'Administrasi Keuangan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.02', 'Administrasi Keuangan Perangkat Daerah', '2.19.01.2.02.0006', 'Administrasi Keuangan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.02', 'Administrasi Keuangan Perangkat Daerah', '2.19.01.2.02.0007', 'Administrasi Keuangan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.02', 'Administrasi Keuangan Perangkat Daerah', '2.19.01.2.02.0008', 'Administrasi Keuangan Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.05', 'Administrasi Kepegawaian Perangkat Daerah', '2.19.01.2.05.0011', 'Administrasi Kepegawaian Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.06', 'Administrasi Umum Perangkat Daerah', '2.19.01.2.06.0001', 'Administrasi Umum Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.06', 'Administrasi Umum Perangkat Daerah', '2.19.01.2.06.0002', 'Administrasi Umum Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.06', 'Administrasi Umum Perangkat Daerah', '2.19.01.2.06.0003', 'Administrasi Umum Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.06', 'Administrasi Umum Perangkat Daerah', '2.19.01.2.06.0004', 'Administrasi Umum Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.06', 'Administrasi Umum Perangkat Daerah', '2.19.01.2.06.0005', 'Administrasi Umum Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.06', 'Administrasi Umum Perangkat Daerah', '2.19.01.2.06.0006', 'Administrasi Umum Perangkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.07', 'Pengadaan Barang Milik Daerah Penunjang Urusan Pemerintah Daerah', '2.19.01.2.07.0006', 'Pengadaan Barang Milik Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.08', 'Penyediaan Jasa Penunjang Urusan Pemerintahan Daerah', '2.19.01.2.08.0001', 'Penyediaan Jasa Penunjang', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.08', 'Penyediaan Jasa Penunjang Urusan Pemerintahan Daerah', '2.19.01.2.08.0002', 'Penyediaan Jasa Penunjang', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.08', 'Penyediaan Jasa Penunjang Urusan Pemerintahan Daerah', '2.19.01.2.08.0003', 'Penyediaan Jasa Penunjang', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.08', 'Penyediaan Jasa Penunjang Urusan Pemerintahan Daerah', '2.19.01.2.08.0004', 'Penyediaan Jasa Penunjang', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.09', 'Pemeliharaan Barang Milik Daerah Penunjang Urusan Pemerintahan Daerah', '2.19.01.2.09.0001', 'Pemeliharaan Barang Milik Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.01', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.09', 'Pemeliharaan Barang Milik Daerah Penunjang Urusan Pemerintahan Daerah', '2.19.01.2.09.0002', 'Pemeliharaan Barang Milik Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.02', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.09', 'Pemeliharaan Barang Milik Daerah Penunjang Urusan Pemerintahan Daerah', '2.19.01.2.09.0006', 'Pemeliharaan Barang Milik Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.02', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.09', 'Pemeliharaan Barang Milik Daerah Penunjang Urusan Pemerintahan Daerah', '2.19.01.2.09.0009', 'Pemeliharaan Barang Milik Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.02', 'Program Penunjang Urusan Pemerintahan Daerah Kabupaten/Kota', '2.19.01.2.09', 'Pemeliharaan Barang Milik Daerah Penunjang Urusan Pemerintahan Daerah', '2.19.01.2.09.0010', 'Pemeliharaan Barang Milik Daerah', '-', '-', 0, NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  -- KEPEMUDAAN
  SELECT id INTO v_bidang_id FROM public.bidang WHERE kode = 'MUDA' OR nama ILIKE '%kepemudaan%' LIMIT 1;
  IF v_bidang_id IS NOT NULL THEN
    INSERT INTO public.budget_lines (bidang_id, tahun, kode_program, nama_program, kode_kegiatan, nama_kegiatan, kode_sub_kegiatan, nama_sub_kegiatan, kode_uraian, nama_uraian, pagu, created_by)
    VALUES
      (v_bidang_id, v_tahun, '2.19.02', 'Program Pengembangan Kapasitas Daya Saing Kepemudaan', '2.19.02.2.01', 'Penyadaran, Pemberdayaan, Dan Pengembangan Pemuda Dan Kepemudaan', '2.19.02.2.01.0010', 'Pemuda Pelopor, Wirausaha Muda, Pemuda Kader', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.02', 'Program Pengembangan Kapasitas Daya Saing Kepemudaan', '2.19.02.2.01', 'Penyadaran, Pemberdayaan, Dan Pengembangan Pemuda Dan Kepemudaan', '2.19.02.2.01.0011', 'Pemuda Pelopor, Wirausaha Muda, Pemuda Kader', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.02', 'Program Pengembangan Kapasitas Daya Saing Kepemudaan', '2.19.02.2.01', 'Penyadaran, Pemberdayaan, Dan Pengembangan Pemuda Dan Kepemudaan', '2.19.02.2.01.0012', 'Pemuda Pelopor, Wirausaha Muda, Pemuda Kader', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.02', 'Program Pengembangan Kapasitas Daya Saing Kepemudaan', '2.19.02.2.01', 'Penyadaran, Pemberdayaan, Dan Pengembangan Pemuda Dan Kepemudaan', '2.19.02.2.01.0013', 'Pemuda Pelopor, Wirausaha Muda, Pemuda Kader', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.02', 'Program Pengembangan Kapasitas Daya Saing Kepemudaan', '2.19.02.2.01', 'Penyadaran, Pemberdayaan, Dan Pengembangan Pemuda Dan Kepemudaan', '2.19.02.2.01.0015', 'Pemuda Pelopor, Wirausaha Muda, Pemuda Kader', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.02', 'Program Pengembangan Kapasitas Daya Saing Kepemudaan', '2.19.02.2.02', 'Pemberdayaan Dan Pengembangan Organisasi Kepemudaan', '2.19.02.2.02.0003', 'Organisasi Kepemudaan Tingkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.02', 'Program Pengembangan Kapasitas Daya Saing Kepemudaan', '2.19.02.2.02', 'Pemberdayaan Dan Pengembangan Organisasi Kepemudaan', '2.19.02.2.02.0004', 'Organisasi Kepemudaan Tingkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.03', 'Program Pengembangan Kapasitas Daya Saing Kepemudaan', '2.19.02.2.02', 'Pemberdayaan Dan Pengembangan Organisasi Kepemudaan', '2.19.02.2.02.0004', 'Organisasi Kepemudaan Tingkat Daerah', '-', '-', 0, NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  -- KEOLAHRAGAAN
  SELECT id INTO v_bidang_id FROM public.bidang WHERE kode = 'OLG' OR nama ILIKE '%keolahragaan%' LIMIT 1;
  IF v_bidang_id IS NOT NULL THEN
    INSERT INTO public.budget_lines (bidang_id, tahun, kode_program, nama_program, kode_kegiatan, nama_kegiatan, kode_sub_kegiatan, nama_sub_kegiatan, kode_uraian, nama_uraian, pagu, created_by)
    VALUES
      (v_bidang_id, v_tahun, '2.19.03', 'Program Pengembangan Kapasitas Daya Saing Keolahragaan', '2.19.03.2.02', 'Penyelenggaraan Kejuaraan Olahraga Tingkat Daerah', '2.19.03.2.02.0004', 'Kejuaraan Olahraga Tingkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.03', 'Program Pengembangan Kapasitas Daya Saing Keolahragaan', '2.19.03.2.02', 'Penyelenggaraan Kejuaraan Olahraga Tingkat Daerah', '2.19.03.2.02.0006', 'Kejuaraan Olahraga Tingkat Daerah', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.03', 'Program Pengembangan Kapasitas Daya Saing Keolahragaan', '2.19.03.2.03', 'Pembinaan Dan Pengembangan Olahraga Prestasi', '2.19.03.2.03.0006', 'Ol Prestasi Tingkat Daerah Provinsi', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.03', 'Program Pengembangan Kapasitas Daya Saing Keolahragaan', '2.19.03.2.03', 'Pembinaan Dan Pengembangan Olahraga Prestasi', '2.19.03.2.03.0007', 'Ol Prestasi Tingkat Daerah Provinsi', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.03', 'Program Pengembangan Kapasitas Daya Saing Keolahragaan', '2.19.03.2.03', 'Pembinaan Dan Pengembangan Olahraga Prestasi', '2.19.03.2.03.0009', 'Ol Prestasi Tingkat Daerah Provinsi', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.03', 'Program Pengembangan Kapasitas Daya Saing Keolahragaan', '2.19.03.2.05', 'Pembinaan Dan Pengembangan Olahraga Rekreasi', '2.19.03.2.05.0009', 'Ol Rekreasi', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.03', 'Program Pengembangan Kapasitas Daya Saing Keolahragaan', '2.19.03.2.05', 'Pembinaan Dan Pengembangan Olahraga Rekreasi', '2.19.03.2.05.0010', 'Ol Rekreasi', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.04', 'Program Pengembangan Kapasitas Daya Saing Keolahragaan', '2.19.03.2.05', 'Pembinaan Dan Pengembangan Olahraga Rekreasi', '2.19.03.2.05.0010', 'Ol Rekreasi', '-', '-', 0, NULL)
    ON CONFLICT DO NOTHING;
  END IF;

  -- KEPRAMUKAAN
  SELECT id INTO v_bidang_id FROM public.bidang WHERE kode = 'PRAMUKA' OR nama ILIKE '%kepramukaan%' LIMIT 1;
  IF v_bidang_id IS NOT NULL THEN
    INSERT INTO public.budget_lines (bidang_id, tahun, kode_program, nama_program, kode_kegiatan, nama_kegiatan, kode_sub_kegiatan, nama_sub_kegiatan, kode_uraian, nama_uraian, pagu, created_by)
    VALUES
      (v_bidang_id, v_tahun, '2.19.04', 'Program Pengembangan Kapasitas Kepramukaan', '2.19.04.2.01', 'Pembinaan Dan Pengembangan Organisasi Kepramukaan', '2.19.04.2.01.0002', 'Organisasi Kepramukaan', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.04', 'Program Pengembangan Kapasitas Kepramukaan', '2.19.04.2.01', 'Pembinaan Dan Pengembangan Organisasi Kepramukaan', '2.19.04.2.01.0003', 'Organisasi Kepramukaan', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.04', 'Program Pengembangan Kapasitas Kepramukaan', '2.19.04.2.01', 'Pembinaan Dan Pengembangan Organisasi Kepramukaan', '2.19.04.2.01.0005', 'Organisasi Kepramukaan', '-', '-', 0, NULL),
      (v_bidang_id, v_tahun, '2.19.04', 'Program Pengembangan Kapasitas Kepramukaan', '2.19.04.2.01', 'Pembinaan Dan Pengembangan Organisasi Kepramukaan', '2.19.04.2.01.0008', 'Organisasi Kepramukaan', '-', '-', 0, NULL)
    ON CONFLICT DO NOTHING;
  END IF;

END $$;

-- Verifikasi
SELECT 
  b.nama as bidang,
  COUNT(*) as total_line,
  SUM(bl.pagu) as total_pagu
FROM public.budget_lines bl
JOIN public.bidang b ON b.id = bl.bidang_id
WHERE bl.tahun = 2026
GROUP BY b.nama
ORDER BY b.nama;
