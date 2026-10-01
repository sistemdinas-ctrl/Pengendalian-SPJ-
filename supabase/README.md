# Supabase — SICAIR

## 1. Buat project
1. Buka https://supabase.com/dashboard > New project.
2. Catat `Project URL` dan `anon public key` + `service_role` (hanya untuk server, JANGAN ke browser).

## 2. Jalankan SQL (urutan penting)
Supabase Dashboard > SQL Editor > New query:
1. Paste isi `supabase/schema.sql` > Run.
2. Paste isi `supabase/seed.sql` > Run.
3. Verifikasi: `select * from public.bidang;` harus 4 baris. `select * from public.v_dashboard_bidang;` harus jalan.

### 2b. Database yang sudah berjalan (upgrade)
Jalankan migration berikut berurutan, masing-masing aman diulang:

| File | Isi |
|---|---|
| `migration_001_security_invoker.sql` | view tunduk RLS |
| `migration_002..007` | aturan transisi status & revisi |
| `migration_008_program_kegiatan.sql` | kolom Program & Kegiatan di `budget_lines` + view `v_budget_realisasi` & `v_dashboard_bidang` dibuat ulang (**wajib drop view dulu**, kalau tidak muncul error `42P16`) |
| `migration_009..011` | transisi status & kolom `profiles.nip` |
| `migration_012_ptk.sql` | master **PTK** (tabel `public.ptk`) + kolom `pengajuan.ptk_id` untuk cetak NPD |
| `migration_013_diajukan_cek_sisa.sql` | tolak ajuan ke DIAJUKAN bila nominal item melebihi sisa pagu uraian (cegah sisa minus) |

Setelah `migration_012`, isi data PTK dari aplikasi: menu **Data PTK** (hanya admin) —
pilih bidang, isi nama + NIP penanda tangan. Data ini otomatis dipakai pada
pengajuan NPD (dropdown di form Pengajuan NPD) dan tercetak pada **Cetak NPD**.

## 3. Auth
- Authentication > Providers > aktifkan Email.
- Authentication > Users > Add user (buat admin + 1 user per bidang untuk testing).
- Lalu SQL Editor, set role/bidang:
```sql
update public.profiles set role='admin' where email='admin@dispora.local';
update public.profiles set role='user', bidang_id=(select id from public.bidang where kode='SEK') where email='sekretariat@dispora.local';
```

## 4. Env Next.js / Vercel
Salin `.env.example` ke `.env.local` dan isi:
```
NEXT_PUBLIC_SUPABASE_URL=https://xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=... (hanya di server/Vercel, jangan prefix NEXT_PUBLIC)
```

## 5. Storage dokumen (opsional, Phase 3)
Jika NPD butuh upload dokumen:
- Storage > New bucket `npd-docs` (private).
- Policy: admin read semua, user read/write hanya folder `bidang_id`-nya. Lihat PRD §16.

## 6. Uji pencairan idempotent
```sql
-- ganti UUID dengan id pengajuan berstatus SIAP_DICAIRKAN
select public.cairkan_pengajuan('UUID_PENGAJUAN', 'key-unik-001');
-- jalankan 2x dengan key sama -> response kedua {idempotent:true}, tidak double realisasi
select * from public.v_budget_realisasi limit 5;
```

## 7. Reset (hati-hati, dev only)
Tabel memakai `on delete cascade/restrict` sesuai PRD agar histori tidak hilang permanen.
Jangan `drop` di production tanpa backup.
