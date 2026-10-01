-- ============================================================
-- SICAIR seed: 4 bidang + contoh pagu (sesuai contoh Excel PRD)
-- Jalankan SETELAH schema.sql
-- ============================================================

insert into public.bidang (nama, kode) values
  ('Sekretariat','SEK'),
  ('Keolahragaan','OLG'),
  ('Kepemudaan','MUDA'),
  ('Kepramukaan','PRAMUKA')
on conflict (nama) do nothing;

-- Contoh pagu tahun 2026 (1 baris sesuai PRD + beberapa variasi)
-- Cara tambah massal: pakai Dashboard > Input Pagu, atau import CSV mengikuti kolom ini.
with b as (select id, kode from public.bidang)
insert into public.budget_lines
  (bidang_id, tahun, kode_sub_kegiatan, nama_sub_kegiatan, kode_uraian, nama_uraian, pagu)
select b.id, 2026,
  '2.19.01.2.01.0001', 'Penyusunan Dokumen Perencanaan Perangkat Daerah',
  '5.1.02.01.01.0024', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor',
  2960400
from b where b.kode = 'SEK'
union all
select b.id, 2026,
  '2.19.01.2.01.0001', 'Penyusunan Dokumen Perencanaan Perangkat Daerah',
  '5.1.02.01.01.0025', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Kertas dan Cover',
  4500000
from b where b.kode = 'SEK'
union all
select b.id, 2026,
  '2.19.02.2.03.0001', 'Pembinaan dan Pengembangan Olahraga',
  '5.1.02.01.01.0024', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Alat Tulis Kantor',
  12000000
from b where b.kode = 'OLG'
union all
select b.id, 2026,
  '2.19.03.2.02.0001', 'Pemberdayaan Pemuda dan Organisasi Kepemudaan',
  '5.1.02.01.01.0030', 'Belanja Alat/Bahan untuk Kegiatan Kantor-Perlengkapan Kegiatan',
  8500000
from b where b.kode = 'MUDA'
union all
select b.id, 2026,
  '2.19.04.2.01.0001', 'Pembinaan Kepramukaan',
  '5.1.02.01.01.0031', 'Belanja Jasa Tenaga Penyelenggaraan Kegiatan',
  15000000
from b where b.kode = 'PRAMUKA'
on conflict (bidang_id, kode_sub_kegiatan, kode_uraian, tahun) do update
  set nama_sub_kegiatan = excluded.nama_sub_kegiatan,
      nama_uraian = excluded.nama_uraian,
      pagu = excluded.pagu;

-- Catatan: buat akun admin & user via Authentication > Users, lalu set role/bidang:
--   update public.profiles set role='admin', bidang_id=null where email='admin@dispora.local';
--   update public.profiles set role='user', bidang_id=(select id from public.bidang where kode='SEK') where email='sekretariat@dispora.local';
