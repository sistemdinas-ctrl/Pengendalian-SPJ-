import { z } from "zod";

// Validasi dipakai di client (UX) DAN di server (otoritatif). Server tetap wajib
// memvalidasi ulang + cek RLS + cek sisa pagu di DB (PRD §17, §21).

export const budgetLineSchema = z.object({
  bidang_id: z.string().uuid("Bidang wajib dipilih."),
  tahun: z.coerce.number().int().min(2020).max(2100),
  // Hierarki: Bidang > Program > Kegiatan > Sub Kegiatan > Uraian.
  // Program & kegiatan opsional ('' = belum diisi) agar data lama tetap valid.
  kode_program: z.string().trim().max(100).default(""),
  nama_program: z.string().trim().max(255).default(""),
  kode_kegiatan: z.string().trim().max(100).default(""),
  nama_kegiatan: z.string().trim().max(255).default(""),
  kode_sub_kegiatan: z.string().trim().min(1, "Kode sub kegiatan wajib."),
  nama_sub_kegiatan: z.string().trim().min(1, "Nama sub kegiatan wajib."),
  kode_uraian: z.string().trim().min(1, "Kode uraian wajib."),
  nama_uraian: z.string().trim().min(1, "Nama uraian wajib."),
  pagu: z.coerce.number().min(0, "Pagu minimal 0."),
  // Angkas semester: 0 = belum diatur (hanya batas pagu). S1 = Jan–Jun, S2 = Jul–Des.
  angkas_s1: z.coerce.number().min(0, "Angkas S1 minimal 0.").default(0),
  angkas_s2: z.coerce.number().min(0, "Angkas S2 minimal 0.").default(0),
}).refine((v) => Number(v.angkas_s1 || 0) + Number(v.angkas_s2 || 0) <= Number(v.pagu || 0), {
  message: "Total Angkas S1 + S2 tidak boleh melebihi Pagu.",
  path: ["angkas_s2"],
});

export const pengajuanItemSchema = z.object({
  budget_line_id: z.string().uuid(),
  nominal: z.coerce.number().positive("Nominal harus > 0."),
});

export const pengajuanSchema = z.object({
  // bidang_id BOLEH dikirim admin; untuk user, server menimpa dengan profile.bidang_id
  bidang_id: z.string().uuid().optional(),
  // PTK (penanda tangan cetak NPD) dipilih saat pengajuan; opsional agar data lama tetap valid.
  ptk_id: z.string().uuid().optional().nullable().or(z.literal("")),
  tanggal_pengajuan: z.string().min(1, "Tanggal wajib."),
  nama_npd: z.string().trim().min(3, "Nama/nomor NPD minimal 3 karakter."),
  catatan: z.string().trim().max(2000).optional().or(z.literal("")),
  items: z
    .array(pengajuanItemSchema)
    .min(1, "Minimal 1 uraian.")
    .refine(
      (items) => new Set(items.map((i) => i.budget_line_id)).size === items.length,
      "Satu uraian tidak boleh duplikat dalam satu pengajuan. Edit baris yang sama."
    ),
});

export const revisiSchema = z.object({
  remark: z.string().trim().min(5, "Remark revisi minimal 5 karakter."),
});

// ---------- MASTER PTK (Pejabat Pelaksana Teknis Kegiatan) ----------
// Dipakai sebagai penanda tangan pada cetak NPD (nama + NIP per bidang).
export const ptkSchema = z.object({
  bidang_id: z.string().uuid("Bidang wajib dipilih."),
  nama: z
    .string()
    .trim()
    .min(3, "Nama PTK minimal 3 karakter.")
    .max(150, "Nama PTK maksimal 150 karakter."),
  // NIP opsional; format bebas (spasi/titik) mengikuti dokumen asli.
  nip: z
    .string()
    .trim()
    .max(40, "NIP maksimal 40 karakter.")
    .default("")
    .or(z.literal("")),
  jabatan: z
    .string()
    .trim()
    .max(120)
    .default("Pejabat Pelaksana Teknis Kegiatan")
    .or(z.literal("")),
  aktif: z.coerce.boolean().default(true),
});
