"use client";

import { useFitOnePage } from "./useFitOnePage";

// ============================================================
// Cetak Lembar Kendali Anggaran — Dinas Kepemudaan dan Olahraga
//   Kertas : F4 (8,5 x 13 inci), margin atas-bawah 1,5 cm, kiri-kanan 1 cm
//   (layout & margin sama seperti cetak NPD — class .npd-print-container
//    dan .npd-sheet dipakai ulang agar aturan @media print berlaku)
//   Isi    : Arial 11 pt (mengecil otomatis bila isi panjang agar tetap 1 halaman),
//            judul Arial 13 pt bold, spasi tunggal
//   Tabel  : NO | URAIAN | PAGU | DISERAP | SISA | RENCANA | SISA AKHIR
// ============================================================

const ARIAL = "Arial, Helvetica, sans-serif";
const BD = "1px solid #000";

// Isi (Arial 11 pt) — spasi tunggal.
const TEXT = { fontFamily: ARIAL, fontSize: "11pt", lineHeight: 1, margin: 0 };

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

function formatBulanTahun(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return `${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

// Tanggal lengkap untuk tanda tangan, mis. "23 September 2026".
function formatTanggal(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

// Angka saja (tanpa "Rp.") — dipakai pada sel jumlah agar sejajar kanan.
function angka(v) {
  return new Intl.NumberFormat("id-ID").format(Number(v ?? 0));
}

export default function KendaliPrint({
  pengajuan,
  items = [],
  ptk,
  pengaju,
  budgetSummary = [],
  history = [],
  disbursements = [],
}) {
  // Fit 1 halaman ala Excel: wrapper mengunci tinggi hasil skala,
  // inner di-scale seragam (wrapping teks tidak berubah).
  // Hook dipasang sebelum early-return agar urutannya stabil.
  // Padding vertikal sheet kendali = 1,5cm + 1,5cm = 3cm.
  const { innerRef, fitWrapStyle, fitInnerStyle } = useFitOnePage(
    pengajuan?.id || "",
    3
  );

  if (!pengajuan) return null;

  // BULAN mengikuti bulan input tanggal pengajuan pada form NPD.
  const bulanLabel = formatBulanTahun(pengajuan.tanggal_pengajuan);
  // Tanda tangan memakai tanggal input pengajuan sesuai NPD.
  const tanggalTtd = formatTanggal(pengajuan.tanggal_pengajuan);

  const first = items[0]?.budget_lines || {};
  const namaProgram = first.nama_program || "—";
  const namaKegiatan = first.nama_kegiatan || "—";
  const subKegiatan = first.nama_sub_kegiatan || "—";

  // Rencana penyerapan per uraian — nominal NPD ini (snapshot dokumen).
  // Selalu tampil penuh di cetak walaupun di sistem sudah pindah ke realisasi.
  const rencanaMap = {};
  for (const it of items) {
    const keyLine = it.budget_line_id;
    const keyUraian = it.budget_lines?.kode_uraian;
    const nom = Number(it.nominal || 0);
    if (keyLine) rencanaMap[`id:${keyLine}`] = (rencanaMap[`id:${keyLine}`] || 0) + nom;
    if (keyUraian) rencanaMap[`ku:${keyUraian}`] = (rencanaMap[`ku:${keyUraian}`] || 0) + nom;
  }
  const rencanaOf = (b) =>
    rencanaMap[`id:${b.budget_line_id}`] ?? rencanaMap[`ku:${b.kode_uraian}`] ?? 0;

  // Baris tabel = seluruh uraian dalam sub kegiatan.
  // DOKUMEN BEKU: pakai snapshot saat DIAJUKAN pertama bila ada
  // (migration_014); fallback = nilai terkini MINUS cair milik NPD ini.
  const snapshotRows = Array.isArray(pengajuan?.snapshot_items)
    ? pengajuan.snapshot_items
    : [];
  const useSnapshot = snapshotRows.length > 0 && pengajuan?.snapshot_at != null;

  const itemIdToLine = new Map(
    items.map((it) => [it.id, it.budget_line_id]).filter(([a, b]) => a && b)
  );
  const ownCairByLine = {};
  for (const d of disbursements || []) {
    const lineId = itemIdToLine.get(d.pengajuan_item_id);
    const key = lineId || d.pengajuan_item_id;
    if (!key) continue;
    ownCairByLine[key] = (ownCairByLine[key] || 0) + Number(d.nominal || 0);
  }

  const rows = useSnapshot
    ? snapshotRows.map((s, idx) => {
        const pagu = Number(s.pagu || 0);
        const diserap = Number(s.realisasi || 0);
        const sisa = Number(s.sisa ?? pagu - diserap);
        const rencana = Number(s.rencana ?? rencanaOf({ budget_line_id: s.budget_line_id, kode_uraian: s.kode_uraian }) ?? 0);
        return {
          key: s.budget_line_id || s.kode_uraian || idx,
          uraian: s.nama_uraian || "—",
          pagu,
          diserap,
          sisa,
          rencana,
          sisaAkhir: sisa - rencana,
        };
      })
    : (budgetSummary || []).map((b) => {
        const pagu = Number(b.pagu || 0);
        const own =
          ownCairByLine[b.budget_line_id] ??
          ownCairByLine[b.kode_uraian] ??
          0;
        // Kurangi cair milik NPD ini agar cetak ulang tidak berubah setelah pencairan.
        const diserap = Math.max(0, Number(b.realisasi || 0) - Number(own || 0));
        const sisa = pagu - diserap;
        const rencana = Number(rencanaOf(b) || 0);
        return {
          key: b.budget_line_id || b.kode_uraian,
          uraian: b.nama_uraian || "—",
          pagu,
          diserap,
          sisa,
          rencana,
          sisaAkhir: sisa - rencana,
        };
      });

  const sum = (f) => rows.reduce((a, r) => a + r[f], 0);
  const totPagu = sum("pagu");
  const totDiserap = sum("diserap");
  const totSisa = sum("sisa");
  const totRencana = Number(pengajuan.total_nominal || 0);
  const totSisaAkhir = totSisa - totRencana;

  // Penanda tangan: PTK dari master data -> fallback akun pengaju.
  const namaPenanda = ptk?.nama || pengaju?.display_name || "—";
  const nipPenanda = ptk?.nip || pengaju?.nip || "";
  const jabatanPenanda = (
    ptk?.jabatan || "Pejabat Pelaksana Teknis Kegiatan"
  ).toUpperCase();

  const infoTop = [
    { label: "Program", value: namaProgram },
    { label: "Kegiatan", value: namaKegiatan },
    { label: "Sub. Kegiatan", value: subKegiatan },
  ];
  const infoAmounts = [
    { label: "Pagu Anggaran", amount: totPagu },
    { label: "Anggaran Sudah Diserap", amount: totDiserap },
    { label: "Sisa Pagu Anggaran", amount: totSisa },
    { label: "Rencana Penyerapan", amount: totRencana },
    { label: "Sisa Akhir", amount: totSisaAkhir },
  ];

  const renderInfoRow = (r, i) => (
    <tr key={i}>
      <td
        style={{
          ...TEXT,
          width: "45mm",
          verticalAlign: "top",
          padding: 0,
        }}
      >
        {r.label}
      </td>
      <td
        style={{
          ...TEXT,
          verticalAlign: "top",
          padding: 0,
        }}
      >
        {r.amount !== undefined ? (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              width: "40mm",
            }}
          >
            <span style={{ flexShrink: 0 }}>Rp</span>
            <span
              style={{
                marginLeft: "2mm",
                minWidth: 0,
                flex: 1,
                textAlign: "right",
                whiteSpace: "nowrap",
              }}
            >
              {angka(r.amount)}
            </span>
          </div>
        ) : (
          r.value
        )}
      </td>
    </tr>
  );

  const headCols = [
    { label: "NO", width: "7mm" },
    { label: "URAIAN", width: undefined },
    { label: "PAGU ANGGARAN", width: "28mm" },
    { label: "ANGGARAN SUDAH DISERAP", width: "28mm" },
    { label: "SISA PAGU ANGGARAN", width: "28mm" },
    { label: "RENCANA PENYERAPAN", width: "28mm" },
    { label: "SISA AKHIR", width: "28mm" },
  ];

  return (
    <div className="npd-print-container">
      <style>{`
        /* Kendali: kertas F4 8,5 x 13 inci, margin atas-bawah 1,5cm kiri-kanan 1cm */
        .npd-sheet {
          width: 8.5in;
          min-height: 13in;
          padding: 1.5cm 1cm;
          box-sizing: border-box;
          background: #fff;
          color: #000;
        }
        .npd-sheet, .npd-sheet * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @page { size: 8.5in 13in; margin: 0; }
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
            width: 8.5in !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .npd-sheet {
            width: 8.5in !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 1.5cm 1cm !important;
            box-shadow: none !important;
            border: 0 !important;
          }
        }
      `}</style>
      <div className="npd-sheet">
        <div style={fitWrapStyle}>
          <div ref={innerRef} style={fitInnerStyle}>
        {/* ── JUDUL ── */}
        <p
          style={{
            ...TEXT,
            fontSize: "14pt",
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          LEMBAR KENDALI ANGGARAN
        </p>
        <p
          style={{
            ...TEXT,
            fontSize: "14pt",
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          DINAS KEPEMUDAAN DAN OLAHRAGA KAB. BOJONEGORO
        </p>
        <p
          style={{
            ...TEXT,
            fontSize: "14pt",
            fontWeight: "bold",
            textAlign: "center",
            marginTop: "2pt",
          }}
        >
          BULAN : {bulanLabel}
        </p>

        {/* ── BLOK INFO ── */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            marginTop: "12pt",
          }}
        >
          <tbody>
            {infoTop.map(renderInfoRow)}
            {/* Jarak satu enter setelah kalimat terakhir Sub. Kegiatan */}
            <tr>
              <td
                colSpan={2}
                style={{ ...TEXT, height: "11pt", padding: 0 }}
              />
            </tr>
            {infoAmounts.map(renderInfoRow)}
          </tbody>
        </table>

        {/* ── TABEL URAIAN ── */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
            marginTop: "12pt",
          }}
        >
          <colgroup>
            {headCols.map((c, i) => (
              <col key={i} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {headCols.map((c, i) => (
                <th
                  key={i}
                  style={{
                    ...TEXT,
                    border: BD,
                    padding: "1mm",
                    textAlign: "center",
                    fontWeight: "bold",
                    verticalAlign: "middle",
                  }}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.key || idx}>
                <td
                  style={{
                    ...TEXT,
                    border: BD,
                    padding: "1mm",
                    textAlign: "center",
                    verticalAlign: "top",
                    fontWeight: "bold",
                  }}
                >
                  {idx + 1}
                </td>
                <td
                  style={{
                    ...TEXT,
                    border: BD,
                    padding: "1mm",
                    verticalAlign: "top",
                    overflowWrap: "break-word",
                  }}
                >
                  {r.uraian}
                </td>
                <td
                  style={{
                    ...TEXT,
                    fontSize: "10pt",
                    border: BD,
                    padding: "1mm",
                    textAlign: "right",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  {angka(r.pagu)}
                </td>
                <td
                  style={{
                    ...TEXT,
                    fontSize: "10pt",
                    border: BD,
                    padding: "1mm",
                    textAlign: "right",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  {angka(r.diserap)}
                </td>
                <td
                  style={{
                    ...TEXT,
                    fontSize: "10pt",
                    border: BD,
                    padding: "1mm",
                    textAlign: "right",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  {angka(r.sisa)}
                </td>
                <td
                  style={{
                    ...TEXT,
                    fontSize: "10pt",
                    border: BD,
                    padding: "1mm",
                    textAlign: "right",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.rencana ? angka(r.rencana) : ""}
                </td>
                <td
                  style={{
                    ...TEXT,
                    fontSize: "10pt",
                    border: BD,
                    padding: "1mm",
                    textAlign: "right",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  {angka(r.sisaAkhir)}
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
                  padding: "1mm",
                  verticalAlign: "middle",
                }}
              />
              <td
                style={{
                  ...TEXT,
                  border: BD,
                  padding: "1mm",
                  fontWeight: "bold",
                  verticalAlign: "middle",
                }}
              >
                JUMLAH
              </td>
              {[
                totPagu,
                totDiserap,
                totSisa,
                totRencana || "",
                totSisaAkhir,
              ].map((v, i) => (
                <td
                  key={i}
                  style={{
                    ...TEXT,
                    fontSize: "10pt",
                    border: BD,
                    padding: "1mm",
                    textAlign: "right",
                    fontWeight: "bold",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                  }}
                >
                  {v === "" ? "" : angka(v)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>

        {/* ── TANDA TANGAN ── */}
        <div style={{ width: "50%", marginLeft: "auto", textAlign: "center" }}>
          <p style={{ ...TEXT, marginTop: "12pt" }}>
            Bojonegoro, {tanggalTtd}
          </p>
          <p style={{ ...TEXT }}>{jabatanPenanda}</p>
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
            {namaPenanda.toUpperCase()}
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
