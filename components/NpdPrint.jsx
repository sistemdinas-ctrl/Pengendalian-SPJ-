"use client";

import { useFitOnePage } from "./useFitOnePage";

// ============================================================
// Cetak NPD — replika dokumen "NOTA PENGAJUAN DANA (NPD)"
// Sumber acuan: NOTA PENGAJUAN DANA 2.docx
//   Kertas : ukuran sumber DOCX (8,5 x 14 inci), margin 25,4 mm
//   Judul  : Times New Roman 18 pt bold underline; "(NPD)" TNR 16 pt bold (center)
//   Isi    : Arial 12 pt, blok metadata Arial 11 pt, spasi tunggal
//   Tabel  : lebar 143,6 mm (527 + 4024 + 3591 twips), garis 1 px hitam
//   Tanda tangan dihitung dari tab stop docx (76,2 / 88,9 / 96 mm)
//   Isi banyak -> dikecilkan otomatis agar tetap 1 lembar
//   (mekanisme sama seperti KendaliPrint via useFitOnePage).
//   *** DIKUNCI (Okt 2026, user approved): kop 12,5mm tanpa margin negatif,
//   *** meta Tanggal + TTD "Bojonegoro" ikut tgl pengajuan (full date),
//   *** a/b/c BEKU via snapshot, Program/Kegiatan/Sub/Uraian apa adanya ikut database.
//   *** Jangan diubah tanpa konfirmasi user.
// ============================================================

const TNR = "'Times New Roman', Times, serif";
const ARIAL = "Arial, Helvetica, sans-serif";
const BD = "1px solid #000";

// Blok isi (Arial 12 pt) dan blok metadata (Arial 11 pt) — spasi tunggal.
const TEXT = { fontFamily: ARIAL, fontSize: "12pt", lineHeight: 1, margin: 0 };
const TEXT11 = {
  fontFamily: ARIAL,
  fontSize: "11pt",
  lineHeight: "12pt",
  margin: 0,
};

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

// Tanggal lengkap untuk metadata & tanda tangan, mis. "23 September 2026".
// Selalu ikut tanggal input pengajuan pada form NPD.
function formatTanggal(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function terbilangAngka(n) {
  const satuan = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan",
  ];
  const belasan = [
    "Sepuluh", "Sebelas", "Dua Belas", "Tiga Belas", "Empat Belas", "Lima Belas",
    "Enam Belas", "Tujuh Belas", "Delapan Belas", "Sembilan Belas",
  ];
  const puluhan = [
    "", "", "Dua Puluh", "Tiga Puluh", "Empat Puluh", "Lima Puluh", "Enam Puluh",
    "Tujuh Puluh", "Delapan Puluh", "Sembilan Puluh",
  ];

  function conv(num) {
    if (num < 10) return satuan[num];
    if (num < 20) return belasan[num - 10];
    if (num < 100) {
      const s = Math.floor(num / 10);
      const r = num % 10;
      return puluhan[s] + (r ? ` ${satuan[r]}` : "");
    }
    if (num < 1000) {
      const s = Math.floor(num / 100);
      const r = num % 100;
      return `${s === 1 ? "Se" : `${satuan[s]} `}Ratus${r ? ` ${conv(r)}` : ""}`;
    }
    if (num < 1000000) {
      const s = Math.floor(num / 1000);
      const r = num % 1000;
      return `${s === 1 ? "Se" : `${conv(s)} `}Ribu${r ? ` ${conv(r)}` : ""}`;
    }
    if (num < 1000000000) {
      const s = Math.floor(num / 1000000);
      const r = num % 1000000;
      return `${s === 1 ? "Se" : `${conv(s)} `}Juta${r ? ` ${conv(r)}` : ""}`;
    }
    if (num < 1000000000000) {
      const s = Math.floor(num / 1000000000);
      const r = num % 1000000000;
      return `${s === 1 ? "Se" : `${conv(s)} `}Miliar${r ? ` ${conv(r)}` : ""}`;
    }
    const s = Math.floor(num / 1000000000000);
    const r = num % 1000000000000;
    return `${s === 1 ? "Se" : `${conv(s)} `}Triliun${r ? ` ${conv(r)}` : ""}`;
  }

  return conv(Math.round(Number(n) || 0));
}

function terbilang(n) {
  const val = Math.round(Number(n) || 0);
  if (!val) return "Nol Rupiah";
  return `${terbilangAngka(val)} Rupiah`;
}

function rupiah(v) {
  return `Rp. ${new Intl.NumberFormat("id-ID").format(Number(v ?? 0))}`;
}

// Catatan: tidak ada lagi ubah besar-kecil huruf — semua nama tampil
// apa adanya mengikuti database (permintaan user, Okt 2026).

// Angka saja (tanpa "Rp.") — dipakai pada sel jumlah agar sejajar kanan.
function angka(v) {
  return new Intl.NumberFormat("id-ID").format(Number(v ?? 0));
}

// Posisi tanda tangan — hasil hitung tab stop docx (72 twips default + tab khusus 3749).
const SIGNER_JABATAN_MM = "76.2mm";
const SIGNER_NAMA_MM = "88.9mm";
const SIGNER_NIP_MM = "96mm";

export default function NpdPrint({
  pengajuan,
  items = [],
  bidang,
  pengaju,
  ptk,
  budgetSummary = [],
  disbursements = [],
}) {
  // Fit 1 lembar ala Excel (sama seperti KendaliPrint): kertas legal
  // 14 inci, padding vertikal sheet = 12,5mm + 25,4mm = 3,79cm.
  // (Padding atas 12,5mm = posisi kop docx: 25,4mm margin - 1,29cm tarikan,
  //  tanpa margin negatif agar tidak kepotong wrapper overflow-hidden.)
  // Hook dipasang sebelum early-return agar urutannya stabil.
  const { innerRef, fitWrapStyle, fitInnerStyle } = useFitOnePage(
    pengajuan?.id || "",
    3.79,
    14
  );

  if (!pengajuan) return null;

  // Tanggal tanda tangan = tanggal input pengajuan pada form NPD.
  const tanggalTtd = formatTanggal(pengajuan.tanggal_pengajuan);

  const first = items[0]?.budget_lines || {};
  // Nama program/kegiatan/sub/uraian tampil APA ADANYA mengikuti database
  // input pagu (tanpa ubah besar-kecil huruf).
  const namaProgram = first.nama_program || "—";
  const namaKegiatan = first.nama_kegiatan || "—";
  const subKegiatan = first.nama_sub_kegiatan || "—";

  // DOKUMEN BEKU (migration_014, sama seperti KendaliPrint): cetak ulang NPD
  // harus SAMA PERSIS seperti saat pertama diajukan — pencairan NPD ini
  // sendiri TIDAK boleh mengubah angka a/b/c di nota yang sama.
  // NPD nomor berikutnya otomatis ikut realisasi karena dibaca live di sana.
  // REVISI (Okt 2026): a/b/c = jumlah URAIAN yang dipakai NPD ini saja
  // (bukan se-sub kegiatan). Bila 1 NPD berisi 2 uraian, nilainya dijumlahkan.
  // Prioritas: snapshot_items yang difilter ke uraian NPD ini; fallback:
  // budgetSummary live yang difilter ke uraian NPD ini MINUS pencairan milik
  // NPD ini (untuk NPD lama sebelum ada snapshot).
  const snapshotRows = Array.isArray(pengajuan?.snapshot_items)
    ? pengajuan.snapshot_items
    : [];
  const useSnapshot = snapshotRows.length > 0 && pengajuan?.snapshot_at != null;

  // Kunci uraian yang dipakai NPD ini (dari items).
  const usedLineIds = new Set(
    (items || []).map((it) => it.budget_line_id).filter(Boolean)
  );
  const usedKodeUraian = new Set(
    (items || []).map((it) => it.budget_lines?.kode_uraian).filter(Boolean)
  );
  const matchUraian = (row) => {
    if (!row) return false;
    if (row.budget_line_id && usedLineIds.has(row.budget_line_id)) return true;
    if (row.kode_uraian && usedKodeUraian.has(row.kode_uraian)) return true;
    return false;
  };

  // Snapshot menyimpan seluruh uraian se-sub kegiatan (untuk lembar kendali),
  // tapi a/b/c NPD hanya menjumlah uraian yang dipakai NPD ini.
  const snapshotUraian =
    useSnapshot && usedLineIds.size > 0
      ? snapshotRows.filter(matchUraian)
      : useSnapshot
        ? snapshotRows
        : [];
  // Kalau filter menghasilkan kosong (mis. id berubah), pakai rencana>0,
  // terakhir fallback ke seluruh snapshot agar tidak tampil nol.
  const snapshotFiltered =
    snapshotUraian.length > 0
      ? snapshotUraian
      : useSnapshot
        ? (() => {
            const byRencana = snapshotRows.filter(
              (s) => Number(s.rencana || 0) > 0
            );
            return byRencana.length > 0 ? byRencana : snapshotRows;
          })()
        : [];

  // Budget live (v_budget_realisasi) juga difilter ke uraian NPD ini saja.
  // budgetSummary diambil se-sub kegiatan (untuk Kendali), sehingga filter
  // selalu diperlukan di sini. Fallback ke summary apa adanya hanya
  // untuk data lama agar dokumen tidak tampil nol.
  const budgetFiltered =
    usedLineIds.size > 0 || usedKodeUraian.size > 0
      ? (budgetSummary || []).filter(matchUraian)
      : budgetSummary || [];
  const budgetUraian =
    budgetFiltered.length > 0 ? budgetFiltered : budgetSummary || [];

  const ownCair = (disbursements || []).reduce(
    (a, d) => a + Number(d.nominal || 0),
    0
  );
  let totalPagu;
  let totalRealisasi;
  if (useSnapshot) {
    totalPagu = snapshotFiltered.reduce((a, s) => a + Number(s.pagu || 0), 0);
    totalRealisasi = snapshotFiltered.reduce(
      (a, s) => a + Number(s.realisasi || 0),
      0
    );
  } else {
    totalPagu = budgetUraian.reduce((a, b) => a + Number(b.pagu || 0), 0);
    totalRealisasi = Math.max(
      0,
      budgetUraian.reduce((a, b) => a + Number(b.realisasi || 0), 0) - ownCair
    );
  }
  const totalSisa = totalPagu - totalRealisasi;
  const rencana = Number(pengajuan.total_nominal || 0);

  // Penanda tangan: PTK dari master data (menu Data PTK) -> fallback akun pengaju.
  const namaPenanda = ptk?.nama || pengaju?.display_name || "—";
  const nipPenanda = ptk?.nip || pengaju?.nip || "";
  const jabatanPenanda = ptk?.jabatan || "Pejabat Pelaksana Teknis Kegiatan";

  const metaRows = [
    ["Kepada", ": Yth. Pengguna Anggaran Dinas Kepemudaan Dan Olahraga"],
    [
      "Dari",
      ": Pejabat Pelaksana Teknis Kegiatan Program Penunjang Urusan Pemerintahan",
    ],
    ["", "Kab/Kota"],
    ["Tanggal", `: ${formatTanggal(pengajuan.tanggal_pengajuan)}`],
    ["Sifat", ": Segera"],
    ["Lampiran", ": -"],
    ["Perihal", `: ${pengajuan.nama_npd || "—"}`],
  ];

  const ringkasan = [
    { no: "a.", label: "Pagu Anggaran", value: totalPagu },
    { no: "b.", label: "Anggaran yang sudah diserap", value: totalRealisasi },
    { no: "c.", label: "Sisa yang bisa diserap", value: totalSisa },
  ];

  return (
    <div className="npd-print-container">
      <style>{`
        /* NPD: kertas 8,5 x 14 inci (ikut ukuran sumber DOCX).
           Padding atas 12,5mm agar kop duduk di posisi docx tanpa margin negatif. */
        .npd-sheet {
          width: 215.9mm;
          min-height: 355.6mm;
          padding: 12.5mm 25.4mm 25.4mm;
          box-sizing: border-box;
          background: #fff;
          color: #000;
        }
        .npd-sheet, .npd-sheet * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @page { size: 215.9mm 355.6mm; margin: 0; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          body > *:not(.npd-print-root) { display: none !important; }
          .npd-print-root {
            position: static !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }
          .npd-print-root .npd-backdrop,
          .npd-print-root .npd-toolbar { display: none !important; }
          .npd-print-container {
            position: static !important;
            display: block !important;
            width: 215.9mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .npd-sheet {
            width: 215.9mm !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 12.5mm 25.4mm 25.4mm !important;
            box-shadow: none !important;
            border: 0 !important;
          }
        }
      `}</style>

      <div className="npd-sheet">
        <div style={fitWrapStyle}>
          <div ref={innerRef} style={fitInnerStyle}>
        {/* ── KOP SURAT (header docx: 4 baris TNR + logo + garis ganda 19,19 cm) ── */}
        <div
          style={{
            position: "relative",
            marginTop: 0,
            marginBottom: "10pt",
          }}
        >
          {/* Logo asli dari header dokumen sumber: 1,27 x 1,95 cm. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kop-logo-bojonegoro.png"
            alt="Logo Kabupaten Bojonegoro"
            style={{
              position: "absolute",
              left: 0,
              top: "3pt",
              width: "1.27cm",
              height: "1.95cm",
              filter: "grayscale(100%)",
            }}
          />
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontFamily: TNR,
              fontSize: "16pt",
              fontWeight: "bold",
              lineHeight: 1,
            }}
          >
            PEMERINTAH KABUPATEN BOJONEGORO
          </p>
          <p
            style={{
              margin: "1pt 0 0 0",
              textAlign: "center",
              fontFamily: TNR,
              fontSize: "16pt",
              fontWeight: "bold",
              lineHeight: 1,
            }}
          >
            DINAS KEPEMUDAAN DAN OLAHRAGA
          </p>
          <p
            style={{
              margin: "1pt 0 0 0",
              textAlign: "center",
              fontFamily: TNR,
              fontSize: "14pt",
              lineHeight: 1,
            }}
          >
            Jalan Pattimura No. 36 telp/fax (0353) 881257
          </p>
          <p
            style={{
              margin: "1pt 0 0 0",
              textAlign: "center",
              fontFamily: TNR,
              fontSize: "16pt",
              fontWeight: "bold",
              lineHeight: 1,
            }}
          >
            B O J O N E G O R O
          </p>
          {/* Garis ganda kop: lebar 19,19 cm mulai 1,16 cm di kiri margin teks. */}
          <div
            style={{
              marginLeft: "-1.16cm",
              width: "19.19cm",
              marginTop: "3pt",
            }}
          >
            <div style={{ height: "1.2pt", background: "#000" }} />
            <div
              style={{ height: "0.8pt", background: "#000", marginTop: "2pt" }}
            />
          </div>
        </div>

        {/* ── JUDUL (TNR 18 pt bold underline + "(NPD)" TNR 16 pt bold) ── */}
        <p
          style={{
            margin: 0,
            textAlign: "center",
            fontFamily: TNR,
            fontSize: "18pt",
            fontWeight: "bold",
            textDecoration: "underline",
            lineHeight: 1,
          }}
        >
          NOTA PENGAJUAN DANA
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: TNR,
            fontSize: "16pt",
            fontWeight: "bold",
            textAlign: "center",
            lineHeight: 1,
          }}
        >
          (NPD)
        </p>
        <p style={{ ...TEXT11, height: "11pt" }} />

        {/* ── METADATA (Arial 11 pt; nilai mulai 25,4 mm seperti tab docx) ── */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <tbody>
            {metaRows.map(([label, value], i) => {
              // Baris lanjutan "Kab/Kota" tidak punya ":" — titik dua tetap
              // dirender tapi disembunyikan agar kolomnya sama lebar dan
              // teksnya sejajar tepat di bawah awal kalimat di atasnya.
              const hasColon = /^:/.test(String(value));
              return (
              <tr key={i}>
                <td
                  style={{
                    ...TEXT11,
                    width: "25.4mm",
                    verticalAlign: "top",
                    padding: 0,
                  }}
                >
                  {label}
                </td>
                <td style={{ ...TEXT11, verticalAlign: "top", padding: 0 }}>
                  {/* ":" kolom sendiri agar baris ke-2 dan seterusnya
                      selalu sejajar tepat di bawah awal kalimat. */}
                  <span
                    style={{
                      display: "inline-grid",
                      gridTemplateColumns: "auto 1fr",
                      columnGap: "1mm",
                      overflowWrap: "break-word",
                    }}
                  >
                    <span
                      style={{ visibility: hasColon ? "visible" : "hidden" }}
                    >
                      :
                    </span>
                    <span
                      style={{
                        minWidth: 0,
                        // Justify khusus Perihal bila teksnya lebih dari 1 baris.
                        textAlign: label === "Perihal" ? "justify" : "left",
                      }}
                    >
                      {String(value).replace(/^:\s?/, "")}
                    </span>
                  </span>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── KALIMAT PEMBUKA (indent 12,7 mm + baris pertama 12,7 mm) ── */}
        <div
          aria-hidden="true"
          style={{
            marginLeft: "2.17cm",
            width: "14.05cm",
            height: "1px",
            background: "#000",
            marginTop: "3pt",
          }}
        />

        <p
          style={{
            ...TEXT,
            marginTop: "11pt",
            paddingLeft: "12.7mm",
            textIndent: "12.7mm",
          }}
        >
          Bersama ini kami mengajukan dengan hormat permohonan pencairan
        </p>

        {/* ── PROGRAM / KEGIATAN / SUB KEGIATAN ── */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <tbody>
            {[
              ["Program", `: ${namaProgram}`],
              ["Kegiatan", `: ${namaKegiatan}`],
              ["Sub kegiatan", `: ${subKegiatan}`],
            ].map(([label, value], ri) => (
              <tr key={label}>
                <td
                  style={{
                    ...TEXT,
                    width: "25.4mm",
                    verticalAlign: "top",
                    padding: 0,
                    // Jarak 0,5 enter (6pt) tiap judul, kecuali baris terakhir.
                    paddingBottom: ri < 2 ? "6pt" : 0,
                  }}
                >
                  {label}
                </td>
                <td
                  style={{
                    ...TEXT,
                    verticalAlign: "top",
                    padding: 0,
                    paddingBottom: ri < 2 ? "6pt" : 0,
                  }}
                >
                  {/* ":" kolom sendiri agar baris ke-2 dan seterusnya
                      selalu sejajar tepat di bawah awal kalimat. */}
                  <span
                    style={{
                      display: "inline-grid",
                      gridTemplateColumns: "auto 1fr",
                      columnGap: "1.2mm",
                      overflowWrap: "break-word",
                    }}
                  >
                    <span>:</span>
                    <span
                      style={{
                        minWidth: 0,
                        // Justify khusus Kegiatan & Sub kegiatan bila
                        // teksnya lebih dari 1 baris.
                        textAlign: label === "Program" ? "left" : "justify",
                      }}
                    >
                      {String(value).replace(/^:\s?/, "")}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── RINCIAN ANGGARAN ── */}
        <p style={{ ...TEXT, marginTop: "11pt" }}>
          Sebagaimana tercantum dalam APBD Kabupaten Bojonegoro Tahun Anggaran{" "}
          {pengajuan.tahun || new Date().getFullYear()} dengan rincian sebagai
          berikut :
        </p>

        {/* Rincian a/b/c: nomor di 0, label di 12,7 mm, jumlah rata kanan 143,6 mm.
            Jarak 0,5 enter (6pt) dari kalimat "sebagai berikut :" ke "a.". */}
        <table
          style={{
            width: "143.6mm",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            marginTop: "6pt",
          }}
        >
          <colgroup>
            <col style={{ width: "12.7mm" }} />
            <col />
            <col style={{ width: "58mm" }} />
          </colgroup>
          <tbody>
            {ringkasan.map((r) => (
              <tr key={r.no}>
                <td
                  style={{
                    ...TEXT,
                    padding: "0 0 0 6.35mm",
                    verticalAlign: "top",
                  }}
                >
                  {r.no}
                </td>
                <td style={{ ...TEXT, padding: 0, verticalAlign: "top" }}>
                  {r.label}
                </td>
                <td
                  style={{
                    ...TEXT,
                    padding: 0,
                    verticalAlign: "top",
                    fontWeight: r.no === "b." ? "normal" : "bold",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "25mm 1fr",
                      whiteSpace: "nowrap",
                      borderBottom: r.no === "b." ? BD : undefined,
                    }}
                  >
                    <span>= Rp.</span>
                    <span style={{ textAlign: "right" }}>{angka(r.value)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Garis pemisah sebelum rencana penyerapan (docx: 14,05 cm mulai 2,17 cm) */}
        <table
          style={{
            width: "143.6mm",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            marginTop: "12pt",
          }}
        >
          <colgroup>
            <col style={{ width: "12.7mm" }} />
            <col />
            <col style={{ width: "58mm" }} />
          </colgroup>
          <tbody>
            <tr>
              <td style={{ ...TEXT, padding: 0, verticalAlign: "top" }} />
              <td
                style={{
                  ...TEXT,
                  padding: 0,
                  verticalAlign: "top",
                }}
              >
                Rencana penyerapan sebesar
              </td>
              <td
                style={{
                  ...TEXT,
                  padding: 0,
                  verticalAlign: "top",
                  fontWeight: "bold",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "25mm 1fr",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span>= Rp.</span>
                  <span style={{ textAlign: "right" }}>{angka(rencana)}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td
                colSpan={3}
                style={{
                  ...TEXT,
                  padding: 0,
                  paddingLeft: "12.7mm",
                  verticalAlign: "top",
                  fontWeight: "bold",
                }}
              >
                ({terbilang(rencana)})
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{ ...TEXT, marginTop: "11pt" }}>
          Rencana Penyerapan tersebut dibebankan pada rekening sebgai berikut :
        </p>

        {/* ── TABEL REKENING (lebar 143,6 mm = 527 + 4024 + 3591 twips) ── */}
        <table
          style={{
            width: "143.6mm",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            marginTop: "2pt",
          }}
        >
          <colgroup>
            <col style={{ width: "9.3mm" }} />
            <col style={{ width: "71mm" }} />
            <col style={{ width: "63.3mm" }} />
          </colgroup>
          <thead>
            <tr>
              <th
                style={{
                  ...TEXT,
                  border: BD,
                  padding: "1.9mm",
                  height: "7.5mm",
                  textAlign: "center",
                  fontWeight: "normal",
                  verticalAlign: "middle",
                }}
              >
                No
              </th>
              <th
                style={{
                  ...TEXT,
                  border: BD,
                  padding: "1.9mm",
                  textAlign: "center",
                  fontWeight: "normal",
                  verticalAlign: "middle",
                }}
              >
                Kode Rekening/Uraian
              </th>
              <th
                style={{
                  ...TEXT,
                  border: BD,
                  padding: "1.9mm",
                  textAlign: "center",
                  fontWeight: "normal",
                  verticalAlign: "middle",
                }}
              >
                Jumlah Dana
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.id || idx}>
                <td
                  style={{
                    ...TEXT,
                    border: BD,
                    padding: "1.9mm",
                    height: "14.1mm",
                    textAlign: "center",
                    verticalAlign: "middle",
                  }}
                >
                  {idx + 1}
                </td>
                <td
                  style={{
                    ...TEXT,
                    border: BD,
                    padding: "1.9mm",
                    fontWeight: "bold",
                    verticalAlign: "middle",
                  }}
                >
                  <p style={{ margin: 0 }}>
                    {it.budget_lines?.kode_uraian || "—"}
                  </p>
                  <p style={{ margin: 0 }}>
                    {it.budget_lines?.nama_uraian || "—"}
                  </p>
                </td>
                <td
                  style={{
                    ...TEXT,
                    border: BD,
                    padding: "1.9mm",
                    textAlign: "right",
                    fontWeight: "bold",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                  }}
                >
                  {rupiah(it.nominal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                style={{
                  ...TEXT,
                  border: BD,
                  padding: "1.9mm",
                  height: "6.3mm",
                  verticalAlign: "middle",
                }}
              />
              <td
                style={{
                  ...TEXT,
                  border: BD,
                  padding: "1.9mm",
                  textAlign: "center",
                  fontWeight: "bold",
                  verticalAlign: "middle",
                }}
              >
                Jumlah
              </td>
              <td
                style={{
                  ...TEXT,
                  border: BD,
                  padding: "1.9mm",
                  textAlign: "right",
                  fontWeight: "bold",
                  verticalAlign: "middle",
                  whiteSpace: "nowrap",
                }}
              >
                {rupiah(rencana)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ── PENUTUP ── */}
        <p style={{ ...TEXT, margin: "8pt 0 0 0" }}>
          Adapun Dokumen SPJ dan Persyaratan lain telah lengkap sesuai dengan
          peraturan perundang undangan yang berlaku.
        </p>
        <p style={{ ...TEXT, margin: "8pt 0 0 0" }}>
          Demikian untuk menjadikan periksa dan mohon berkenan Bapak Kepala
          Dinas untuk memberikan persetujuan.
        </p>

        {/* ── TANDA TANGAN (rata tengah, Geser ke kanan) ── */}
        <div style={{ width: "50%", marginLeft: "auto", textAlign: "center" }}>
          <p style={{ ...TEXT, marginTop: "11pt" }}>
            Bojonegoro, {tanggalTtd}
          </p>
          <p style={{ ...TEXT, marginTop: "11pt" }}>
            {jabatanPenanda}
          </p>
          <p style={{ ...TEXT, height: "12pt" }} />
          <p style={{ ...TEXT, height: "12pt" }} />
          <p style={{ ...TEXT, height: "12pt" }} />
          <p style={{ ...TEXT, height: "12pt" }} />
          <p style={{ ...TEXT, height: "12pt" }} />
          <p
            style={{
              ...TEXT,
              fontWeight: "bold",
              textDecoration: "underline",
            }}
          >
            {namaPenanda}
          </p>
          <p style={{ ...TEXT }}>
            {nipPenanda ? `NIP. ${nipPenanda}` : "NIP. …"}
          </p>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
