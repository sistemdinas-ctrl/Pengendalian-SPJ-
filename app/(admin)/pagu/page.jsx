"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Plus,
  Upload,
  Download,
  Search,
  Pencil,
  Trash2,
  X,
  FileSpreadsheet,
  CircleAlert,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
  Building2,
  Calendar,
  Filter,
  Layers,
  FileText,
  Wallet,
  Clock,
  MoreHorizontal,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { budgetLineSchema } from "@/lib/validation";
import { formatRupiah } from "@/lib/domain";

/* ──────────────────────────────
   Decorative Card Graphics
   ────────────────────────────── */
function CardMiniBarsBlue() {
  return (
    <div className="absolute bottom-3 right-4 flex items-end gap-1 pointer-events-none select-none">
      <div className="w-1.5 h-3 bg-blue-200/80 rounded-full" />
      <div className="w-1.5 h-5 bg-blue-300/80 rounded-full" />
      <div className="w-1.5 h-4 bg-blue-200/80 rounded-full" />
      <div className="w-1.5 h-6.5 bg-blue-300/90 rounded-full" />
      <div className="w-1.5 h-8 bg-blue-400/80 rounded-full" />
    </div>
  );
}

function CardWaveMint() {
  return (
    <div className="absolute bottom-0 right-0 w-32 h-14 pointer-events-none overflow-hidden select-none">
      <svg viewBox="0 0 120 50" fill="none" className="w-full h-full">
        <path
          d="M0 45 C30 35, 60 48, 85 30 C105 15, 115 25, 130 18 L130 50 L0 50 Z"
          fill="#a7f3d0"
          fillOpacity="0.45"
        />
        <path
          d="M10 50 C40 38, 75 42, 95 24 C110 10, 120 20, 130 12 L130 50 Z"
          fill="#6ee7b7"
          fillOpacity="0.35"
        />
      </svg>
    </div>
  );
}

function CardWaveAmber() {
  return (
    <div className="absolute bottom-0 right-0 w-32 h-14 pointer-events-none overflow-hidden select-none">
      <svg viewBox="0 0 120 50" fill="none" className="w-full h-full">
        <path
          d="M0 46 C32 38, 62 48, 88 30 C108 16, 118 24, 130 18 L130 50 L0 50 Z"
          fill="#fed7aa"
          fillOpacity="0.55"
        />
        <path
          d="M15 50 C45 40, 80 44, 100 22 C115 10, 122 18, 130 12 L130 50 Z"
          fill="#fdba74"
          fillOpacity="0.4"
        />
      </svg>
    </div>
  );
}

function CardWavePurple() {
  return (
    <div className="absolute bottom-0 right-0 w-32 h-14 pointer-events-none overflow-hidden select-none">
      <svg viewBox="0 0 120 50" fill="none" className="w-full h-full">
        <path
          d="M0 48 C35 40, 65 45, 90 28 C110 14, 120 22, 130 15 L130 50 L0 50 Z"
          fill="#ddd6fe"
          fillOpacity="0.5"
        />
        <path
          d="M15 50 C45 42, 80 40, 100 20 C115 8, 125 18, 130 10 L130 50 Z"
          fill="#c4b5fd"
          fillOpacity="0.35"
        />
      </svg>
    </div>
  );
}

// Header kolom yang dikenali saat import (huruf kecil, tanpa spasi berlebih).
const HEADER_ALIAS = {
  bidang: ["bidang"],
  tahun: ["tahun", "tahun anggaran"],
  kodeProgram: ["kode program"],
  namaProgram: ["nama program", "program"],
  kodeKegiatan: ["kode kegiatan"],
  namaKegiatan: ["nama kegiatan", "kegiatan"],
  kodeSub: ["kode sub kegiatan"],
  namaSub: ["nama sub kegiatan"],
  kodeUraian: ["kode uraian"],
  namaUraian: ["nama uraian"],
  pagu: ["pagu", "pagu (rp)", "pagu rp", "pagu (rupiah)", "anggaran", "anggaran (rp)"],
  angkasS1: ["angkas semester 1", "angkas s1", "angkas jan-jun", "angkas jan–jun", "s1", "semester 1"],
  angkasS2: ["angkas semester 2", "angkas s2", "angkas jul-des", "angkas jul–des", "s2", "semester 2"],
};
const REQUIRED_KEYS = ["bidang", "kodeSub", "namaSub", "kodeUraian", "namaUraian", "pagu"];

// "2.960.400" / "Rp 2.960.400,50" / 2960400 -> 2960400(.5). null bila tak terbaca.
function parsePagu(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value ?? "").trim();
  if (!s) return null;
  const cleaned = s.replace(/rp\.?/gi, "").replace(/\s/g, "");
  if (!/[0-9]/.test(cleaned)) return null;
  // Format Indonesia: titik = ribuan, koma = desimal.
  const normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function normHeader(cell) {
  return String(cell ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function cellText(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    return String(v);
  }
  const s = String(v).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) {
    const parts = s.split("/");
    return parts.join(".");
  }
  return s;
}

function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EMPTY_FORM = {
  bidang_id: "",
  tahun: 2026,
  kode_program: "",
  nama_program: "",
  kode_kegiatan: "",
  nama_kegiatan: "",
  kode_sub_kegiatan: "",
  nama_sub_kegiatan: "",
  kode_uraian: "",
  nama_uraian: "",
  pagu: "",
  angkas_s1: "",
  angkas_s2: "",
};

export default function PaguPage() {
  const [supabaseOk, setSupabaseOk] = useState(true);
  const [profile, setProfile] = useState(null);
  const [bidangList, setBidangList] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [filterBidang, setFilterBidang] = useState("semua");
  const [filterTahun, setFilterTahun] = useState("semua");
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState("");

  const [importPreview, setImportPreview] = useState(null); // {fileName, rows:[{n,data,errors}], fileError}
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState("");
  const fileRef = useRef(null);

  const isAdmin = profile?.role === "admin";
  const bidangMap = useMemo(
    () => Object.fromEntries(bidangList.map((b) => [b.id, b])),
    [bidangList]
  );

  function getClient() {
    return createBrowserClient();
  }

  async function loadAll() {
    setLoading(true);
    setLoadError("");
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

      // User dikunci ke bidangnya; admin bebas (view sudah tunduk RLS via security_invoker).
      const { data: rowData, error: rowErr } = await supabase
        .from("v_budget_realisasi")
        .select("*")
        .order("kode_sub_kegiatan")
        .order("kode_uraian")
        .limit(5000);
      if (rowErr) throw rowErr;
      setRows(rowData || []);

      if (prof?.role !== "admin" && prof?.bidang_id) {
        setFilterBidang(prof.bidang_id);
      }
    } catch (err) {
      if (/belum diisi|NEXT_PUBLIC/i.test(err.message || "")) {
        setSupabaseOk(false);
      } else {
        setLoadError(err.message || "Gagal memuat data pagu.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, filterBidang, filterTahun]);

  const tahunOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.tahun));
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, "");
    return rows.filter((r) => {
      if (filterBidang !== "semua" && r.bidang_id !== filterBidang) return false;
      if (filterTahun !== "semua" && String(r.tahun) !== String(filterTahun)) return false;
      if (!q) return true;
      const b = bidangMap[r.bidang_id];
      const hay = [
        r.kode_sub_kegiatan, r.nama_sub_kegiatan,
        r.kode_uraian, r.nama_uraian,
        b?.nama || "", b?.kode || "",
      ].join(" ").toLowerCase();
      if (hay.includes(q)) return true;
      // Cari pakai nominal: "2960400", "2.960.400", atau "Rp2.960.400" semua cocok.
      if (
        qDigits &&
        [r.pagu, r.realisasi, r.sisa].some((n) =>
          String(n ?? "").replace(/[^0-9]/g, "").includes(qDigits)
        )
      )
        return true;
      return false;
    });
  }, [rows, search, filterBidang, filterTahun, bidangMap]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        pagu: acc.pagu + Number(r.pagu || 0),
        angkas_s1: acc.angkas_s1 + Number(r.angkas_s1 || 0),
        angkas_s2: acc.angkas_s2 + Number(r.angkas_s2 || 0),
        realisasi: acc.realisasi + Number(r.realisasi || 0),
        diproses: acc.diproses + Number(r.diproses || 0),
        sisa: acc.sisa + Number(r.sisa || 0),
      }),
      { pagu: 0, angkas_s1: 0, angkas_s2: 0, realisasi: 0, diproses: 0, sisa: 0 }
    );
  }, [filtered]);

  // Kelompokkan baris uraian per sub kegiatan (satu grup = satu bidang + tahun + kode sub).
  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of filtered) {
      const key = [r.bidang_id, r.tahun, r.kode_sub_kegiatan].join("||");
      if (!map.has(key)) {
        map.set(key, {
          key,
          bidang_id: r.bidang_id,
          tahun: r.tahun,
          kode_program: r.kode_program || "",
          nama_program: r.nama_program || "",
          kode_kegiatan: r.kode_kegiatan || "",
          nama_kegiatan: r.nama_kegiatan || "",
          kode_sub_kegiatan: r.kode_sub_kegiatan,
          nama_sub_kegiatan: r.nama_sub_kegiatan,
          rows: [],
          pagu: 0,
          angkas_s1: 0,
          angkas_s2: 0,
          realisasi: 0,
          diproses: 0,
          sisa: 0,
        });
      }
      const g = map.get(key);
      g.rows.push(r);
      g.pagu += Number(r.pagu || 0);
      g.angkas_s1 += Number(r.angkas_s1 || 0);
      g.angkas_s2 += Number(r.angkas_s2 || 0);
      g.realisasi += Number(r.realisasi || 0);
      g.diproses += Number(r.diproses || 0);
      g.sisa += Number(r.sisa || 0);
    }
    const list = [...map.values()];
    for (const g of list) {
      g.rows.sort((a, b) => String(a.kode_uraian).localeCompare(String(b.kode_uraian)));
      g.persen = g.pagu > 0 ? (g.realisasi / g.pagu) * 100 : 0;
    }
    list.sort((a, b) =>
      String(a.kode_sub_kegiatan).localeCompare(String(b.kode_sub_kegiatan)) ||
      String(a.tahun - b.tahun)
    );
    return list;
  }, [filtered]);

  const [pageSize, setPageSize] = useState(10);
  const totalPages = Math.max(1, Math.ceil(grouped.length / pageSize));
  const pageGroups = grouped.slice((page - 1) * pageSize, page * pageSize);

  // Grup yang dilipat (collapsed). Default semua terbuka.
  const [collapsed, setCollapsed] = useState({});
  const searching = search.trim() !== "";
  function toggleGroup(key) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function openAdd() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      bidang_id:
        profile?.role === "admin" ? filterBidang !== "semua" ? filterBidang : "" : profile?.bidang_id || "",
    });
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditingId(row.budget_line_id);
    setForm({
      bidang_id: row.bidang_id,
      tahun: row.tahun,
      kode_program: row.kode_program || "",
      nama_program: row.nama_program || "",
      kode_kegiatan: row.kode_kegiatan || "",
      nama_kegiatan: row.nama_kegiatan || "",
      kode_sub_kegiatan: row.kode_sub_kegiatan,
      nama_sub_kegiatan: row.nama_sub_kegiatan,
      kode_uraian: row.kode_uraian,
      nama_uraian: row.nama_uraian,
      pagu: String(row.pagu),
      angkas_s1: String(row.angkas_s1 ?? 0),
      angkas_s2: String(row.angkas_s2 ?? 0),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    const parsed = budgetLineSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || "Form belum valid.");
      return;
    }
    setSaving(true);
    try {
      const supabase = getClient();
      const payload = { ...parsed.data };
      if (editingId) {
        const { error } = await supabase
          .from("budget_lines")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("budget_lines")
          .insert({ ...payload, created_by: profile?.id || null });
        if (error) throw error;
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      if (err.code === "23505") {
        setFormError("Kombinasi bidang + kode sub kegiatan + kode uraian + tahun ini sudah ada.");
      } else {
        setFormError(err.message || "Gagal menyimpan.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    setActionError("");
    try {
      const supabase = getClient();
      const { error } = await supabase
        .from("budget_lines")
        .delete()
        .eq("id", confirmDelete.budget_line_id);
      if (error) throw error;
      setConfirmDelete(null);
      await loadAll();
    } catch (err) {
      if (err.code === "23503") {
        setActionError("Baris ini tidak bisa dihapus karena sudah dipakai pengajuan NPD.");
      } else {
        setActionError(err.message || "Gagal menghapus.");
      }
    } finally {
      setDeleting(false);
    }
  }

  // ---------- IMPORT ----------
  function resolveBidang(input) {
    const s = String(input ?? "").trim();
    if (!s) return null;
    const upper = s.toUpperCase();
    const lower = s.toLowerCase();
    return (
      bidangList.find((b) => b.kode.toUpperCase() === upper) ||
      bidangList.find((b) => b.nama.toLowerCase() === lower) ||
      null
    );
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportResult("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) throw new Error("File tidak berisi sheet.");
      const matrix = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
        raw: false,
        cellDates: false,
      });
      const headerIdx = matrix.findIndex((row) =>
        row.some((c) => String(c ?? "").trim() !== "")
      );
      if (headerIdx === -1) throw new Error("File kosong.");
      const headers = matrix[headerIdx].map(normHeader);
      const colIdx = {};
      for (const [key, aliases] of Object.entries(HEADER_ALIAS)) {
        colIdx[key] = headers.findIndex((h) => aliases.includes(h));
      }
      const missing = REQUIRED_KEYS.filter((k) => colIdx[k] === -1);
      if (missing.length > 0) {
        setImportPreview({
          fileName: file.name,
          rows: [],
          fileError:
            `Header tidak lengkap. Kolom wajib: Bidang | Kode Sub Kegiatan | Nama Sub Kegiatan | ` +
            `Kode Uraian | Nama Uraian | Pagu (kolom Tahun, Kode/Nama Program, Kode/Nama Kegiatan ` +
            `opsional — default 2026 & kosong). Unduh contoh di tombol "Contoh file".`,
        });
        return;
      }
      const parsedRows = [];
      for (let i = headerIdx + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (row.every((c) => String(c ?? "").trim() === "")) continue;
        const n = i + 1; // nomor baris di file (1-based)
        const cell = (k) => (colIdx[k] === -1 ? "" : row[colIdx[k]]);
        const bidang = resolveBidang(cell("bidang"));
        const tahunRaw = String(cell("tahun") ?? "").trim();
        const tahun = tahunRaw === "" ? 2026 : Number(String(tahunRaw).replace(/\D/g, ""));
        const pagu = parsePagu(cell("pagu"));
        // Angkas opsional: kosong = 0 (belum diatur = hanya batas pagu).
        const a1raw = colIdx.angkasS1 === -1 ? "" : String(cell("angkasS1") ?? "").trim();
        const a2raw = colIdx.angkasS2 === -1 ? "" : String(cell("angkasS2") ?? "").trim();
        const angkas_s1 = a1raw === "" ? 0 : parsePagu(cell("angkasS1"));
        const angkas_s2 = a2raw === "" ? 0 : parsePagu(cell("angkasS2"));
        const candidate = {
          bidang_id: bidang ? bidang.id : "",
          tahun,
          kode_program: cellText(cell("kodeProgram")),
          nama_program: cellText(cell("namaProgram")),
          kode_kegiatan: cellText(cell("kodeKegiatan")),
          nama_kegiatan: cellText(cell("namaKegiatan")),
          kode_sub_kegiatan: cellText(cell("kodeSub")),
          nama_sub_kegiatan: cellText(cell("namaSub")),
          kode_uraian: cellText(cell("kodeUraian")),
          nama_uraian: cellText(cell("namaUraian")),
          pagu: pagu ?? "",
          angkas_s1: angkas_s1 ?? "",
          angkas_s2: angkas_s2 ?? "",
        };
        const errors = [];
        if (!bidang) errors.push(`Bidang "${String(cell("bidang")).trim()}" tidak dikenal (gunakan nama/kode bidang).`);
        if (!Number.isInteger(tahun) || tahun < 2020 || tahun > 2100)
          errors.push("Tahun tidak valid (2020–2100).");
        const z = budgetLineSchema.safeParse(candidate);
        if (!z.success) {
          for (const issue of z.error.issues) {
            if (issue.path[0] === "bidang_id" && !bidang) continue; // sudah dilaporkan di atas
            errors.push(issue.message);
          }
        }
        if (pagu === null || !(pagu >= 0)) errors.push("Pagu tidak terbaca (contoh valid: 2960400).");
        if (angkas_s1 === null || !(angkas_s1 >= 0)) errors.push("Angkas Semester 1 tidak terbaca.");
        if (angkas_s2 === null || !(angkas_s2 >= 0)) errors.push("Angkas Semester 2 tidak terbaca.");
        if (
          angkas_s1 !== null && angkas_s2 !== null && pagu !== null &&
          angkas_s1 + angkas_s2 > pagu
        )
          errors.push(`Total Angkas S1+S2 (${angkas_s1 + angkas_s2}) melebihi Pagu (${pagu}).`);
        parsedRows.push({
          n,
          bidangLabel: bidang ? bidang.nama : String(cell("bidang")).trim() || "—",
          candidate: { ...candidate, pagu: pagu ?? 0 },
          errors,
        });
      }
      // Tandai duplikat dalam file (kunci unik sama) agar user tahu baris
      // terakhir yang akan dipakai — tidak memblokir, hanya peringatan.
      const keyCount = new Map();
      for (const r of parsedRows) {
        if (r.errors.length > 0) continue;
        const c = r.candidate;
        const key = [
          c.bidang_id,
          String(c.kode_sub_kegiatan || "").trim(),
          String(c.kode_uraian || "").trim(),
          String(c.tahun),
        ].join("||");
        keyCount.set(key, (keyCount.get(key) || 0) + 1);
      }
      const dupKeys = [...keyCount.values()].filter((n) => n > 1).length;
      const dupRows = [...keyCount.values()].reduce((a, n) => a + (n > 1 ? n - 1 : 0), 0);
      for (const r of parsedRows) {
        if (r.errors.length > 0) continue;
        const c = r.candidate;
        const key = [
          c.bidang_id,
          String(c.kode_sub_kegiatan || "").trim(),
          String(c.kode_uraian || "").trim(),
          String(c.tahun),
        ].join("||");
        if ((keyCount.get(key) || 0) > 1) r.duplicate = true;
      }
      setImportPreview({
        fileName: file.name,
        rows: parsedRows,
        fileError: parsedRows.length === 0 ? "Tidak ada baris data di file." : "",
        dupRows,
        dupKeys,
      });
    } catch (err) {
      setImportPreview({ fileName: file.name, rows: [], fileError: err.message || "Gagal membaca file." });
    }
  }

  async function executeImport() {
    const valid = (importPreview?.rows || []).filter((r) => r.errors.length === 0);
    if (valid.length === 0) return;
    setImporting(true);
    setImportResult("");
    try {
      const supabase = getClient();
      // Postgres menolak upsert bila SATU statement memuat 2 baris dengan kunci
      // konflik yang sama: "ON CONFLICT DO UPDATE command cannot affect row
      // a second time". Jadi dedupe dulu per kunci unik
      // (bidang_id, kode_sub_kegiatan, kode_uraian, tahun) — baris terakhir menang.
      const seen = new Map();
      let dupCount = 0;
      for (const r of valid) {
        const c = r.candidate;
        const key = [
          c.bidang_id,
          String(c.kode_sub_kegiatan || "").trim(),
          String(c.kode_uraian || "").trim(),
          String(c.tahun),
        ].join("||");
        if (seen.has(key)) dupCount += 1;
        seen.set(key, { ...r.candidate, created_by: profile?.id || null });
      }
      const payload = [...seen.values()];
      const CHUNK = 200;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const { error } = await supabase
          .from("budget_lines")
          .upsert(payload.slice(i, i + CHUNK), {
            onConflict: "bidang_id,kode_sub_kegiatan,kode_uraian,tahun",
          });
        if (error) throw error;
      }
      setImportResult(
        `Import selesai: ${payload.length} baris masuk (baru ditambah / yang sudah ada diperbarui).` +
          (dupCount > 0 ? ` ${dupCount} baris duplikat di file digabung (diambil data terakhir).` : "")
      );
      setImportPreview(null);
      await loadAll();
    } catch (err) {
      setImportResult(`Import gagal: ${err.message || "kesalahan tidak diketahui."}`);
    } finally {
      setImporting(false);
    }
  }

  function handleExport() {
    const header = [
      "Bidang", "Tahun",
      "Kode Program", "Nama Program", "Kode Kegiatan", "Nama Kegiatan",
      "Kode Sub Kegiatan", "Nama Sub Kegiatan", "Kode Uraian", "Nama Uraian",
      "Pagu", "Angkas Semester 1", "Angkas Semester 2", "Realisasi", "Sisa", "Persen",
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const r of filtered) {
      lines.push([
        bidangMap[r.bidang_id]?.nama || "", r.tahun,
        r.kode_program || "", r.nama_program || "",
        r.kode_kegiatan || "", r.nama_kegiatan || "",
        r.kode_sub_kegiatan, r.nama_sub_kegiatan,
        r.kode_uraian, r.nama_uraian,
        r.pagu, r.angkas_s1 ?? 0, r.angkas_s2 ?? 0, r.realisasi, r.sisa, r.persen_realisasi,
      ].map(csvCell).join(","));
    }
    downloadTextFile(`pagu-${filterTahun === "semua" ? "semua-tahun" : filterTahun}.csv`, "﻿" + lines.join("\n"));
  }

  if (!supabaseOk) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Input Pagu</h1>
        <div className="mt-6 glass-strong rounded-2xl border border-amber-200/60 p-6 shadow-card">
          <h2 className="font-semibold text-amber-900">Database belum terhubung</h2>
          <p className="text-sm text-slate-600 mt-1.5">
            Isi <code className="font-mono text-[13px] bg-slate-100/50 px-1.5 py-0.5 rounded">.env.local</code> lalu restart{" "}
            <code className="font-mono text-[13px] bg-slate-100/50 px-1.5 py-0.5 rounded">npm run dev</code>. Panduan:{" "}
            <code className="font-mono text-[13px] bg-slate-100/50 px-1.5 py-0.5 rounded">supabase/README.md</code>.
          </p>
        </div>
      </div>
    );
  }

  const validImportCount = (importPreview?.rows || []).filter((r) => r.errors.length === 0).length;

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600">Kelola Anggaran</p>
          <h1 className="text-2xl lg:text-[26px] font-bold tracking-tight text-slate-900 mt-0.5">
            Input Pagu
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-400 mt-1">
            {isAdmin
              ? "Hanya admin yang bisa tambah/ubah/hapus/import data pagu anggaran."
              : "Mode baca — Anda melihat pagu bidang sendiri. Perubahan oleh admin."}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/contoh-import-pagu.csv"
              download
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <FileSpreadsheet size={15} className="text-slate-500" />
              Contoh file
            </a>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Upload size={15} className="text-slate-500" />
              Import Excel/CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFile}
            />
            <button
              type="button"
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
            >
              <Download size={15} className="text-slate-500" />
              Export
            </button>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white text-xs font-semibold shadow-xs transition-all"
            >
              <Plus size={15} />
              Tambah
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <p role="alert" className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
          {actionError}
        </p>
      )}
      {importResult && (
        <p role="status" className="text-[13px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
          {importResult}
        </p>
      )}

      {/* Preview import */}
      {importPreview && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-5" aria-label="Pratinjau import">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-[15px] text-slate-900">
              Pratinjau: {importPreview.fileName}
            </h2>
            <button
              type="button"
              onClick={() => setImportPreview(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-all duration-200"
              aria-label="Tutup pratinjau"
            >
              <X size={17} />
            </button>
          </div>
          {importPreview.fileError ? (
            <p role="alert" className="mt-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
              {importPreview.fileError}
            </p>
          ) : (
            <>
              <p className="text-[13px] text-slate-500 mt-1.5">
                {validImportCount} dari {importPreview.rows.length} baris valid dan siap masuk.
                Baris yang sudah ada (kombinasi sama) akan diperbarui, bukan diduplikat.
              </p>
              {importPreview.dupRows > 0 && (
                <p role="status" className="mt-2 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                  Ditemukan {importPreview.dupRows} baris duplikat dalam file
                  ({importPreview.dupKeys} kombinasi bidang + kode sub + kode uraian + tahun muncul lebih dari sekali).
                  Saat import, data terakhir untuk tiap kombinasi yang dipakai — tidak error.
                </p>
              )}
              <div className="mt-3 max-h-72 overflow-auto border border-slate-100 rounded-xl">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="text-left text-xs text-slate-500">
                      <th className="px-3 py-2 font-medium">Baris</th>
                      <th className="px-3 py-2 font-medium">Bidang</th>
                      <th className="px-3 py-2 font-medium">Uraian</th>
                      <th className="px-3 py-2 font-medium text-right">Pagu</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.map((r) => (
                      <tr key={r.n} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-500">{r.n}</td>
                        <td className="px-3 py-2">{r.bidangLabel}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono text-xs">{r.candidate.kode_uraian}</span>
                          <span className="text-slate-500"> — {r.candidate.nama_uraian.slice(0, 60)}</span>
                          <span className="block text-[11px] text-slate-400 tabular-nums">
                            S1 {formatRupiah(r.candidate.angkas_s1 || 0)} · S2 {formatRupiah(r.candidate.angkas_s2 || 0)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatRupiah(r.candidate.pagu)}</td>
                        <td className="px-3 py-2">
                          {r.errors.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-semibold">
                              <CheckCircle2 size={14} /> Valid
                              {r.duplicate && (
                                <span className="font-normal text-amber-700">· duplikat (digabung)</span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-start gap-1 text-rose-700 text-xs">
                              <CircleAlert size={14} className="mt-0.5 shrink-0" />
                              <span>{r.errors.join(" ")}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={executeImport}
                  disabled={validImportCount === 0 || importing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow-glow hover:shadow-lg disabled:opacity-50 transition-all duration-200"
                >
                  {importing && <Loader2 size={15} className="animate-spin" />}
                  {importing ? "Mengimpor…" : `Import ${validImportCount} baris valid`}
                </button>
                <button
                  type="button"
                  onClick={() => setImportPreview(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all duration-200 shadow-2xs"
                >
                  Batal
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Search & Filter Bar ── */}
      <div className="rounded-2xl bg-white border border-slate-100 p-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#f8fafc] border border-slate-200/70">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode / nama / nominal..."
            className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Dropdown Bidang */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs">
            <Building2 size={14} className="text-slate-400 shrink-0" />
            <select
              value={filterBidang}
              onChange={(e) => setFilterBidang(e.target.value)}
              disabled={!isAdmin}
              title={isAdmin ? "Filter bidang" : "Terkunci ke bidang Anda"}
              className="bg-transparent outline-none cursor-pointer text-xs font-semibold text-slate-700 disabled:opacity-70 pr-1"
            >
              {isAdmin && <option value="semua">Semua bidang</option>}
              {bidangList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nama}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Tahun */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <select
              value={filterTahun}
              onChange={(e) => setFilterTahun(e.target.value)}
              title="Filter tahun"
              className="bg-transparent outline-none cursor-pointer text-xs font-semibold text-slate-700 pr-1"
            >
              <option value="semua">Semua tahun</option>
              {tahunOptions.map((t) => (
                <option key={t} value={t}>
                  Tahun {t}
                </option>
              ))}
            </select>
          </div>

          {/* Tombol Filter */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Filter size={13} className="text-slate-500" />
            Filter
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Sub Kegiatan */}
        <div className="relative rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-5 overflow-hidden">
          <div className="flex items-start justify-between relative z-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-blue-600 text-white shadow-xs">
              <Layers size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="mt-3 relative z-0">
            <p className="text-xs font-medium text-slate-500">Total Sub Kegiatan</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900 mt-1 leading-tight">
              {grouped.length}
            </p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Seluruh bidang · Tahun aktif
            </p>
          </div>
          <CardMiniBarsBlue />
        </div>

        {/* Card 2: Total Uraian */}
        <div className="relative rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-5 overflow-hidden">
          <div className="flex items-start justify-between relative z-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500 text-white shadow-xs">
              <FileText size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="mt-3 relative z-0">
            <p className="text-xs font-medium text-slate-500">Total Uraian</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-900 mt-1 leading-tight">
              {filtered.length}
            </p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Detail uraian kegiatan
            </p>
          </div>
          <CardWaveMint />
        </div>

        {/* Card 3: Total Pagu */}
        <div className="relative rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-5 overflow-hidden">
          <div className="flex items-start justify-between relative z-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-[#f97316] text-white shadow-xs">
              <Wallet size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="mt-3 relative z-0">
            <p className="text-xs font-medium text-slate-500">Total Pagu</p>
            <p className="text-xl lg:text-[22px] font-bold tabular-nums tracking-tight text-slate-900 mt-1 leading-tight truncate">
              {formatRupiah(totals.pagu)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Akumulasi seluruh bidang
            </p>
          </div>
          <CardWaveAmber />
        </div>

        {/* Card 4: Dalam Proses */}
        <div className="relative rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-5 overflow-hidden">
          <div className="flex items-start justify-between relative z-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-amber-500 text-white shadow-xs">
              <Clock size={20} strokeWidth={2.2} />
            </div>
          </div>
          <div className="mt-3 relative z-0">
            <p className="text-xs font-medium text-slate-500">Dalam Proses</p>
            <p className="text-xl lg:text-[22px] font-bold tabular-nums tracking-tight text-amber-700 mt-1 leading-tight truncate">
              {totals.diproses > 0 ? formatRupiah(totals.diproses) : "Rp 0"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Pengajuan belum dicairkan
            </p>
          </div>
          <CardWaveAmber />
        </div>
      </div>

      {/* ── Tabel grup per sub kegiatan ── */}
      <section className="rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden" aria-label="Data pagu">
        {/* Table Card Header */}
        <div className="px-5 pt-5 pb-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Layers size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-bold text-[15px] text-slate-900 leading-tight">
                Daftar Sub Kegiatan / Uraian
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">
                {grouped.length} sub kegiatan · {filtered.length} uraian. Klik baris untuk melihat detail uraian.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCollapsed({})}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              Buka semua
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(Object.fromEntries(grouped.map((g) => [g.key, true])))}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              Tutup semua
            </button>
            <button
              type="button"
              className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 shadow-2xs transition-colors"
              title="Opsi lainnya"
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar border-t border-slate-100">
          <table className="w-full text-xs min-w-[68rem]">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-slate-500 border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 w-8">#</th>
                <th className="px-4 py-3">Sub kegiatan / Uraian</th>
                <th className="px-4 py-3 text-right">Pagu (Rp)</th>
                <th className="px-4 py-3 text-right">Angkas S1<br /><span className="font-normal text-slate-400">Jan–Jun</span></th>
                <th className="px-4 py-3 text-right">Angkas S2<br /><span className="font-normal text-slate-400">Jul–Des</span></th>
                <th className="px-4 py-3 text-right">Realisasi (Rp)</th>
                <th className="px-4 py-3 text-right">Dalam Proses (Rp)</th>
                <th className="px-4 py-3 text-right">Sisa (Rp)</th>
                <th className="px-4 py-3 text-right">%</th>
                {isAdmin && <th className="px-4 py-3 text-center w-28">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td colSpan={isAdmin ? 10 : 9} className="px-4 py-4">
                      <div className="h-4 rounded-lg skeleton" />
                    </td>
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-4 py-10 text-center">
                    <p className="font-medium text-rose-700">Gagal memuat: {loadError}</p>
                    <button
                      type="button"
                      onClick={loadAll}
                      className="mt-3 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold hover:bg-slate-50 transition-all duration-200 shadow-2xs"
                    >
                      Coba lagi
                    </button>
                  </td>
                </tr>
              ) : pageGroups.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-4 py-10 text-center">
                    <p className="font-medium text-slate-700">
                      {rows.length === 0
                        ? "Belum ada data pagu"
                        : "Tidak ada baris yang cocok dengan filter"}
                    </p>
                    <p className="text-[13px] text-slate-500 mt-1">
                      {rows.length === 0
                        ? isAdmin
                          ? 'Klik "Contoh file" untuk format, lalu Import Excel/CSV — atau Tambah manual.'
                          : "Minta admin menginput pagu untuk bidang Anda."
                        : "Ubah kata kunci atau filter bidang/tahun."}
                    </p>
                  </td>
                </tr>
              ) : (
                pageGroups.flatMap((g, groupIdx) => {
                  const isClosed = !searching && collapsed[g.key];
                  const rowNumber = (page - 1) * pageSize + groupIdx + 1;
                  const header = (
                    <tr key={g.key} className="border-t border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-slate-700 font-medium">
                        {rowNumber}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.key)}
                          className="flex items-start gap-2.5 text-left w-full group"
                          aria-expanded={!isClosed}
                          aria-label={`${isClosed ? "Buka" : "Tutup"} ${g.kode_sub_kegiatan}`}
                        >
                          <span className={`mt-0.5 shrink-0 text-slate-400 group-hover:text-slate-600 transition-transform ${isClosed ? "-rotate-90" : ""}`}>
                            <ChevronDown size={15} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 border border-purple-100/60">
                                {bidangMap[g.bidang_id]?.nama || "—"}
                              </span>
                              <span className="text-slate-400 text-xs">•</span>
                              <span className="text-slate-400 text-xs">{g.tahun}</span>
                              <span className="text-slate-400 text-xs">•</span>
                              <span className="text-slate-400 text-xs">{g.rows.length} uraian</span>
                            </div>
                            {(g.kode_program || g.nama_program) && (
                              <p className="text-[11px] text-slate-500 leading-snug truncate">
                                <span className="font-semibold text-slate-400">Program:</span>{" "}
                                {g.kode_program && <span className="font-mono">{g.kode_program}</span>}
                                {g.kode_program && g.nama_program ? " — " : ""}
                                {g.nama_program}
                              </p>
                            )}
                            {(g.kode_kegiatan || g.nama_kegiatan) && (
                              <p className="text-[11px] text-slate-500 leading-snug truncate">
                                <span className="font-semibold text-slate-400">Kegiatan:</span>{" "}
                                {g.kode_kegiatan && <span className="font-mono">{g.kode_kegiatan}</span>}
                                {g.kode_kegiatan && g.nama_kegiatan ? " — " : ""}
                                {g.nama_kegiatan}
                              </p>
                            )}
                            <span className="font-mono text-xs font-bold text-slate-800">
                              {g.kode_sub_kegiatan}
                            </span>
                            <p className="text-xs font-bold text-slate-900 leading-snug mt-0.5">
                              {g.nama_sub_kegiatan}
                            </p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-bold text-slate-800">
                        {formatRupiah(g.pagu)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold text-sky-700">
                        {Number(g.angkas_s1 || 0) > 0 ? formatRupiah(g.angkas_s1) : <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-semibold text-violet-700">
                        {Number(g.angkas_s2 || 0) > 0 ? formatRupiah(g.angkas_s2) : <span className="text-slate-300 font-normal">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-slate-800 font-medium">
                        {formatRupiah(g.realisasi)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-amber-700 font-medium">
                        {Number(g.diproses || 0) > 0 ? formatRupiah(g.diproses) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-bold text-slate-800">
                        {formatRupiah(g.sisa)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="tabular-nums text-xs font-bold text-slate-700">
                          {Number(g.persen || 0).toFixed(1)}%
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(g.rows[0])}
                              title="Ubah"
                              aria-label={`Ubah ${g.kode_sub_kegiatan}`}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-2xs"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActionError(""); setConfirmDelete(g.rows[0]); }}
                              title="Hapus"
                              aria-label={`Hapus ${g.kode_sub_kegiatan}`}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-colors shadow-2xs"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 transition-colors shadow-2xs"
                              title="Opsi"
                            >
                              <MoreHorizontal size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                  if (isClosed) return [header];
                  const kids = g.rows.map((r) => (
                    <tr key={r.budget_line_id} className="border-t border-slate-50 hover:bg-blue-50/20 transition-colors">
                      <td className="px-5 py-2.5"></td>
                      <td className="px-4 py-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 pl-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span className="font-mono text-xs text-slate-600 font-medium">
                              {r.kode_uraian}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 pl-3">
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center shrink-0">
                              <span className="w-1 h-1 rounded-full bg-slate-400" />
                            </span>
                            <p className="text-[12.5px] text-slate-700">
                              {r.nama_uraian}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-600">
                        {formatRupiah(r.pagu)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                        {Number(r.angkas_s1 || 0) > 0 ? (
                          <span className="font-semibold text-sky-700">{formatRupiah(r.angkas_s1)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                        {Number(r.angkas_s1 || 0) > 0 && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            sisa {formatRupiah(r.sisa_s1 ?? r.sisa)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap">
                        {Number(r.angkas_s2 || 0) > 0 ? (
                          <span className="font-semibold text-violet-700">{formatRupiah(r.angkas_s2)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                        {Number(r.angkas_s2 || 0) > 0 && (
                          <span className="block text-[10px] font-normal text-slate-400">
                            sisa {formatRupiah(r.sisa_s2 ?? r.sisa)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-600">
                        {formatRupiah(r.realisasi)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-amber-600">
                        {Number(r.diproses || 0) > 0 ? formatRupiah(r.diproses) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-600">
                        {formatRupiah(r.sisa)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="tabular-nums text-xs text-slate-600 font-medium">
                          {Number(r.persen_realisasi || 0).toFixed(1)}%
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(r)}
                              title="Ubah"
                              aria-label={`Ubah ${r.kode_uraian}`}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-2xs"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setActionError(""); setConfirmDelete(r); }}
                              title="Hapus"
                              aria-label={`Hapus ${r.kode_uraian}`}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-colors shadow-2xs"
                            >
                              <Trash2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 transition-colors shadow-2xs"
                              title="Opsi"
                            >
                              <MoreHorizontal size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ));
                  return [header, ...kids];
                })
              )}
            </tbody>
            {!loading && !loadError && pageGroups.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-xs">
                  <td className="px-5 py-3" colSpan={2}>
                    Total filter · {grouped.length} sub kegiatan · {filtered.length} uraian
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">
                    {formatRupiah(totals.pagu)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-sky-700">
                    {totals.angkas_s1 > 0 ? formatRupiah(totals.angkas_s1) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-violet-700">
                    {totals.angkas_s2 > 0 ? formatRupiah(totals.angkas_s2) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">
                    {formatRupiah(totals.realisasi)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-amber-700">
                    {totals.diproses > 0 ? formatRupiah(totals.diproses) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-slate-900">
                    {formatRupiah(totals.sisa)}
                  </td>
                  <td />
                  {isAdmin && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination bar */}
        {!loading && grouped.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-transparent outline-none cursor-pointer text-xs font-semibold text-slate-700 pr-1"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <span>
                Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, grouped.length)} dari {grouped.length} sub kegiatan
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Halaman sebelumnya"
                className="w-8 h-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
              >
                <ChevronLeft size={15} />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                const isActive = page === pageNum;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all shadow-2xs ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 bg-white border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Halaman berikutnya"
                className="w-8 h-8 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors shadow-2xs"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Modal tambah/edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={editingId ? "Ubah pagu" : "Tambah pagu"}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !saving && setModalOpen(false)} />
          <form
            onSubmit={handleSave}
            className="relative w-full max-w-lg glass-strong rounded-2xl shadow-glass-lg p-6 max-h-[90vh] overflow-auto"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-900">{editingId ? "Ubah pagu" : "Tambah pagu"}</h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                aria-label="Tutup"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-white/60 transition-all duration-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <label className="text-[13px] font-medium text-slate-700">
                Bidang
                <select
                  value={form.bidang_id}
                  onChange={(e) => setField("bidang_id", e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                >
                  <option value="">— Pilih —</option>
                  {bidangList.map((b) => (
                    <option key={b.id} value={b.id}>{b.nama}</option>
                  ))}
                </select>
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Tahun anggaran
                <input
                  type="number" min={2020} max={2100} required
                  value={form.tahun}
                  onChange={(e) => setField("tahun", e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Kode program
                <input
                  value={form.kode_program}
                  onChange={(e) => setField("kode_program", e.target.value)}
                  placeholder="2.19.01"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal font-mono outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Nama program
                <input
                  value={form.nama_program}
                  onChange={(e) => setField("nama_program", e.target.value)}
                  placeholder="Perencanaan, dan Anggaran"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Kode kegiatan
                <input
                  value={form.kode_kegiatan}
                  onChange={(e) => setField("kode_kegiatan", e.target.value)}
                  placeholder="2.19.01.2.01"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal font-mono outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Nama kegiatan
                <input
                  value={form.nama_kegiatan}
                  onChange={(e) => setField("nama_kegiatan", e.target.value)}
                  placeholder="Perencanaan Penganggaran"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Kode sub kegiatan
                <input
                  value={form.kode_sub_kegiatan}
                  onChange={(e) => setField("kode_sub_kegiatan", e.target.value)}
                  required placeholder="2.19.01.2.01.0001"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Kode uraian
                <input
                  value={form.kode_uraian}
                  onChange={(e) => setField("kode_uraian", e.target.value)}
                  required placeholder="5.1.02.01.01.0024"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal font-mono outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700 sm:col-span-2">
                Nama sub kegiatan
                <input
                  value={form.nama_sub_kegiatan}
                  onChange={(e) => setField("nama_sub_kegiatan", e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700 sm:col-span-2">
                Nama uraian
                <input
                  value={form.nama_uraian}
                  onChange={(e) => setField("nama_uraian", e.target.value)}
                  required
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Pagu (Rp)
                <input
                  type="number" min={0} step="any" required
                  value={form.pagu}
                  onChange={(e) => setField("pagu", e.target.value)}
                  placeholder="2960400"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Angkas Semester 1 — Jan–Jun (Rp)
                <input
                  type="number" min={0} step="any"
                  value={form.angkas_s1}
                  onChange={(e) => setField("angkas_s1", e.target.value)}
                  placeholder="0 = belum diatur"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <label className="text-[13px] font-medium text-slate-700">
                Angkas Semester 2 — Jul–Des (Rp)
                <input
                  type="number" min={0} step="any"
                  value={form.angkas_s2}
                  onChange={(e) => setField("angkas_s2", e.target.value)}
                  placeholder="0 = belum diatur"
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-normal tabular-nums outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all duration-200"
                />
              </label>
              <p className="text-xs text-slate-500 sm:col-span-2 -mt-1">
                Total Angkas S1+S2 tidak boleh melebihi Pagu. Kosongkan/0 bila belum diatur
                (maka hanya batas pagu yang berlaku). Contoh: pagu 1000, S1 = 400, S2 = 600.
              </p>
            </div>
            {formError && (
              <p role="alert" className="mt-3 text-[13px] text-rose-700 bg-rose-50/80 border border-rose-200/60 backdrop-blur-sm rounded-xl px-3 py-2">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="px-4 py-2 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-semibold hover:bg-white/80 transition-all duration-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold shadow-glow hover:shadow-lg disabled:opacity-60 transition-all duration-200"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? "Menyimpan…" : editingId ? "Simpan perubahan" : "Tambah"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Konfirmasi hapus */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Konfirmasi hapus">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !deleting && setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm glass-strong rounded-2xl shadow-glass-lg p-6">
            <h2 className="font-bold text-slate-900">Hapus baris pagu?</h2>
            <p className="text-sm text-slate-600 mt-1.5">
              <span className="font-mono text-xs bg-slate-100/50 px-1.5 py-0.5 rounded">{confirmDelete.kode_uraian}</span> —{" "}
              {confirmDelete.nama_uraian.slice(0, 80)}. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200/60 bg-white/50 backdrop-blur-sm text-sm font-semibold hover:bg-white/80 transition-all duration-200"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 text-white text-sm font-semibold shadow-glow hover:shadow-lg disabled:opacity-60 transition-all duration-200"
              >
                {deleting && <Loader2 size={15} className="animate-spin" />}
                {deleting ? "Menghapus…" : "Ya, hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
