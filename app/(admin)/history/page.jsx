"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  CircleAlert,
  Send,
  RotateCcw,
  Pencil,
  Eye,
  FileText,
  FileEdit,
  Clock3,
  CheckCircle2,
  XCircle,
  Building2,
  Calendar,
  Layers,
  ListFilter,
  ReceiptText,
  History as HistoryIcon,
  Inbox,
  Banknote,
  Printer,
  ClipboardList,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/domain";
import NpdPrint from "@/components/NpdPrint";
import KendaliPrint from "@/components/KendaliPrint";

const STATUS_LIST = [
  "DRAFT",
  "DIAJUKAN",
  "DIPROSES",
  "REVISI",
  "SIAP_DICAIRKAN",
  "CAIR",
  "SELESAI",
  "DITOLAK",
];

// Aksi cepat admin di tabel (satu-satunya jalan ubah status via UI).
const TABLE_ACTIONS = {
  DRAFT: ["DIAJUKAN"],
  DIAJUKAN: ["DIPROSES"],
  DIPROSES: ["REVISI", "DRAFT", "CAIR"],
  SIAP_DICAIRKAN: ["REVISI", "DRAFT", "CAIR"],
  REVISI: ["DIPROSES", "DRAFT"],
  CAIR: [],
  SELESAI: [],
  DITOLAK: [],
};

const STATUS_TONE = {
  DRAFT: "bg-slate-100 text-slate-600 border-slate-300",
  DIAJUKAN: "bg-blue-50 text-blue-700 border-blue-300",
  DIPROSES: "bg-indigo-50 text-indigo-700 border-indigo-300",
  REVISI: "bg-amber-50 text-amber-800 border-amber-300",
  SIAP_DICAIRKAN: "bg-cyan-50 text-cyan-800 border-cyan-300",
  CAIR: "bg-emerald-50 text-emerald-700 border-emerald-300",
  SELESAI: "bg-emerald-600 text-white border-emerald-600",
  DITOLAK: "bg-rose-50 text-rose-700 border-rose-300",
};

const CARD_TONES = {
  blue: {
    card: "border-blue-100/90 bg-gradient-to-r from-blue-50/90 via-slate-50/40 to-indigo-50/90",
    icon: "bg-blue-100/90 text-blue-600 ring-blue-200/70",
    wave1: "#93c5fd",
    wave2: "#6366f1",
  },
  amber: {
    card: "border-amber-100/90 bg-gradient-to-r from-amber-50/90 via-slate-50/40 to-orange-50/90",
    icon: "bg-amber-100/90 text-amber-600 ring-amber-200/70",
    wave1: "#fcd34d",
    wave2: "#f97316",
  },
  emerald: {
    card: "border-emerald-100/90 bg-gradient-to-r from-emerald-50/90 via-slate-50/40 to-teal-50/90",
    icon: "bg-emerald-100/90 text-emerald-600 ring-emerald-200/70",
    wave1: "#6ee7b7",
    wave2: "#14b8a6",
  },
  rose: {
    card: "border-rose-100/90 bg-gradient-to-r from-rose-50/90 via-slate-50/40 to-pink-50/90",
    icon: "bg-rose-100/90 text-rose-600 ring-rose-200/70",
    wave1: "#fda4af",
    wave2: "#f43f5e",
  },
};

function StatCard({ icon: Icon, label, value, caption, tone }) {
  const t = CARD_TONES[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 md:p-5 shadow-clean ${t.card}`}>
      <svg
        viewBox="0 0 140 80"
        preserveAspectRatio="none"
        aria-hidden
        className="absolute right-0 top-0 h-full w-32 pointer-events-none"
      >
        <path d="M0 80 C 35 46, 60 66, 85 40 C 105 20, 122 26, 140 6 L 140 80 Z" fill={t.wave1} opacity="0.4" />
        <path d="M0 80 C 30 60, 62 72, 92 52 C 112 40, 126 44, 140 34 L 140 80 Z" fill={t.wave2} opacity="0.28" />
      </svg>
      <div className="relative flex items-center gap-3.5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ring-1 ring-inset shrink-0 ${t.icon}`}>
          <Icon size={22} strokeWidth={2.1} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 leading-tight mt-0.5 tabular-nums">{value}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">{caption}</p>
        </div>
      </div>
    </div>
  );
}

function IconSelect({ icon: Icon, value, onChange, disabled, title, className, children }) {
  return (
    <div className={`relative ${className || ""}`}>
      <Icon size={15} className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        title={title}
        className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200/90 bg-white text-[13px] font-medium text-slate-700 outline-none appearance-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 transition-all"
      >
        {children}
      </select>
      <ChevronDown size={14} className="text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide border ${STATUS_TONE[status] || "bg-slate-100 text-slate-600 border-slate-300"}`}
    >
      <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="p-3.5 border-b border-r border-slate-100 min-w-0">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <div className="text-[13px] font-semibold text-slate-800 mt-1 truncate">{children}</div>
    </div>
  );
}

function pageNumbers(current, total) {
  const span = 5;
  let start = Math.max(1, current - 2);
  const end = Math.min(total, start + span - 1);
  start = Math.max(1, end - span + 1);
  const arr = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

const TABS = [
  { key: "detail", label: "Detail", icon: ReceiptText },
  { key: "uraian", label: "Uraian", icon: Layers },
  { key: "timeline", label: "Timeline", icon: HistoryIcon },
  { key: "dokumen", label: "Dokumen", icon: FileText },
];

export default function HistoryPage() {
  const [supabaseOk, setSupabaseOk] = useState(true);
  const [profile, setProfile] = useState(null);
  const [bidangList, setBidangList] = useState([]);
  const [rows, setRows] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [filterBidang, setFilterBidang] = useState("semua");
  const [filterTahun, setFilterTahun] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [filterDari, setFilterDari] = useState("");
  const [filterSampai, setFilterSampai] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState("detail");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [statusModal, setStatusModal] = useState(null); // {row, to}
  const [editModal, setEditModal] = useState(null); // {row}
  const [editTo, setEditTo] = useState("");
  const [catatan, setCatatan] = useState("");
  const [remark, setRemark] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionMsg, setActionMsg] = useState({ type: "", text: "" });

  const [budgetSummary, setBudgetSummary] = useState([]);
  const [showPrint, setShowPrint] = useState(false);
  const [showKendali, setShowKendali] = useState(false);

  const isAdmin = profile?.role === "admin";
  const bidangMap = useMemo(
    () => Object.fromEntries(bidangList.map((b) => [b.id, b])),
    [bidangList]
  );

  // Mirror state ke ref agar interval/realtime tidak membaca closure basi.
  const selectedIdRef = useRef(null);
  const rowsRef = useRef([]);
  const namesRef = useRef({});
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { namesRef.current = names; }, [names]);

  function getClient() {
    return createBrowserClient();
  }

  async function loadAll(quiet = false) {
    if (!quiet) {
      setLoading(true);
      setLoadError("");
    }
    try {
      const supabase = getClient();
      const { data: { user } } = await supabase.auth.getUser();
      let prof = null;
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("id, role, bidang_id")
          .eq("id", user.id)
          .single();
        prof = data || null;
      }
      setProfile(prof);

      const { data: bidData, error: bidErr } = await supabase
        .from("bidang")
        .select("id, nama, kode")
        .order("nama");
      if (bidErr) throw bidErr;
      setBidangList(bidData || []);

      // RLS otomatis: admin semua, user hanya bidangnya.
      const { data: rowData, error: rowErr } = await supabase
        .from("pengajuan")
        .select(
          "id, nomor_pengajuan, bidang_id, tahun, tanggal_pengajuan, nama_npd, ptk_id, catatan, status, total_nominal, diajukan_oleh, created_at, updated_at"
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (rowErr) throw rowErr;
      setRows(rowData || []);

      // Nama pengaju (RLS: admin baca semua, user hanya yang diizinkan).
      const ids = [...new Set((rowData || []).map((r) => r.diajukan_oleh).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", ids);
        setNames(Object.fromEntries((profs || []).map((p) => [p.id, p])));
      } else {
        setNames({});
      }

      if (prof?.role !== "admin" && prof?.bidang_id) {
        setFilterBidang(prof.bidang_id);
      }
    } catch (err) {
      if (quiet) return; // refresh latar: gagal diam-diam, coba lagi interval berikut
      if (/belum diisi|NEXT_PUBLIC/i.test(err.message || "")) {
        setSupabaseOk(false);
      } else {
        setLoadError(err.message || "Gagal memuat history.");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live update via realtime Supabase + polling fallback.
  useEffect(() => {
    let alive = true;
    async function refreshQuiet() {
      if (!alive) return;
      try {
        const supabase = getClient();
        const { data: rowData, error: rowErr } = await supabase
          .from("pengajuan")
          .select(
            "id, nomor_pengajuan, bidang_id, tahun, tanggal_pengajuan, nama_npd, ptk_id, catatan, status, total_nominal, diajukan_oleh, created_at, updated_at"
          )
          .order("created_at", { ascending: false })
          .limit(1000);
        if (rowErr || !alive) return;
        setRows(rowData || []);
        const sid = selectedIdRef.current;
        if (sid) await openDetail(sid, true);
      } catch {
        // abaikan
      }
    }
    const supabase = getClient();
    const ch = supabase
      .channel("history-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "pengajuan" }, refreshQuiet)
      .on("postgres_changes", { event: "*", schema: "public", table: "revisi_remarks" }, refreshQuiet)
      .on("postgres_changes", { event: "*", schema: "public", table: "status_history" }, refreshQuiet)
      .on("postgres_changes", { event: "*", schema: "public", table: "pengajuan_items" }, refreshQuiet)
      .subscribe();

    // Polling fallback: refresh setiap 5 detik.
    const pollId = setInterval(() => { if (alive) refreshQuiet(); }, 5000);

    return () => {
      alive = false;
      clearInterval(pollId);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filterBidang, filterTahun, filterStatus, filterDari, filterSampai, pageSize]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, "");
    return rows.filter((r) => {
      if (filterBidang !== "semua" && r.bidang_id !== filterBidang) return false;
      if (filterTahun !== "semua" && String(r.tahun) !== filterTahun) return false;
      if (filterStatus !== "semua" && r.status !== filterStatus) return false;
      if (filterDari && r.tanggal_pengajuan < filterDari) return false;
      if (filterSampai && r.tanggal_pengajuan > filterSampai) return false;
      if (!q) return true;
      const hay = [r.nomor_pengajuan, r.nama_npd].join(" ").toLowerCase();
      if (hay.includes(q)) return true;
      // Cari pakai nominal: "500000", "500.000", atau "Rp500.000" semua cocok.
      if (qDigits && String(r.total_nominal ?? "").replace(/[^0-9]/g, "").includes(qDigits)) return true;
      return false;
    });
  }, [rows, search, filterBidang, filterTahun, filterStatus, filterDari, filterSampai]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, filtered.length);

  const years = useMemo(
    () => [...new Set(rows.map((r) => r.tahun))].sort((a, b) => Number(b) - Number(a)),
    [rows]
  );

  const stats = useMemo(() => {
    const total = rows.length;
    const proses = rows.filter((r) =>
      ["DIAJUKAN", "DIPROSES", "REVISI", "SIAP_DICAIRKAN"].includes(r.status)
    ).length;
    const selesai = rows.filter((r) => ["CAIR", "SELESAI"].includes(r.status)).length;
    const ditolak = rows.filter((r) => r.status === "DITOLAK").length;
    return { total, proses, selesai, ditolak };
  }, [rows]);

  function actorName(id) {
    if (!id) return "—";
    const p = names[id];
    if (!p) return "—";
    return p.display_name || (p.email ? p.email.split("@")[0] : "—");
  }

  async function openDetail(id, quiet = false) {
    setSelectedId(id);
    if (!quiet) {
      setDetail(null);
      setDetailError("");
      setDetailLoading(true);
      setBudgetSummary([]);
    }
    try {
      const supabase = getClient();
      const fallbackBase = rowsRef.current.find((r) => r.id === id);
      // Snapshot dokumen (migration_014): beku saat DIAJUKAN pertama.
      // Tahan terhadap DB lama yang belum dimigrasi — gagal diam-diam pakai fallback.
      let base = fallbackBase;
      try {
        const { data: fullBase, error: baseErr } = await supabase
          .from("pengajuan")
          .select(
            "id, nomor_pengajuan, bidang_id, tahun, tanggal_pengajuan, nama_npd, ptk_id, catatan, status, total_nominal, diajukan_oleh, created_at, updated_at, snapshot_pagu, snapshot_realisasi, snapshot_sisa, snapshot_at, snapshot_items"
          )
          .eq("id", id)
          .maybeSingle();
        if (!baseErr && fullBase) base = fullBase;
      } catch {
        // kolom snapshot belum ada — cetak pakai fallback rekonstruksi
      }
      const [itemsRes, histRes, remarkRes, disbRes] = await Promise.all([
        supabase
          .from("pengajuan_items")
          .select(
            "id, nominal, budget_line_id, budget_lines(bidang_id, kode_sub_kegiatan, nama_sub_kegiatan, kode_uraian, nama_uraian, pagu, kode_program, nama_program, kode_kegiatan, nama_kegiatan)"
          )
          .eq("pengajuan_id", id),
        supabase
          .from("status_history")
          .select("id, from_status, to_status, catatan, diubah_oleh, created_at")
          .eq("pengajuan_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("revisi_remarks")
          .select("id, remark, diberikan_oleh, created_at")
          .eq("pengajuan_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("disbursements")
          .select("id, nominal, dicairkan_at, pengajuan_item_id")
          .eq("pengajuan_id", id)
          .order("dicairkan_at", { ascending: true }),
      ]);
      if (itemsRes.error) throw itemsRes.error;
      if (histRes.error) throw histRes.error;
      if (remarkRes.error) throw remarkRes.error;
      if (disbRes.error && disbRes.error.code !== "42501") throw disbRes.error;

      // Fetch budget realisasi untuk summary anggaran.
      // Catatan (REVISI Okt 2026): sengaja diambil SE-SUB KEGIATAN agar
      // Lembar Kendali (fallback tanpa snapshot) tetap menampilkan seluruh
      // uraian se-sub. NpdPrint memfilter sendiri ke uraian NPD ini
      // (lihat matchUraian di components/NpdPrint.jsx), sehingga a/b/c
      // = jumlah uraian yang dipakai NPD (1 NPD 2 uraian -> dijumlahkan).
      const subKodeItems = (itemsRes.data || []).map((it) => it.budget_lines?.kode_sub_kegiatan).filter(Boolean);
      let bSum = [];
      if (subKodeItems.length > 0) {
        const uniqueSub = [...new Set(subKodeItems)];
        const { data: budData } = await supabase
          .from("v_budget_realisasi")
          .select("budget_line_id, kode_sub_kegiatan, nama_sub_kegiatan, kode_uraian, nama_uraian, pagu, realisasi, sisa, diproses")
          .in("kode_sub_kegiatan", uniqueSub)
          .limit(500);
        bSum = budData || [];
      }
      setBudgetSummary(bSum);

      // Nama aktor tambahan (RLS membatasi yang boleh dibaca).
      const actorIds = [
        ...(histRes.data || []).map((h) => h.diubah_oleh),
        ...(remarkRes.data || []).map((r) => r.diberikan_oleh),
      ].filter(Boolean);
      const missing = [...new Set(actorIds)].filter((x) => !namesRef.current[x]);
      let extraNames = {};
      if (missing.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, email, nip")
          .in("id", missing);
        extraNames = Object.fromEntries((profs || []).map((p) => [p.id, p]));
        setNames((n) => ({ ...n, ...extraNames }));
      }

      // Trigger status + RPC sama-sama mencatat history -> gabungkan entri ganda.
      const seen = new Map();
      for (const h of histRes.data || []) {
        const k = `${h.from_status || ""}->${h.to_status}`;
        if (!seen.has(k) || (h.catatan && !seen.get(k).catatan)) {
          seen.set(k, h);
        }
      }
      // PTK penanda tangan cetak NPD (kalau pengajuan menyimpan ptk_id).
      let ptkRow = null;
      if (base?.ptk_id) {
        const { data: ptkData } = await supabase
          .from("ptk")
          .select("id, nama, nip, jabatan")
          .eq("id", base.ptk_id)
          .maybeSingle();
        ptkRow = ptkData || null;
      }

      setDetail({
        base,
        ptk: ptkRow,
        items: itemsRes.data || [],
        history: [...seen.values()],
        remarks: remarkRes.data || [],
        disbursements: disbRes.data || [],
        allNames: { ...namesRef.current, ...extraNames },
      });
    } catch (err) {
      if (quiet) return; // refresh latar gagal diam-diam
      setDetailError(err.message || "Gagal memuat detail.");
    } finally {
      if (!quiet) setDetailLoading(false);
    }
  }

  function toggleDetail(id) {
    if (selectedId === id) {
      closeDetail();
    } else {
      setTab("detail");
      openDetail(id);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setDetailError("");
    setBudgetSummary([]);
    setShowPrint(false);
    setShowKendali(false);
  }

  function openStatusModal(row, to) {
    setActionError("");
    setCatatan("");
    setRemark("");
    setStatusModal({ row, to });
  }

  function openEditModal(row) {
    setActionError("");
    setCatatan("");
    setRemark("");
    setEditTo((TABLE_ACTIONS[row.status] || [])[0] || "");
    setEditModal({ row });
  }

  async function submitStatusChange() {
    if (!statusModal) return;
    const { row, to } = statusModal;
    if (to === "REVISI" && remark.trim().length < 5) {
      setActionError("Remark revisi minimal 5 karakter.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      const supabase = getClient();
      // Sudah REVISI + pilih Revisi lagi = tambah remark saja, status tetap REVISI.
      if (to === "REVISI" && row.status === "REVISI") {
        const { error: remarkErr } = await supabase
          .from("revisi_remarks")
          .insert({ pengajuan_id: row.id, remark: remark.trim() });
        if (remarkErr) throw remarkErr;
        setStatusModal(null);
        setActionMsg({ type: "ok", text: `${row.nomor_pengajuan}: remark revisi ditambahkan (tetap REVISI).` });
        await loadAll();
        await openDetail(row.id);
        return;
      }
      const { error } = await supabase.rpc("ubah_status_pengajuan", {
        p_pengajuan_id: row.id,
        p_to: to,
        p_catatan: catatan.trim() ? catatan.trim() : null,
        p_remark: to === "REVISI" ? remark.trim() : null,
      });
      if (error) throw error;
      setStatusModal(null);
      setActionMsg({ type: "ok", text: `${row.nomor_pengajuan}: ${row.status} → ${to}.` });
      await loadAll();
      await openDetail(row.id);
    } catch (err) {
      setActionError(err.message || "Gagal mengubah status.");
    } finally {
      setActionBusy(false);
    }
  }

  async function submitEditStatus() {
    if (!editModal) return;
    const row = editModal.row;
    if (!editTo) {
      setActionError("Pilih status tujuan terlebih dahulu.");
      return;
    }
    if (editTo === "CAIR") {
      setEditModal(null);
      openStatusModal(row, "CAIR");
      return;
    }
    if (editTo === "REVISI" && remark.trim().length < 5) {
      setActionError("Remark revisi minimal 5 karakter.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      const supabase = getClient();
      if (editTo === "REVISI" && row.status === "REVISI") {
        const { error: remarkErr } = await supabase
          .from("revisi_remarks")
          .insert({ pengajuan_id: row.id, remark: remark.trim() });
        if (remarkErr) throw remarkErr;
        setEditModal(null);
        setActionMsg({ type: "ok", text: `${row.nomor_pengajuan}: remark revisi ditambahkan (tetap REVISI).` });
        await loadAll();
        await openDetail(row.id);
        return;
      }
      const { error } = await supabase.rpc("ubah_status_pengajuan", {
        p_pengajuan_id: row.id,
        p_to: editTo,
        p_catatan: catatan.trim() ? catatan.trim() : null,
        p_remark: editTo === "REVISI" ? remark.trim() : null,
      });
      if (error) throw error;
      setEditModal(null);
      setActionMsg({ type: "ok", text: `${row.nomor_pengajuan}: ${row.status} → ${editTo}.` });
      await loadAll();
      await openDetail(row.id);
    } catch (err) {
      setActionError(err.message || "Gagal mengubah status.");
    } finally {
      setActionBusy(false);
    }
  }

  async function submitCairkan() {
    if (!statusModal) return;
    const { row } = statusModal;
    setActionBusy(true);
    setActionError("");
    try {
      const supabase = getClient();
      // Flow cepat: admin bisa cairkan langsung dari DIPROSES.
      const freshStatus = rows.find((r) => r.id === row.id)?.status || row.status;
      if (freshStatus === "DIPROSES") {
        const { error: siapErr } = await supabase.rpc("ubah_status_pengajuan", {
          p_pengajuan_id: row.id,
          p_to: "SIAP_DICAIRKAN",
          p_catatan: "Otomatis: siap dicairkan (validasi admin selesai)",
        });
        if (siapErr) throw siapErr;
      }
      const key =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `cair-${row.id}-${Date.now()}`;
      const { data, error } = await supabase.rpc("cairkan_pengajuan", {
        p_pengajuan_id: row.id,
        p_idempotency_key: key,
      });
      if (error) throw error;
      setStatusModal(null);
      const idem = data?.idempotent ? " (sudah pernah dicairkan, tidak ganda)" : "";
      setActionMsg({ type: "ok", text: `${row.nomor_pengajuan} SELESAI — cair sebesar ${formatRupiah(data?.total ?? row.total_nominal)}, masuk realisasi${idem}.` });
      await loadAll();
      await openDetail(row.id);
    } catch (err) {
      setActionError(err.message || "Gagal mencairkan.");
    } finally {
      setActionBusy(false);
    }
  }

  if (!supabaseOk) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">History Pengajuan</h1>
        <div className="mt-6 bg-white rounded-2xl border border-amber-200/80 p-6 shadow-clean">
          <h2 className="font-semibold text-amber-900">Database belum terhubung</h2>
          <p className="text-sm text-slate-600 mt-1.5">
            Periksa variabel lingkungan Supabase di konfigurasi Anda.
          </p>
        </div>
      </div>
    );
  }

  const detailBase = detail?.base || rows.find((r) => r.id === selectedId) || null;
  const nameOf = (id) => {
    const p = (detail?.allNames || names)[id];
    if (!p) return "—";
    return p.display_name || (p.email ? p.email.split("@")[0] : "—");
  };

  return (
    <div className="space-y-5 pb-12">
      {/* ---------- HEADER HALAMAN ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs md:text-sm font-semibold text-blue-600 tracking-wide">Monitoring</p>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-slate-900 mt-0.5">
            History Pengajuan
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? "Semua bidang. Klik baris untuk detail + aksi (ubah status, revisi, cairkan)."
              : "Bidang Anda. Klik baris untuk detail dan timeline."}
          </p>
        </div>
        <Link
          href="/npd"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs md:text-sm font-semibold shadow-md shadow-indigo-500/25 hover:shadow-lg hover:from-indigo-700 hover:to-violet-700 transition-all duration-200"
        >
          <Send size={15} /> Buat pengajuan
        </Link>
      </div>

      {actionMsg.text && (
        <p
          role={actionMsg.type === "err" ? "alert" : "status"}
          className={`text-xs md:text-sm rounded-xl px-4 py-3 border flex items-center gap-2 ${
            actionMsg.type === "err"
              ? "text-rose-700 bg-rose-50 border-rose-200"
              : "text-emerald-800 bg-emerald-50 border-emerald-200"
          }`}
        >
          {actionMsg.type === "err" ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{actionMsg.text}</span>
        </p>
      )}

      {/* ---------- KARTU STATISTIK ---------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FileText} tone="blue" label="Total Pengajuan" value={stats.total} caption="Seluruh periode" />
        <StatCard icon={Clock3} tone="amber" label="Dalam Proses" value={stats.proses} caption="Menunggu tindak lanjut" />
        <StatCard icon={CheckCircle2} tone="emerald" label="Selesai" value={stats.selesai} caption="Telah dicairkan" />
        <StatCard icon={XCircle} tone="rose" label="Ditolak" value={stats.ditolak} caption="Tidak disetujui" />
      </div>

      {/* ---------- FILTER BAR ---------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-clean p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor / nama / nominal..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-white text-[13px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </label>

          <IconSelect
            icon={Building2}
            value={filterBidang}
            onChange={(e) => setFilterBidang(e.target.value)}
            disabled={!isAdmin}
            title={isAdmin ? "Filter bidang" : "Terkunci ke bidang Anda"}
            className="w-40"
          >
            {isAdmin && <option value="semua">Semua bidang</option>}
            {bidangList.map((b) => (
              <option key={b.id} value={b.id}>{b.nama}</option>
            ))}
          </IconSelect>

          <IconSelect
            icon={Calendar}
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            title="Filter tahun anggaran"
            className="w-32"
          >
            <option value="semua">Semua tahun</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </IconSelect>

          <IconSelect
            icon={Layers}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            title="Filter status"
            className="w-40"
          >
            <option value="semua">Semua status</option>
            {STATUS_LIST.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </IconSelect>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            aria-expanded={showAdvanced}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-[13px] font-semibold transition-all ${
              showAdvanced
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <ListFilter size={15} /> Filter
          </button>
        </div>

        {showAdvanced && (
          <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">Dari tanggal</span>
              <input
                type="date"
                value={filterDari}
                onChange={(e) => setFilterDari(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-white text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">Sampai tanggal</span>
              <input
                type="date"
                value={filterSampai}
                onChange={(e) => setFilterSampai(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200/90 bg-white text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </label>
          </div>
        )}
      </div>

      {/* ---------- TABEL DAFTAR PENGAJUAN ---------- */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-clean overflow-hidden" aria-label="Daftar pengajuan">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[56rem]">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200/80 bg-slate-50/70">
                <th className="px-4 py-3 font-semibold w-20">No</th>
                <th className="px-4 py-3 font-semibold">Nomor / Tanggal</th>
                <th className="px-4 py-3 font-semibold">NPD</th>
                {isAdmin && <th className="px-4 py-3 font-semibold">Bidang</th>}
                <th className="px-4 py-3 font-semibold">Total (Rp)</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td colSpan={isAdmin ? 7 : 6} className="px-4 py-4">
                      <div className="h-4 rounded-lg bg-slate-100 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-10 text-center">
                    <p className="font-medium text-rose-700">Gagal memuat: {loadError}</p>
                    <button
                      type="button"
                      onClick={loadAll}
                      className="mt-3 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50 transition-all"
                    >
                      Coba lagi
                    </button>
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-12 text-center">
                    <Inbox size={28} className="text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-700 mt-2.5">
                      {rows.length === 0 ? "Belum ada pengajuan" : "Tidak ada yang cocok dengan filter"}
                    </p>
                    <p className="text-[13px] text-slate-500 mt-1">
                      {rows.length === 0 ? "Buat pengajuan pertama dari halaman Pengajuan NPD." : "Ubah kata kunci atau filter."}
                    </p>
                  </td>
                </tr>
              ) : (
                pageRows.map((r, idx) => {
                  const expanded = selectedId === r.id;
                  const transitions = TABLE_ACTIONS[r.status] || [];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => toggleDetail(r.id)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors duration-150 ${
                        expanded ? "bg-blue-50/70" : "hover:bg-slate-50/70"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">
                          {expanded ? (
                            <ChevronDown size={15} className="text-blue-600" />
                          ) : (
                            <span className="w-[15px] text-center text-slate-300 font-normal">-</span>
                          )}
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-semibold text-slate-800">{r.nomor_pengajuan || "—"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{r.tanggal_pengajuan}</p>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-[13px] font-medium text-slate-800 break-words">{r.nama_npd}</p>
                        <p className="text-xs text-slate-400 mt-0.5">oleh {actorName(r.diajukan_oleh)}</p>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-[13px] text-slate-700 whitespace-nowrap">
                          {bidangMap[r.bidang_id]?.nama || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap font-semibold text-slate-900">
                        {formatRupiah(r.total_nominal)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1.5">
                          {isAdmin && (
                            <button
                              type="button"
                              title="Ubah status"
                              aria-label={`Ubah status ${r.nomor_pengajuan || ""}`}
                              onClick={() => openEditModal(r)}
                              disabled={actionBusy}
                              className="p-2 rounded-lg border border-amber-200 bg-amber-50/60 text-amber-600 hover:bg-amber-100 disabled:opacity-40 transition-all"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          {isAdmin && transitions.includes("DRAFT") && (
                            <button
                              type="button"
                              title="Kembalikan ke draft — revisi nominal/sub/uraian"
                              aria-label={`Kembalikan ke draft ${r.nomor_pengajuan || ""}`}
                              onClick={() => openStatusModal(r, "DRAFT")}
                              disabled={actionBusy}
                              className="p-2 rounded-lg border border-emerald-200 bg-emerald-50/60 text-emerald-600 hover:bg-emerald-100 disabled:opacity-40 transition-all"
                            >
                              <RotateCcw size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            title={expanded ? "Tutup detail" : "Lihat detail"}
                            aria-label={`${expanded ? "Tutup" : "Lihat"} detail ${r.nomor_pengajuan || ""}`}
                            onClick={() => toggleDetail(r.id)}
                            className="p-2 rounded-lg border border-emerald-200 bg-emerald-50/60 text-emerald-600 hover:bg-emerald-100 transition-all"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && !loadError && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200/80">
            <div className="flex items-center gap-3">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Baris per halaman"
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-slate-700 outline-none focus:border-blue-500 transition-all"
              >
                {[10, 25, 50].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Menampilkan {rangeStart} - {rangeEnd} dari {filtered.length} pengajuan
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Halaman sebelumnya"
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              {pageNumbers(page, totalPages).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={`min-w-[32px] px-2 py-1.5 rounded-lg border text-[13px] font-semibold transition-all ${
                    n === page
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Halaman berikutnya"
                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition-all"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------- PANEL DETAIL ---------- */}
      {selectedId && (
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-clean overflow-hidden" aria-label="Detail pengajuan">
          {/* Header detail */}
          <div className="flex items-start justify-between gap-3 p-5 pb-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl bg-blue-100/80 text-blue-600 ring-1 ring-inset ring-blue-200/70 flex items-center justify-center shrink-0">
                <FileText size={22} />
              </div>
              <div className="min-w-0 overflow-hidden">
                <h2 className="font-mono font-bold text-sm md:text-base text-slate-900">
                  {detailBase?.nomor_pengajuan}
                </h2>
                <p className="text-[13px] md:text-sm font-medium text-slate-700 mt-0.5 break-words">
                  {detailBase?.nama_npd}
                </p>
                <p className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span>{bidangMap[detailBase?.bidang_id]?.nama || "—"}</span>
                  <span aria-hidden>·</span>
                  <span>{detailBase?.tanggal_pengajuan}</span>
                  <span aria-hidden>·</span>
                  <span>oleh {actorName(detailBase?.diajukan_oleh)}</span>
                  <span aria-hidden>·</span>
                  <StatusPill status={detailBase?.status} />
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {detailBase?.status !== "DRAFT" && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowPrint(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-xs md:text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-all"
                  >
                    <Printer size={14} /> Cetak NPD
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowKendali(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-sky-300 bg-sky-50 text-xs md:text-[13px] font-semibold text-sky-700 hover:bg-sky-100 transition-all"
                  >
                    <ClipboardList size={14} /> Cetak Kendali
                  </button>
                </>
              )}
              {isAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => openEditModal(detailBase)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 text-xs md:text-[13px] font-semibold text-amber-700 hover:bg-amber-100 transition-all"
                  >
                    <Pencil size={14} /> Ubah status
                  </button>
                  <button
                    type="button"
                    onClick={() => openStatusModal(detailBase, "REVISI")}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-300 bg-blue-50 text-xs md:text-[13px] font-semibold text-blue-700 hover:bg-blue-100 transition-all"
                  >
                    <FileEdit size={14} /> Revisi
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={closeDetail}
                aria-label="Tutup detail"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-5 border-b border-slate-200/80 flex gap-5 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-1.5 pb-2.5 pt-1 text-[13px] font-semibold border-b-2 -mb-px whitespace-nowrap transition-all ${
                    active
                      ? "text-blue-600 border-blue-600"
                      : "text-slate-500 border-transparent hover:text-slate-800"
                  }`}
                >
                  <Icon size={14} />
                  {t.key === "uraian" ? `Uraian (${detail?.items.length ?? 0})` : t.label}
                </button>
              );
            })}
          </div>

          {/* Konten tab */}
          <div className="p-5">
            {detailLoading ? (
              <div className="space-y-2.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 rounded bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : detailError ? (
              <p role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
                {detailError}
              </p>
            ) : (
              <>
                {/* TAB: DETAIL */}
                {tab === "detail" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 rounded-xl border border-slate-200/80 overflow-hidden">
                      <div className="grid grid-cols-2 md:grid-cols-4">
                        <Field label="Nomor NPD">{detailBase?.nomor_pengajuan || "—"}</Field>
                        <Field label="Bidang">{bidangMap[detailBase?.bidang_id]?.nama || "—"}</Field>
                        <Field label="Tanggal pengajuan">{detailBase?.tanggal_pengajuan || "—"}</Field>
                        <Field label="Tahun anggaran">{detailBase?.tahun || "—"}</Field>
                        <Field label="Diajukan oleh">{actorName(detailBase?.diajukan_oleh)}</Field>
                        <Field label="PTK (penanda tangan)">
                          {detail.ptk?.nama
                            ? `${detail.ptk.nama}${
                                detail.ptk.nip ? ` · NIP ${detail.ptk.nip}` : ""
                              }`
                            : "—"}
                        </Field>
                        <Field label="Total nominal">{formatRupiah(detailBase?.total_nominal)}</Field>
                        <Field label="Status"><StatusPill status={detailBase?.status} /></Field>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <p className="text-[13px] font-bold text-slate-800">Catatan</p>
                      </div>
                      <p className="text-[13px] text-slate-600 mt-2.5 leading-relaxed break-words">
                        {detailBase?.catatan || "-"}
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB: URAIAN */}
                {tab === "uraian" && (
                  <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                    <table className="w-full text-[13px] min-w-[36rem]">
                      <thead className="bg-slate-50/70">
                        <tr className="text-left text-xs text-slate-500">
                          <th className="px-3.5 py-2.5 font-semibold">Uraian</th>
                          <th className="px-3.5 py-2.5 font-semibold text-right">Nominal (Rp)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.items.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3.5 py-8 text-center text-slate-500">
                              Belum ada uraian.
                            </td>
                          </tr>
                        ) : (
                          detail.items.map((it) => (
                            <tr key={it.id} className="border-t border-slate-100">
                              <td className="px-3.5 py-2.5">
                                <span className="font-mono text-xs text-slate-500">
                                  {it.budget_lines?.kode_uraian}
                                  <span className="text-slate-400"> · {it.budget_lines?.kode_sub_kegiatan}</span>
                                </span>
                                <span className="block mt-0.5 font-medium text-slate-800">
                                  {it.budget_lines?.nama_uraian}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-right tabular-nums whitespace-nowrap font-semibold text-slate-900">
                                {formatRupiah(it.nominal)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-semibold">
                          <td className="px-3.5 py-2.5 text-xs text-slate-500">Total</td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-900">
                            {formatRupiah(detailBase?.total_nominal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* TAB: TIMELINE */}
                {tab === "timeline" && (
                  <div>
                    {detail.history.length === 0 ? (
                      <p className="text-[13px] text-slate-500">Belum ada perpindahan status.</p>
                    ) : (
                      <ol className="space-y-0">
                        {detail.history.map((h, i) => (
                          <li key={h.id || i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-blue-500 shrink-0" />
                              {i < detail.history.length - 1 && <span className="w-px flex-1 bg-slate-200" />}
                            </div>
                            <div className="pb-4">
                              <p className="text-[13px] font-medium text-slate-800">
                                {h.from_status || "—"} → <span className="font-semibold">{h.to_status}</span>
                              </p>
                              {h.catatan && <p className="text-[13px] text-slate-600 mt-0.5">{h.catatan}</p>}
                              <p className="text-xs text-slate-400 mt-0.5">
                                {nameOf(h.diubah_oleh)} · {new Date(h.created_at).toLocaleString("id-ID")}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                {/* TAB: DOKUMEN */}
                {tab === "dokumen" && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <p className="text-[13px] font-bold text-slate-800">Catatan pengaju</p>
                      </div>
                      <p className="text-[13px] text-slate-600 mt-2 leading-relaxed break-words">
                        {detailBase?.catatan || "-"}
                      </p>
                    </div>

                    {detail.remarks.length > 0 && (
                      <div>
                        <p className="text-[13px] font-bold text-slate-800 mb-2">Remark revisi</p>
                        <ul className="space-y-2">
                          {detail.remarks.map((r) => (
                            <li key={r.id} className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3.5 py-2.5">
                              <p className="text-[13px] text-amber-900">{r.remark}</p>
                              <p className="text-xs text-amber-700 mt-1">
                                {nameOf(r.diberikan_oleh)} · {new Date(r.created_at).toLocaleString("id-ID")}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {detail.disbursements.length > 0 && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3.5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                            <Banknote size={16} />
                          </div>
                          <p className="text-[13px] font-bold text-emerald-900">
                            Pencairan: {formatRupiah(detail.disbursements.reduce((a, d) => a + Number(d.nominal || 0), 0))}
                          </p>
                        </div>
                        <p className="text-xs text-emerald-800 mt-1.5">
                          {detail.disbursements.map((d) => new Date(d.dicairkan_at).toLocaleString("id-ID")).join(" · ")}
                        </p>
                      </div>
                    )}

                    {detail.remarks.length === 0 && detail.disbursements.length === 0 && !detailBase?.catatan && (
                      <div className="py-8 text-center">
                        <Inbox size={26} className="text-slate-300 mx-auto" />
                        <p className="text-[13px] text-slate-500 mt-2">Belum ada dokumen tambahan.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {/* ---------- MODAL: UBAH STATUS (GENERIC) ---------- */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Ubah status">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !actionBusy && setEditModal(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-h-[90vh] overflow-auto">
            <h2 className="font-bold text-slate-900">Ubah status pengajuan</h2>
            <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
              <p className="font-mono text-xs font-semibold text-slate-700">{editModal.row.nomor_pengajuan}</p>
              <p className="text-[13px] font-medium text-slate-800 mt-0.5 break-words" style={{ overflowWrap: "anywhere" }}>{editModal.row.nama_npd}</p>
            </div>
            {(TABLE_ACTIONS[editModal.row.status] || []).length === 0 ? (
              <p className="mt-4 text-[13px] text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                Status <span className="font-semibold">{editModal.row.status}</span> tidak memiliki transisi lanjutan.
              </p>
            ) : (
              <>
                <label className="block text-[13px] font-medium mt-4">
                  Status tujuan
                  <select
                    value={editTo}
                    onChange={(e) => setEditTo(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-normal outline-none focus:border-indigo-500 bg-white"
                  >
                    {(TABLE_ACTIONS[editModal.row.status] || []).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
                {editTo === "REVISI" && (
                  <label className="block text-[13px] font-medium mt-3">
                    Remark revisi (wajib, min. 5 karakter)
                    <textarea
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      rows={3}
                      required
                      placeholder="Jelaskan apa yang harus diperbaiki pengaju…"
                      className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-normal outline-none focus:border-indigo-500"
                    />
                  </label>
                )}
                <label className="block text-[13px] font-medium mt-3">
                  Catatan (opsional)
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows={2}
                    placeholder="Tercatat di timeline…"
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-normal outline-none focus:border-indigo-500"
                  />
                </label>
              </>
            )}
            {actionError && (
              <p role="alert" className="mt-3 text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                disabled={actionBusy}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              {(TABLE_ACTIONS[editModal.row.status] || []).length > 0 && (
                <button
                  type="button"
                  onClick={submitEditStatus}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60"
                >
                  {actionBusy && <Loader2 size={15} className="animate-spin" />}
                  {actionBusy ? "Memproses…" : "Simpan"}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-3 flex items-start gap-1">
              <CircleAlert size={13} className="mt-0.5 shrink-0" />
              Transisi yang tidak diizinkan skema (mis. CAIR → DRAFT) akan ditolak database.
            </p>
          </div>
        </div>
      )}

      {/* ---------- MODAL: REVISI / DRAFT / CAIRKAN ---------- */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Konfirmasi aksi">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !actionBusy && setStatusModal(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-h-[90vh] overflow-auto">
            {statusModal.to === "CAIR" ? (
              <>
                <h2 className="font-bold text-slate-900">Apakah kamu yakin sudah sesuai?</h2>
                <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
                  <p className="font-mono text-xs font-semibold text-slate-700">{statusModal.row.nomor_pengajuan}</p>
                  <p className="text-[13px] font-medium text-slate-800 mt-0.5 break-words" style={{ overflowWrap: "anywhere" }}>{statusModal.row.nama_npd}</p>
                  <p className="text-[13px] font-semibold text-slate-900 mt-1">{formatRupiah(statusModal.row.total_nominal)}</p>
                </div>
                <p className="text-[13px] text-slate-600 mt-2.5">
                  Jika <span className="font-semibold">Yes</span>, dana langsung masuk ke realisasi dan status otomatis <span className="font-semibold">SELESAI</span>.
                </p>
              </>
            ) : statusModal.to === "REVISI" ? (
              <>
                <h2 className="font-bold text-slate-900">
                  {statusModal.row.status === "REVISI" ? "Tambah remark revisi?" : "Revisi pengajuan ini?"}
                </h2>
                <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
                  <p className="font-mono text-xs font-semibold text-slate-700">{statusModal.row.nomor_pengajuan}</p>
                  <p className="text-[13px] font-medium text-slate-800 mt-0.5 break-words" style={{ overflowWrap: "anywhere" }}>{statusModal.row.nama_npd}</p>
                </div>
                <p className="text-[13px] text-slate-600 mt-2.5">
                  {statusModal.row.status === "REVISI"
                    ? "Remark baru ditambahkan, status tetap REVISI."
                    : "Tulis remark revisi, otomatis tercatat dan tampil ke pengaju."}
                </p>
                <label className="block text-[13px] font-medium mt-4">
                  Remark revisi (wajib, min. 5 karakter)
                  <textarea
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    rows={3}
                    required
                    placeholder="Jelaskan apa yang harus diperbaiki pengaju…"
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-normal outline-none focus:border-indigo-500"
                  />
                </label>
              </>
            ) : statusModal.to === "DRAFT" ? (
              <>
                <h2 className="font-bold text-slate-900">Kembalikan ke draft?</h2>
                <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
                  <p className="font-mono text-xs font-semibold text-slate-700">{statusModal.row.nomor_pengajuan}</p>
                  <p className="text-[13px] font-medium text-slate-800 mt-0.5 break-words" style={{ overflowWrap: "anywhere" }}>{statusModal.row.nama_npd}</p>
                </div>
                <p className="text-[13px] text-slate-600 mt-2.5">
                  NPD dikembalikan ke draft agar pengaju bisa mengganti nominal, sub kegiatan, ataupun uraian. Remark revisi tetap tersimpan.
                </p>
                <label className="block text-[13px] font-medium mt-4">
                  Catatan (opsional)
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows={2}
                    placeholder="Tercatat di timeline…"
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-normal outline-none focus:border-indigo-500"
                  />
                </label>
              </>
            ) : (
              <>
                <h2 className="font-bold text-slate-900">Ubah status ke {statusModal.to}?</h2>
                <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-2.5">
                  <p className="font-mono text-xs font-semibold text-slate-700">{statusModal.row.nomor_pengajuan}</p>
                  <p className="text-[13px] font-medium text-slate-800 mt-0.5 break-words" style={{ overflowWrap: "anywhere" }}>{statusModal.row.nama_npd}</p>
                </div>
                <label className="block text-[13px] font-medium mt-4">
                  Catatan (opsional)
                  <textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    rows={2}
                    placeholder="Tercatat di timeline…"
                    className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-normal outline-none focus:border-indigo-500"
                  />
                </label>
              </>
            )}
            {actionError && (
              <p role="alert" className="mt-3 text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                disabled={actionBusy}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                {statusModal.to === "CAIR" ? "No" : "Batal"}
              </button>
              <button
                type="button"
                onClick={statusModal.to === "CAIR" ? submitCairkan : submitStatusChange}
                disabled={actionBusy}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 ${
                  statusModal.to === "CAIR" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {actionBusy && <Loader2 size={15} className="animate-spin" />}
                {actionBusy ? "Memproses…" : statusModal.to === "CAIR" ? "Yes, cairkan" : statusModal.to === "REVISI" ? "Kirim remark" : `Ya, ke ${statusModal.to}`}
              </button>
            </div>
            {statusModal.to !== "CAIR" && (
              <p className="text-xs text-slate-500 mt-3 flex items-start gap-1">
                <CircleAlert size={13} className="mt-0.5 shrink-0" />
                Transisi yang tidak diizinkan skema (mis. CAIR → DRAFT) akan ditolak database.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------- MODAL: CETAK NPD ---------- */}
      {showPrint &&
        detail &&
        createPortal(
          <div className="npd-print-root fixed inset-0 z-50 flex items-start justify-center overflow-auto" role="dialog" aria-modal="true" aria-label="Cetak NPD">
          <div className="npd-backdrop absolute inset-0 bg-slate-900/40 backdrop-blur-sm print:hidden" onClick={() => setShowPrint(false)} />
          <div className="relative w-full max-w-4xl bg-white shadow-2xl print:shadow-none print:border-none border border-slate-200 my-8 print:m-0 print:w-full print:max-w-none print:rounded-none">
            {/* Toolbar cetak - tidak ditampilkan saat print */}
            <div className="npd-toolbar sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-100/80 text-emerald-600 flex items-center justify-center">
                  <Printer size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Cetak NPD</p>
                  <p className="text-xs text-slate-500">{detail.base?.nomor_pengajuan}</p>
                </div>
              </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all"
                >
                  <Printer size={15} /> Cetak
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrint(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all print:hidden"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Konten NPD untuk cetak */}
            <NpdPrint
              pengajuan={detail.base}
              items={detail.items}
              bidang={bidangMap[detail.base?.bidang_id]}
              pengaju={detail.allNames?.[detail.base?.diajukan_oleh]}
              ptk={detail.ptk}
              budgetSummary={budgetSummary}
              disbursements={detail.disbursements || []}
            />
          </div>
        </div>,
          document.body
        )}

      {/* ---------- MODAL: CETAK LEMBAR KENDALI ---------- */}
      {showKendali &&
        detail &&
        createPortal(
          <div className="npd-print-root fixed inset-0 z-50 flex items-start justify-center overflow-auto" role="dialog" aria-modal="true" aria-label="Cetak Lembar Kendali">
          <div className="npd-backdrop absolute inset-0 bg-slate-900/40 backdrop-blur-sm print:hidden" onClick={() => setShowKendali(false)} />
          <div className="relative w-full max-w-4xl bg-white shadow-2xl print:shadow-none print:border-none border border-slate-200 my-8 print:m-0 print:w-full print:max-w-none print:rounded-none">
            {/* Toolbar cetak - tidak ditampilkan saat print */}
            <div className="npd-toolbar sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-sky-100/80 text-sky-600 flex items-center justify-center">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Cetak Lembar Kendali</p>
                  <p className="text-xs text-slate-500">{detail.base?.nomor_pengajuan}</p>
                </div>
              </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-all"
                >
                  <Printer size={15} /> Cetak
                </button>
                <button
                  type="button"
                  onClick={() => setShowKendali(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all print:hidden"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Konten lembar kendali untuk cetak */}
            <KendaliPrint
              pengajuan={detail.base}
              items={detail.items}
              pengaju={detail.allNames?.[detail.base?.diajukan_oleh]}
              ptk={detail.ptk}
              budgetSummary={budgetSummary}
              history={detail.history}
              disbursements={detail.disbursements || []}
            />
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}