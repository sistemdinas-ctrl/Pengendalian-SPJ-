// Builder laporan SPJ — format + rumus sama persis seperti "laporan spj.xlsx".
// Sumber data: v_budget_realisasi (pagu + realisasi cair). SISA & % selalu RUMUS Excel:
//   D (SISA) = B - C
//   E (%)    = IFERROR(C / B, 0)  -> format 0.00%
// JUMLAH per sub = SUM atas baris uraian-nya. Grand total = SUM atas JUMLAH.
// Per-bidang & total dinas memakai SUMIF berdasarkan prefix kode uraian.
import ExcelJS from "exceljs";

const FILL_HEADER = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBE5F1" } };
const FILL_SECTION_GREEN = { type: "pattern", pattern: "solid", fgColor: { argb: "FFA9D18E" } };
const FILL_BIDANG_GRAY = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDEDED" } };
const FILL_TOTAL_HEAD = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2F0D9" } };

const FMT_INT = "#,##0";
const FMT_PCT = "0.00%";

const KAT_BIDANG = [
  { label: "ATK", prefix: "5.1.02.01.001.00024" },
  { label: "KERTAS dan COVER", prefix: "5.1.02.01.001.00025" },
  { label: "BAHAN CETAK", prefix: "5.1.02.01.001.00026" },
  { label: "BENDA POS", prefix: "5.1.02.01.001.00027" },
  { label: "BAHAN KOMPUTER", prefix: "5.1.02.01.001.00029" },
  { label: "MAMIN RAPAT", prefix: "5.1.02.01.001.00052" },
  { label: "PERDIN BIASA", prefix: "5.1.02.04.001.00001" },
  { label: "PERDIN KOTA", prefix: "5.1.02.04.001.00003" },
];

// Rincian total dinas: yang dijumlah dari sel per-bidang vs SUMIF langsung.
const TOTAL_SUMIF = [
  { label: "MAMIN JAMUAN TAMU", prefix: "5.1.02.01.001.00053" },
  { label: "PAKAIAN OLAH RAGA", prefix: "5.1.02.01.001.00076" },
  { label: "NARASUMBER, MODERATOR, PEMBAWA ACARA, dan PANITIA", prefix: "5.1.02.02.001.00003" },
  { label: "TENAG KEBERSIHAN", prefix: "5.1.02.02.001.00030" },
  { label: "TENAGA KEAMANAN", prefix: "5.1.02.02.001.00031" },
  { label: "JURI PERLOMBAAN/PERTANDINGAN", prefix: "5.1.02.02.001.00037" },
  { label: "PENYELENGGARA ACARA", prefix: "5.1.02.02.001.00047" },
  { label: "TELEPON", prefix: "5.1.02.02.001.00059" },
  { label: "AIR", prefix: "5.1.02.02.001.00060" },
  { label: "LISTRIK", prefix: "5.1.02.02.001.00061" },
  { label: "INTERNET", prefix: "5.1.02.02.001.00063" },
  { label: "SEWA KENDARAAN PENUMPANG", prefix: "5.1.02.02.004.00036" },
  { label: "HONORARIUM PENGELOLA KEUANGAN", prefix: "5.1.02.02.001.00080" },
  { label: "SEWA PERALATAN UMUM", prefix: "5.1.02.02.004.00355" },
  { label: "SEWA STUDIO AUDIO", prefix: "5.1.02.02.004.00132" },
];

// Urutan bidang pada ringkasan (samakan dengan file asli).
const BIDANG_ORDER = ["Sekretariat", "Kepemudaan", "Keolahragaan", "Kepramukaan"];
const BIDANG_SHORT = { Sekretariat: "SEKRETARIAT", Kepemudaan: "PEMUDA", Keolahragaan: "OLAHRAGA", Kepramukaan: "PRAMUKA" };

function normBidang(n) {
  const t = String(n || "").trim().toLowerCase();
  if (t.includes("sekret")) return "Sekretariat";
  if (t.includes("muda") || t.includes("pemuda")) return "Kepemudaan";
  if (t.includes("olahraga") || t.includes("olah")) return "Keolahragaan";
  if (t.includes("pramuka")) return "Kepramukaan";
  return String(n || "—");
}

function styleRow(ws, r, { bold = false, fill = null, size = 11 } = {}) {
  for (const c of ["A", "B", "C", "D", "E"]) {
    const cell = ws.getCell(`${c}${r}`);
    cell.font = { name: "Calibri", size, bold };
    if (fill) cell.fill = fill;
    if (c !== "A") cell.alignment = { vertical: "middle" };
    else cell.alignment = { vertical: "middle", wrapText: false };
  }
}

export function groupBySub(rows) {
  const map = new Map();
  for (const r of rows) {
    const k = r.kode_sub_kegiatan || "—";
    if (!map.has(k)) map.set(k, { kode: k, nama: r.nama_sub_kegiatan || "", bidang: normBidang(r.bidang_nama || r.nama_bidang), items: [] });
    map.get(k).items.push(r);
  }
  const list = [...map.values()];
  for (const g of list) g.items.sort((a, b) => String(a.kode_uraian).localeCompare(String(b.kode_uraian)));
  list.sort((a, b) => String(a.kode).localeCompare(String(b.kode)));
  return list;
}

/**
 * @param {Array} rows - baris v_budget_realisasi (+bidang_nama)
 * @param {Object} opts - { bulanLabel, tahun, sheetName, kadisNama, kadisPangkat, kadisNip }
 */
export async function buildSpjBuffer(rows, opts = {}) {
  const tahun = opts.tahun || new Date().getFullYear();
  const bulanLabel = opts.bulanLabel || `30 SEPTEMBER ${tahun}`;
  const wb = new ExcelJS.Workbook();
  wb.creator = "SICAIR";
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet(opts.sheetName || `SPJ ${tahun}`);

  ws.columns = [
    { key: "a", width: 87 },
    { key: "b", width: 21 },
    { key: "c", width: 21 },
    { key: "d", width: 19 },
    { key: "e", width: 17 },
  ];

  let r = 1;
  const mergeAE = (row) => ws.mergeCells(`A${row}:E${row}`);
  const mergeBE = (row) => ws.mergeCells(`B${row}:E${row}`);

  // Judul (baris 1-3, merge A:E — sama seperti file asli)
  ws.getCell(`A${r}`).value = "REALISASI/PENYERAPAN SIPD";
  mergeAE(r); styleRow(ws, r, { bold: true, size: 12 }); r += 1;
  ws.getCell(`A${r}`).value = "DINAS KEPEMUDAAN DAN OLAHRAGA  ";
  mergeAE(r); styleRow(ws, r, { bold: true, size: 12 }); r += 1;
  ws.getCell(`A${r}`).value = `BULAN  :  ${bulanLabel}`;
  mergeAE(r); styleRow(ws, r, { bold: true, size: 12 }); r += 1;
  r += 1; // baris kosong (baris 4)

  const detailStartRow = r; // baris 5
  const jumlahRows = [];
  const bidangRange = {}; // bidang -> {start, end}

  const groups = groupBySub(rows);

  if (groups.length === 0) {
    ws.getCell(`A${r}`).value = "Belum ada data pagu untuk filter ini.";
    mergeAE(r); styleRow(ws, r, { bold: true }); r += 1;
  }

  for (const g of groups) {
    // Judul sub kegiatan (merge A:E)
    ws.getCell(`A${r}`).value = `${g.kode} ${g.nama} `;
    mergeAE(r); styleRow(ws, r, { bold: true }); r += 1;
    // Header kolom
    ws.getCell(`A${r}`).value = "Uraian ";
    ws.getCell(`B${r}`).value = "Pagu (Rp)";
    ws.getCell(`C${r}`).value = "Realisasi (Rp)";
    ws.getCell(`D${r}`).value = "SISA";
    ws.getCell(`E${r}`).value = "%";
    styleRow(ws, r, { bold: true, fill: FILL_HEADER }); r += 1;
    // Uraian
    const d1 = r;
    for (const it of g.items) {
      ws.getCell(`A${r}`).value = `${it.kode_uraian} ${it.nama_uraian}`;
      ws.getCell(`B${r}`).value = Number(it.pagu || 0);
      ws.getCell(`C${r}`).value = Number(it.realisasi || 0);
      // RUMUS: SISA = pagu - realisasi ; % = realisasi / pagu
      ws.getCell(`D${r}`).value = { formula: `B${r}-C${r}` };
      ws.getCell(`E${r}`).value = { formula: `IFERROR(C${r}/B${r},0)` };
      ws.getCell(`B${r}`).numFmt = FMT_INT;
      ws.getCell(`C${r}`).numFmt = FMT_INT;
      ws.getCell(`D${r}`).numFmt = FMT_INT;
      ws.getCell(`E${r}`).numFmt = FMT_PCT;
      styleRow(ws, r, {});
      // catat rentang per bidang (hanya baris uraian, bukan header/jumlah)
      const b = g.bidang;
      if (!bidangRange[b]) bidangRange[b] = { start: r, end: r };
      else { bidangRange[b].start = Math.min(bidangRange[b].start, r); bidangRange[b].end = Math.max(bidangRange[b].end, r); }
      r += 1;
    }
    const d2 = r - 1;
    // JUMLAH — RUMUS SUM
    ws.getCell(`A${r}`).value = "JUMLAH ";
    ws.getCell(`B${r}`).value = { formula: `SUM(B${d1}:B${d2})` };
    ws.getCell(`C${r}`).value = { formula: `SUM(C${d1}:C${d2})` };
    ws.getCell(`D${r}`).value = { formula: `SUM(D${d1}:D${d2})` };
    ws.getCell(`E${r}`).value = { formula: `IFERROR(C${r}/B${r},0)` };
    ws.getCell(`B${r}`).numFmt = FMT_INT;
    ws.getCell(`C${r}`).numFmt = FMT_INT;
    ws.getCell(`D${r}`).numFmt = FMT_INT;
    ws.getCell(`E${r}`).numFmt = FMT_PCT;
    styleRow(ws, r, { bold: true });
    jumlahRows.push(r);
    r += 1;
  }
  const detailEndRow = r - 1;

  // Grand total PERSENTASE — RUMUS SUM atas JUMLAH
  ws.getCell(`A${r}`).value = "PERSENTASE";
  if (jumlahRows.length > 0) {
    const bSum = jumlahRows.map((x) => `B${x}`).join("+");
    const cSum = jumlahRows.map((x) => `C${x}`).join("+");
    ws.getCell(`B${r}`).value = { formula: bSum };
    ws.getCell(`C${r}`).value = { formula: cSum };
  } else {
    ws.getCell(`B${r}`).value = 0;
    ws.getCell(`C${r}`).value = 0;
  }
  ws.getCell(`D${r}`).value = { formula: `B${r}-C${r}` };
  ws.getCell(`E${r}`).value = { formula: `IFERROR(C${r}/B${r},0)` };
  for (const c of ["B", "C", "D"]) ws.getCell(`${c}${r}`).numFmt = FMT_INT;
  ws.getCell(`E${r}`).numFmt = FMT_PCT;
  styleRow(ws, r, { bold: true });
  r += 1;

  // Tanda tangan (merge B:E — sama seperti file asli)
  r += 1; // kosong
  const ttd = [
    "      KEPALA",
    "DINAS KEPEMUDAAN DAN OLAH RAGA",
    "KABUPATEN BOJONEGORO",
  ];
  for (const t of ttd) { ws.getCell(`B${r}`).value = t; mergeBE(r); styleRow(ws, r, {}); r += 1; }
  r += 2; // 2 baris kosong
  ws.getCell(`B${r}`).value = opts.kadisNama || "ARIEF NANANG SUGIANTO, SSTP, MM";
  mergeBE(r); styleRow(ws, r, {}); r += 1;
  ws.getCell(`B${r}`).value = opts.kadisPangkat || "Pembina Utama Muda";
  mergeBE(r); styleRow(ws, r, {}); r += 1;
  ws.getCell(`B${r}`).value = opts.kadisNip || "NIP.  19811121 200012 1 001";
  mergeBE(r); styleRow(ws, r, {}); r += 1;
  r += 2; // 2 baris kosong

  // REALISASI PER BIDANG (merge A:E, hijau)
  ws.getCell(`A${r}`).value = `REALISASI PENYERAPAN PER BIDANG TAHUN ${tahun}`;
  mergeAE(r); styleRow(ws, r, { bold: true, fill: FILL_SECTION_GREEN }); r += 1;
  r += 1; // kosong

  // Bidang yang tampil: kalau data difilter user, hanya bidang itu yang ada.
  const bidangHadir = BIDANG_ORDER.filter((b) => bidangRange[b]);
  // Kalau admin "semua" tapi ada bidang tak dikenal, tambahkan di akhir.
  for (const b of Object.keys(bidangRange)) if (!bidangHadir.includes(b)) bidangHadir.push(b);

  const katCellRef = {}; // label -> [cellB, ...per bidang] untuk total dinas
  for (const b of bidangHadir) {
    const short = BIDANG_SHORT[b] || String(b).toUpperCase();
    ws.getCell(`A${r}`).value = short;
    ws.getCell(`B${r}`).value = "PAGU";
    ws.getCell(`C${r}`).value = "REALISASI";
    ws.getCell(`D${r}`).value = "SISA PAGU";
    ws.getCell(`E${r}`).value = "PERSENTASE";
    styleRow(ws, r, { bold: true, fill: FILL_BIDANG_GRAY }); r += 1;
    const { start, end } = bidangRange[b];
    for (const k of KAT_BIDANG) {
      ws.getCell(`A${r}`).value = k.label;
      // RUMUS SUMIF per bidang atas rentang detail bidang tersebut
      ws.getCell(`B${r}`).value = { formula: `SUMIF(A${start}:A${end},"${k.prefix}*",B${start}:B${end})` };
      ws.getCell(`C${r}`).value = { formula: `SUMIF(A${start}:A${end},"${k.prefix}*",C${start}:C${end})` };
      ws.getCell(`D${r}`).value = { formula: `B${r}-C${r}` };
      ws.getCell(`E${r}`).value = { formula: `IFERROR(C${r}/B${r},0)` };
      for (const c of ["B", "C", "D"]) ws.getCell(`${c}${r}`).numFmt = FMT_INT;
      ws.getCell(`E${r}`).numFmt = FMT_PCT;
      styleRow(ws, r, {});
      if (!katCellRef[k.label]) katCellRef[k.label] = [];
      katCellRef[k.label].push(r);
      r += 1;
    }
    r += 1; // kosong antar bidang
  }

  // REALISASI TOTAL DINAS (merge A:E, hijau)
  ws.getCell(`A${r}`).value = "REALISASI PENYERAPAN TOTAL BELANJA DINAS";
  mergeAE(r); styleRow(ws, r, { bold: true, fill: FILL_SECTION_GREEN }); r += 1;
  r += 1; // kosong
  ws.getCell(`A${r}`).value = "RINCIAN BELANJA";
  ws.getCell(`B${r}`).value = "PAGU";
  ws.getCell(`C${r}`).value = "REALISASI";
  ws.getCell(`D${r}`).value = "SISA";
  ws.getCell(`E${r}`).value = "PERSENTASE";
  styleRow(ws, r, { bold: true, fill: FILL_TOTAL_HEAD }); r += 1;

  const detailA = `A${detailStartRow}:A${detailEndRow}`;
  const detailB = `B${detailStartRow}:B${detailEndRow}`;
  const detailC = `C${detailStartRow}:C${detailEndRow}`;

  const totalRows = [];
  function addTotalRow(label, formulaB, formulaC) {
    ws.getCell(`A${r}`).value = label;
    ws.getCell(`B${r}`).value = formulaB;
    ws.getCell(`C${r}`).value = formulaC;
    ws.getCell(`D${r}`).value = { formula: `B${r}-C${r}` };
    ws.getCell(`E${r}`).value = { formula: `IFERROR(C${r}/B${r},0)` };
    for (const c of ["B", "C", "D"]) ws.getCell(`${c}${r}`).numFmt = FMT_INT;
    ws.getCell(`E${r}`).numFmt = FMT_PCT;
    styleRow(ws, r, {});
    totalRows.push(r);
    r += 1;
  }

  // GAJI = seluruh kode 5.1.01.* (sama nilainya dengan JUMLAH sub gaji di file asli)
  addTotalRow("GAJI", { formula: `SUMIF(${detailA},"5.1.01.*",${detailB})` }, { formula: `SUMIF(${detailA},"5.1.01.*",${detailC})` });
  // 6 kategori pertama = penjumlahan sel per-bidang (persis file asli: B526+B536+...)
  const sumCells = (label, col) => ({ formula: (katCellRef[label] || []).map((x) => `${col}${x}`).join("+") || 0 });
  for (const k of KAT_BIDANG.slice(0, 6)) addTotalRow(k.label, sumCells(k.label, "B"), sumCells(k.label, "C"));
  for (const t of TOTAL_SUMIF) {
    if (t.label === "SEWA STUDIO AUDIO") {
      // file asli memakai A5:A511 (sampai grand total) — disamakan ke rentang detail agar tidak ganda.
      addTotalRow(t.label, { formula: `SUMIF(${detailA},"${t.prefix}*",${detailB})` }, { formula: `SUMIF(${detailA},"${t.prefix}*",${detailC})` });
    } else {
      addTotalRow(t.label, { formula: `SUMIF(${detailA},"${t.prefix}*",${detailB})` }, { formula: `SUMIF(${detailA},"${t.prefix}*",${detailC})` });
    }
  }
  // PERDIN total = penjumlahan sel per-bidang (persis file asli)
  addTotalRow("PERDIN BIASA TOTAL", sumCells("PERDIN BIASA", "B"), sumCells("PERDIN BIASA", "C"));
  addTotalRow("PERDIN KOTA TOTAL", sumCells("PERDIN KOTA", "B"), sumCells("PERDIN KOTA", "C"));

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export const SPJ_KAT_BIDANG = KAT_BIDANG;
