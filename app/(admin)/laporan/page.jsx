"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileSpreadsheet,
  Download,
  Loader2,
  Building2,
  Calendar,
  FileText,
  CircleAlert,
  CheckCircle2,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatRupiah, persenRealisasi } from "@/lib/domain";

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// "2026-09-30" -> "30 SEPTEMBER 2026" (dipakai sebagai baris 3 Excel).
function bulanLabelFromISO(iso) {
  const names = ["JANUARI","FEBRUARI","MARET","APRIL","MEI","JUNI","JULI","AGUSTUS","SEPTEMBER","OKTOBER","NOVEMBER","DESEMBER"];
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d} ${names[m - 1]} ${y}`;
}

function defaultBulan() {
  return bulanLabelFromISO(todayISO());
}

// Realisasi s.d. tanggal cut-off (inklusif, batas akhir hari WIB).
// Mengambil disbursements lalu diagregasi per budget_line_id di client,
// sehingga RLS tetap berlaku (admin semua, user hanya bidangnya).
async function fetchCutoffMap(client, cutoffISO) {
  const upper = `${cutoffISO}T23:59:59+07:00`;
  const { data, error } = await client
    .from("disbursements")
    .select("nominal, pengajuan_item:pengajuan_item_id(budget_line_id)")
    .lte("dicairkan_at", upper)
    .limit(5000);
  if (error) throw error;
  const map = {};
  for (const d of data || []) {
    const bid = d.pengajuan_item?.budget_line_id;
    if (!bid) continue;
    map[bid] = (map[bid] || 0) + Number(d.nominal || 0);
  }
  return map;
}

export default function LaporanSpjPage() {
  const [profile, setProfile] = useState(null);
  const [bidangList, setBidangList] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filterBidang, setFilterBidang] = useState("semua");
  const [filterTahun, setFilterTahun] = useState(String(new Date().getFullYear()));
  const [cutoff, setCutoff] = useState(todayISO());
  const [cutoffMap, setCutoffMap] = useState(null);
  const [cutoffLoading, setCutoffLoading] = useState(false);
  const [bulanLabel, setBulanLabel] = useState(defaultBulan());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const isAdmin = profile?.role === "admin";
  const bidangMap = useMemo(() => Object.fromEntries(bidangList.map((b) => [b.id, b])), [bidangList]);
  // User non-admin terkunci ke bidangnya; admin bisa pilih semua / per bidang.
  const activeBidang = isAdmin ? filterBidang : profile?.bidang_id || "semua";

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      let prof = null;
      if (user) {
        const { data } = await supabase.from("profiles").select("id, role, bidang_id").eq("id", user.id).single();
        prof = data || null;
      }
      setProfile(prof);
      const { data: bidData, error: bidErr } = await supabase.from("bidang").select("id, nama, kode").order("nama");
      if (bidErr) throw bidErr;
      setBidangList(bidData || []);
      // RLS otomatis: admin dapat semua, user hanya bidangnya.
      // Pagu + identitas uraian dari view; realisasi dihitung dari cut-off (lihat bawah).
      const { data: realData, error: realErr } = await supabase
        .from("v_budget_realisasi")
        .select("budget_line_id, bidang_id, tahun, kode_sub_kegiatan, nama_sub_kegiatan, kode_uraian, nama_uraian, pagu")
        .order("kode_sub_kegiatan")
        .order("kode_uraian")
        .limit(5000);
      if (realErr) throw realErr;
      setRows(realData || []);
      const cmap = await fetchCutoffMap(supabase, todayISO());
      setCutoffMap(cmap);
      if (prof?.role !== "admin" && prof?.bidang_id) setFilterBidang(prof.bidang_id);
    } catch (err) {
      setLoadError(err.message || "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  // Ganti tanggal cut-off: label bulan Excel ikut berubah, realisasi dihitung ulang.
  async function handleCutoffChange(v) {
    setCutoff(v);
    const auto = bulanLabelFromISO(v);
    if (auto) setBulanLabel(auto);
    if (!v) return;
    setCutoffLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const supabase = createBrowserClient();
      const cmap = await fetchCutoffMap(supabase, v);
      setCutoffMap(cmap);
    } catch (err) {
      setMsg({ type: "err", text: err.message || "Gagal menghitung realisasi cut-off." });
    } finally {
      setCutoffLoading(false);
    }
  }

  const tahunList = useMemo(() => {
    const s = new Set(rows.map((r) => String(r.tahun)).filter(Boolean));
    s.add(String(new Date().getFullYear()));
    return [...s].sort((a, b) => Number(b) - Number(a));
  }, [rows]);

  // Baris efektif: realisasi = pencairan s.d. cut-off (inklusif).
  // Sebelum peta cut-off termuat, fallback ke 0 agar tidak tercampur angka kumulatif view.
  const effectiveRows = useMemo(() => {
    if (!cutoffMap) return rows.map((r) => ({ ...r, realisasi: 0 }));
    return rows.map((r) => ({ ...r, realisasi: cutoffMap[r.budget_line_id] ?? 0 }));
  }, [rows, cutoffMap]);

  const filtered = useMemo(() => {
    return effectiveRows
      .filter((r) => String(r.tahun) === String(filterTahun))
      .filter((r) => (activeBidang === "semua" ? true : r.bidang_id === activeBidang))
      .map((r) => ({ ...r, bidang_nama: bidangMap[r.bidang_id]?.nama || "—" }));
  }, [effectiveRows, filterTahun, activeBidang, bidangMap]);

  const totals = useMemo(() => {
    const pagu = filtered.reduce((a, r) => a + Number(r.pagu || 0), 0);
    const realisasi = filtered.reduce((a, r) => a + Number(r.realisasi || 0), 0);
    return { pagu, realisasi, sisa: pagu - realisasi, persen: persenRealisasi(realisasi, pagu) };
  }, [filtered]);

  const previewSubs = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const k = r.kode_sub_kegiatan;
      if (!map.has(k)) map.set(k, { kode: k, nama: r.nama_sub_kegiatan, n: 0, pagu: 0, realisasi: 0 });
      const g = map.get(k);
      g.n += 1; g.pagu += Number(r.pagu || 0); g.realisasi += Number(r.realisasi || 0);
    }
    return [...map.values()].sort((a, b) => String(a.kode).localeCompare(String(b.kode)));
  }, [filtered]);

  async function handleDownload() {
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      if (filtered.length === 0) throw new Error("Tidak ada data untuk filter ini.");
      const { buildSpjBuffer } = await import("@/lib/laporan-spj");
      const buf = await buildSpjBuffer(filtered, { bulanLabel: bulanLabel.trim() || defaultBulan(), tahun: filterTahun });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const bidangNama = activeBidang === "semua" ? "Semua-Bidang" : (bidangMap[activeBidang]?.nama || "Bidang").replace(/\s+/g, "-");
      const cutoffPart = cutoff ? ` per ${cutoff.split("-").reverse().join("-")}` : "";
      const fname = `Laporan SPJ ${bidangNama} ${filterTahun}${cutoffPart}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg({ type: "ok", text: `${fname} terunduh (${filtered.length} uraian, ${previewSubs.length} sub kegiatan). Realisasi per cut-off ${cutoff || "—"}. SISA & % memakai rumus Excel.` });
    } catch (err) {
      setMsg({ type: "err", text: err.message || "Gagal membuat laporan." });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-3">
        <div className="h-6 w-56 rounded-lg bg-slate-100 animate-pulse" />
        <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-6">
        <p className="font-medium text-rose-700">Gagal memuat: {loadError}</p>
        <button type="button" onClick={loadAll} className="mt-3 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50">Coba lagi</button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12">
      <div>
        <p className="text-xs md:text-sm font-semibold text-blue-600 tracking-wide">Unduhan</p>
        <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-slate-900 mt-0.5">Laporan SPJ</h1>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          {isAdmin
            ? "Admin: unduh semua bidang atau pilih per bidang. Format & rumus Excel sama persis seperti file contoh (SISA = Pagu − Realisasi, % = Realisasi / Pagu, JUMLAH = SUM, ringkasan = SUMIF)."
            : `Akun bidang ${bidangMap[profile?.bidang_id]?.nama || "Anda"}: unduhan otomatis hanya berisi laporan bidang Anda.`}
        </p>
      </div>

      {msg.text && (
        <p role={msg.type === "err" ? "alert" : "status"} className={`text-xs md:text-sm rounded-xl px-4 py-3 border flex items-center gap-2 ${msg.type === "err" ? "text-rose-700 bg-rose-50 border-rose-200" : "text-emerald-800 bg-emerald-50 border-emerald-200"}`}>
          {msg.type === "err" ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{msg.text}</span>
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-clean p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
            <FileSpreadsheet size={18} />
          </div>
          <div>
            <h2 className="font-bold text-[15px] text-slate-900 leading-tight">Filter laporan</h2>
            <p className="text-xs text-slate-400 mt-0.5">Realisasi = pencairan (CAIR/SELESAI) s.d. tanggal cut-off.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <label className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1.5">Tahun anggaran</span>
            <span className="relative flex items-center">
              <Calendar size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
              <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500">
                {tahunList.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </span>
          </label>
          {isAdmin ? (
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">Bidang</span>
              <span className="relative flex items-center">
                <Building2 size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
                <select value={filterBidang} onChange={(e) => setFilterBidang(e.target.value)} className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500">
                  <option value="semua">Semua bidang</option>
                  {bidangList.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
                </select>
              </span>
            </label>
          ) : (
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">Bidang (otomatis)</span>
              <input value={bidangMap[profile?.bidang_id]?.nama || "—"} disabled className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600 cursor-not-allowed" />
            </label>
          )}
          <label className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1.5">Tanggal cut-off realisasi</span>
            <span className="relative flex items-center">
              <Calendar size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={cutoff}
                max={todayISO()}
                onChange={(e) => handleCutoffChange(e.target.value)}
                title="Hanya pencairan s.d. tanggal ini yang dihitung sebagai realisasi"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500"
              />
            </span>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1.5">Label bulan (baris 3 Excel)</span>
            <span className="relative flex items-center">
              <FileText size={15} className="absolute left-3 text-slate-400 pointer-events-none" />
              <input value={bulanLabel} onChange={(e) => setBulanLabel(e.target.value)} placeholder="30 SEPTEMBER 2026" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500 uppercase" />
            </span>
          </label>
        </div>
        {cutoffLoading && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 size={13} className="animate-spin" /> Menghitung ulang realisasi s.d. cut-off…
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[["Total pagu", totals.pagu], ["Realisasi", totals.realisasi], ["Sisa", totals.sisa]].map(([l, v]) => (
            <div key={l} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{l}</p>
              <p className="text-sm font-extrabold tabular-nums text-slate-900 mt-0.5 truncate" title={formatRupiah(v)}>{formatRupiah(v)}</p>
            </div>
          ))}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">Realisasi</p>
            <p className="text-sm font-extrabold tabular-nums text-emerald-800 mt-0.5">{Number(totals.persen || 0).toFixed(2)}%</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={busy || cutoffLoading || filtered.length === 0}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-semibold shadow-md shadow-emerald-500/25 hover:shadow-lg disabled:opacity-50 transition-all"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {busy ? "Menyusun Excel…" : `Download Excel (${filtered.length} uraian)`}
        </button>
        <p className="text-[11px] text-slate-400 mt-2">File berisi: rincian per sub kegiatan + JUMLAH (SUM) + tanda tangan + ringkasan per bidang (SUMIF) + total dinas — semua SISA & % berupa rumus Excel yang tetap hidup saat dibuka.</p>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-clean overflow-hidden" aria-label="Pratinjau">
        <div className="px-5 pt-5 pb-3">
          <h2 className="font-bold text-[15px] text-slate-900">Pratinjau isi ({previewSubs.length} sub kegiatan)</h2>
          <p className="text-xs text-slate-400 mt-0.5">Realisasi per cut-off {cutoff || "—"} · sama urutannya dengan sheet Excel yang akan diunduh.</p>
        </div>
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-xs min-w-[52rem]">
            <thead>
              <tr className="text-left text-[11px] text-slate-500 bg-slate-50/70 uppercase tracking-wide">
                <th className="px-4 py-2.5">Sub kegiatan</th>
                <th className="px-4 py-2.5 text-right">Uraian</th>
                <th className="px-4 py-2.5 text-right">Pagu</th>
                <th className="px-4 py-2.5 text-right">Realisasi</th>
                <th className="px-4 py-2.5 text-right">Sisa</th>
                <th className="px-4 py-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {previewSubs.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">Tidak ada data untuk filter ini.</td></tr>
              ) : previewSubs.slice(0, 50).map((g) => (
                <tr key={g.kode} className="border-t border-slate-100">
                  <td className="px-4 py-2.5"><span className="font-mono font-semibold text-slate-700">{g.kode}</span><span className="block text-slate-500">{g.nama}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{g.n}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatRupiah(g.pagu)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(g.realisasi)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatRupiah(g.pagu - g.realisasi)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{persenRealisasi(g.realisasi, g.pagu).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {previewSubs.length > 50 && <p className="px-5 py-3 text-[11px] text-slate-400">Menampilkan 50 dari {previewSubs.length} — file Excel tetap berisi semuanya.</p>}
      </section>
    </div>
  );
}
