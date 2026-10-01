// Tipe domain utama SICAIR — hindari `any` untuk domain ini (PRD §21).
// Realisasi TIDAK disimpan manual; dibaca dari v_budget_realisasi (SUM disbursements CAIR).

export const BIDANG_KODE = ["SEK", "OLG", "MUDA", "PRAMUKA"];

export const NPD_STATUS = [
  "DRAFT",
  "DIAJUKAN",
  "DIPROSES",
  "REVISI",
  "SIAP_DICAIRKAN",
  "CAIR",
  "SELESAI",
  "DITOLAK",
];

/**
 * @typedef {Object} Bidang
 * @property {string} id
 * @property {string} nama
 * @property {string} kode
 */

/**
 * @typedef {Object} Profile
 * @property {string} id
 * @property {string|null} email
 * @property {string|null} display_name
 * @property {'admin'|'user'} role
 * @property {string|null} bidang_id
 */

/**
 * @typedef {Object} Ptk
 * @property {string} id
 * @property {string} bidang_id
 * @property {string} nama
 * @property {string} nip
 * @property {string} jabatan
 * @property {boolean} aktif
 */

/**
 * @typedef {Object} BudgetLine
 * @property {string} id
 * @property {string} bidang_id
 * @property {number} tahun
 * @property {string} kode_program
 * @property {string} nama_program
 * @property {string} kode_kegiatan
 * @property {string} nama_kegiatan
 * @property {string} kode_sub_kegiatan
 * @property {string} nama_sub_kegiatan
 * @property {string} kode_uraian
 * @property {string} nama_uraian
 * @property {number} pagu
 * @property {number} angkas_s1 kuota Semester 1 (Jan–Jun); 0 = belum diatur
 * @property {number} angkas_s2 kuota Semester 2 (Jul–Des); 0 = belum diatur
 */

/**
 * @typedef {Object} BudgetRealisasiRow
 * @property {string} budget_line_id
 * @property {string} bidang_id
 * @property {number} tahun
 * @property {string} kode_sub_kegiatan
 * @property {string} nama_sub_kegiatan
 * @property {string} kode_uraian
 * @property {string} nama_uraian
 * @property {number} pagu
 * @property {number} angkas_s1
 * @property {number} angkas_s2
 * @property {number} realisasi
 * @property {number} realisasi_s1
 * @property {number} realisasi_s2
 * @property {number} diproses_s1
 * @property {number} diproses_s2
 * @property {number} sisa_s1 sisa angkas Semester 1
 * @property {number} sisa_s2 sisa angkas Semester 2
 * @property {number} sisa
 * @property {number} persen_realisasi
 */

/**
 * @typedef {Object} Pengajuan
 * @property {string} id
 * @property {string} nomor_pengajuan
 * @property {string} bidang_id
 * @property {number} tahun
 * @property {string} tanggal_pengajuan
 * @property {string} nama_npd
 * @property {string|null} ptk_id
 * @property {string|null} catatan
 * @property {string} status
 * @property {number} total_nominal
 */

export const STATUS_META = {
  DRAFT: { label: "Draft", tone: "slate" },
  DIAJUKAN: { label: "Diajukan", tone: "blue" },
  DIPROSES: { label: "Diproses", tone: "indigo" },
  REVISI: { label: "Revisi", tone: "amber" },
  SIAP_DICAIRKAN: { label: "Siap dicairkan", tone: "cyan" },
  CAIR: { label: "Cair", tone: "emerald" },
  SELESAI: { label: "Selesai", tone: "emerald" },
  DITOLAK: { label: "Ditolak", tone: "rose" },
};

export function formatRupiah(n) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);
}

/**
 * SOP ANGKAS carryover S1 → S2.
 * Sisa angkas Semester 1 yang belum terpakai (cair + diproses) tetap bisa
 * dipakai di Semester 2. S1 sendiri tetap dibatasi kuota S1 (tidak bisa
 * meminjam dari S2).
 *
 * Konvensi baru:
 * - S1: 0 = belum diatur = tanpa batas S1 (hanya batas pagu).
 * - S2: tanpa batas HANYA bila S1 dan S2 keduanya 0. Bila S1 > 0 sedangkan
 *   S2 = 0, maka S2 efektif = sisa S1 (bukan tanpa batas), sehingga kasus
 *   "S1 ada 11 juta, S2 belum diatur" tetap bisa dipakai di S2 sampai sisa S1.
 *
 * @param {number} angkasS1 kuota S1 (0 = belum diatur)
 * @param {number} _angkasS2 tidak dipakai lagi untuk syarat (tetap diterima agar kompatibel)
 * @param {number} usedS1 pemakaian S1 (realisasi_s1 + diproses_s1)
 * @returns {number} carryover yang menambah kuota S2 (>= 0)
 */
export function carryoverS1keS2(angkasS1, _angkasS2, usedS1) {
  const a1 = Number(angkasS1 || 0);
  if (!(a1 > 0)) return 0;
  return Math.max(0, a1 - Number(usedS1 || 0));
}

/** Kuota efektif Semester 2 = angkas_s2 + carryover S1. */
export function angkasS2Efektif(angkasS1, angkasS2, usedS1) {
  return Number(angkasS2 || 0) + carryoverS1keS2(angkasS1, angkasS2, usedS1);
}

/** Apakah Semester 2 dibatasi angkas? Tidak dibatasi hanya bila S1 & S2 keduanya 0. */
export function isS2Dibatasi(rowOrA1, maybeA2) {
  if (rowOrA1 !== null && typeof rowOrA1 === "object") {
    const a1 = Number(rowOrA1.angkas_s1 || 0);
    const a2 = Number(rowOrA1.angkas_s2 || 0);
    return a1 > 0 || a2 > 0;
  }
  return Number(rowOrA1 || 0) > 0 || Number(maybeA2 || 0) > 0;
}

/** Sisa efektif Semester 2 = kuota efektif − pemakaian S2. */
export function sisaS2Efektif(row) {
  if (!row) return 0;
  const a1 = Number(row.angkas_s1 || 0);
  const a2 = Number(row.angkas_s2 || 0);
  if (!(a1 > 0) && !(a2 > 0)) return Number(row.sisa ?? 0); // keduanya belum diatur = hanya batas pagu
  // Dukung view baru (sisa_s2 sudah efektif) maupun view lama.
  if (row.carryover_s1 !== undefined || row.angkas_s2_efektif !== undefined) {
    return Number(row.sisa_s2 ?? 0);
  }
  const hasSemesterDetail =
    row.realisasi_s1 !== undefined || row.diproses_s1 !== undefined ||
    row.realisasi_s2 !== undefined || row.diproses_s2 !== undefined;
  if (!hasSemesterDetail && row.sisa_s1 !== undefined && row.sisa_s2 !== undefined) {
    // Fallback view lama tanpa rincian: sisa efektif = sisa S2 + sisa S1 (min 0).
    // Berlaku juga bila S2 = 0 (sisa_s2 lama negatif bila sudah ada pakai S2).
    if (a1 > 0) return Number(row.sisa_s2 ?? 0) + Math.max(0, Number(row.sisa_s1 ?? 0));
    return Number(row.sisa_s2 ?? 0);
  }
  const usedS1 =
    Number(row.realisasi_s1 || 0) + Number(row.diproses_s1 || 0);
  const usedS2 =
    Number(row.realisasi_s2 || 0) + Number(row.diproses_s2 || 0);
  return angkasS2Efektif(a1, a2, usedS1) - usedS2;
}

/** Kuota efektif Semester 2 dari row view (mendukung kolom baru bila ada). */
export function kuotaS2Efektif(row) {
  if (!row) return 0;
  if (row.angkas_s2_efektif !== undefined && row.angkas_s2_efektif !== null)
    return Number(row.angkas_s2_efektif);
  const a1 = Number(row.angkas_s1 || 0);
  const a2 = Number(row.angkas_s2 || 0);
  if (!(a1 > 0) && !(a2 > 0)) return 0;
  const usedS1 =
    Number(row.realisasi_s1 || 0) + Number(row.diproses_s1 || 0);
  // Bila view lama tanpa kolom realisasi/diproses per semester, pakai sisa_s1.
  if (!Number.isFinite(usedS1) || (usedS1 === 0 && row.sisa_s1 !== undefined && a1 > 0)) {
    const sisaS1 = Number(row.sisa_s1 ?? 0);
    if (a1 > 0) return a2 + Math.max(0, sisaS1);
    return a2;
  }
  return angkasS2Efektif(a1, a2, usedS1);
}

export function persenRealisasi(realisasi, pagu) {
  const p = Number(pagu ?? 0);
  if (!p || p <= 0) return 0;
  return Math.round((Number(realisasi ?? 0) / p) * 100 * 100) / 100;
}
