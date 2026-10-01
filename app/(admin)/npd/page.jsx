"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  X,
  Pencil,
  Send,
  CircleAlert,
  CheckCircle2,
  Loader2,
  Building2,
  Calendar,
  CalendarDays,
  FileText,
  FilePlus2,
  BookOpen,
  Layers,
  Inbox,
  ChevronDown,
  Info,
  HelpCircle,
  Search,
  UserCog,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { pengajuanSchema } from "@/lib/validation";
import { formatRupiah, kuotaS2Efektif, sisaS2Efektif } from "@/lib/domain";

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Semester angkas dari tanggal pengajuan: S1 = Jan–Jun, S2 = Jul–Des.
function semesterOf(dateStr) {
  const m = Number(String(dateStr || "").slice(5, 7));
  if (Number.isFinite(m) && m >= 1 && m <= 6) return 1;
  if (Number.isFinite(m) && m >= 7 && m <= 12) return 2;
  const now = new Date().getMonth() + 1;
  return now <= 6 ? 1 : 2;
}

const EMPTY_FORM = {
  bidang_id: "",
  tahun: 2026,
  tanggal_pengajuan: todayISO(),
  nama_npd: "",
  ptk_id: "",
  catatan: "",
};

export default function NpdPage() {
  const [supabaseOk, setSupabaseOk] = useState(true);
  const [profile, setProfile] = useState(null);
  const [bidangList, setBidangList] = useState([]);
  const [ptkList, setPtkList] = useState([]);
  const [sisaRows, setSisaRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [drafts, setDrafts] = useState([]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [items, setItems] = useState([]);
  const [pickProgram, setPickProgram] = useState("");
  const [pickKegiatan, setPickKegiatan] = useState("");
  const [pickSub, setPickSub] = useState("");
  const [pickUraian, setPickUraian] = useState("");
  const [pickNominal, setPickNominal] = useState("");
  const [searchUraian, setSearchUraian] = useState("");
  const [nominalError, setNominalError] = useState("");
  const [subModalError, setSubModalError] = useState("");
  const [uraianModalError, setUraianModalError] = useState("");
  const [formModalError, setFormModalError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingNomor, setEditingNomor] = useState("");
  const [editingStatus, setEditingStatus] = useState("");
  const [editingRemarks, setEditingRemarks] = useState([]);
  const [converting, setConverting] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState("");
  const [lastRefresh, setLastRefresh] = useState("");

  const [confirmAjukan, setConfirmAjukan] = useState(null);
  const [ajukanBusy, setAjukanBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionMsg, setActionMsg] = useState({ type: "", text: "" });

  // Modal State
  const [showGuide, setShowGuide] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const isAdmin = profile?.role === "admin";
  const bidangMap = useMemo(
    () => Object.fromEntries(bidangList.map((b) => [b.id, b])),
    [bidangList]
  );
  // User dikunci ke bidangnya; admin memilih lewat form.
  const activeBidangId = isAdmin ? form.bidang_id : profile?.bidang_id || "";

  // PTK aktif untuk bidang yang sedang dipilih pada form (penanda tangan cetak NPD).
  const ptkOptions = useMemo(
    () =>
      ptkList.filter(
        (p) => p.bidang_id === activeBidangId && p.aktif !== false
      ),
    [ptkList, activeBidangId]
  );

  // Satu PTK di bidang ini -> pilih otomatis, supaya cetak NPD tidak kosong.
  useEffect(() => {
    setForm((f) => {
      const stillValid =
        f.ptk_id && ptkOptions.some((p) => p.id === f.ptk_id);
      if (stillValid) return f;
      if (f.ptk_id && ptkOptions.length === 0) return { ...f, ptk_id: "" };
      if (ptkOptions.length === 1) return { ...f, ptk_id: ptkOptions[0].id };
      return f;
    });
  }, [ptkOptions]);

  function getClient() {
    return createBrowserClient();
  }

  async function loadAll() {
    setLoading(true);
    setLoadError("");
    try {
      const supabase = getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) userIdRef.current = user.id;
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

      // Master PTK (penanda tangan cetak NPD). RLS: admin semua, user bidangnya.
      // Tabel ptk baru ada setelah migration_012 — kalau belum ada, jangan gagalkan halaman.
      try {
        const { data: ptkData, error: ptkErr } = await supabase
          .from("ptk")
          .select("id, bidang_id, nama, nip, aktif")
          .order("nama");
        if (ptkErr) {
          setPtkList([]);
        } else {
          setPtkList(ptkData || []);
        }
      } catch {
        setPtkList([]);
      }

      // Sisa pagu per uraian (RLS otomatis membatasi user ke bidangnya).
      const { data: sisaData, error: sisaErr } = await supabase
        .from("v_budget_realisasi")
        .select("*")
        .order("kode_sub_kegiatan")
        .order("kode_uraian")
        .limit(5000);
      if (sisaErr) throw sisaErr;
      setSisaRows(sisaData || []);

      // Draft milik sendiri yang masih bisa diubah (DRAFT / REVISI).
      if (user) {
        const { data: draftData, error: draftErr } = await supabase
          .from("pengajuan")
          .select(
            "id, nomor_pengajuan, bidang_id, tahun, tanggal_pengajuan, nama_npd, ptk_id, catatan, status, total_nominal, pengajuan_items(id, budget_line_id, nominal)"
          )
          .eq("diajukan_oleh", user.id)
          .in("status", ["DRAFT", "REVISI"])
          .order("created_at", { ascending: false });
        if (draftErr) throw draftErr;
        setDrafts(draftData || []);
      }

      // Default form: user langsung dikunci ke bidangnya.
      if (prof?.role !== "admin" && prof?.bidang_id) {
        setForm((f) => ({ ...f, bidang_id: prof.bidang_id }));
      }
    } catch (err) {
      if (/belum diisi|NEXT_PUBLIC/i.test(err.message || "")) {
        setSupabaseOk(false);
      } else {
        setLoadError(err.message || "Gagal memuat data.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh drafts saja tanpa loading spinner (untuk polling).
  const editingIdRef = useRef(null);
  const userIdRef = useRef(null);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);

  async function refreshDraftsQuiet() {
    try {
      const supabase = getClient();
      let uid = userIdRef.current;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        uid = user.id;
        userIdRef.current = uid;
      }
      const { data: draftData, error } = await supabase
        .from("pengajuan")
        .select(
          "id, nomor_pengajuan, bidang_id, tahun, tanggal_pengajuan, nama_npd, ptk_id, catatan, status, total_nominal, pengajuan_items(id, budget_line_id, nominal)"
        )
        .eq("diajukan_oleh", uid)
        .in("status", ["DRAFT", "REVISI"])
        .order("created_at", { ascending: false });
      if (error) return;
      setDrafts(draftData || []);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch { /* ignore */ }
  }

  async function refreshRemarksQuiet() {
    const sid = editingIdRef.current;
    if (!sid) return;
    try {
      const supabase = getClient();
      const { data } = await supabase
        .from("revisi_remarks")
        .select("id, remark, diberikan_oleh, created_at")
        .eq("pengajuan_id", sid)
        .order("created_at", { ascending: false });
      setEditingRemarks(data || []);
    } catch { /* ignore */ }
  }

  // Polling: refresh drafts & remarks setiap 5 detik agar selalu up-to-date.
  useEffect(() => {
    let alive = true;

    async function poll() {
      if (!alive) return;
      await refreshDraftsQuiet();
      await refreshRemarksQuiet();
    }

    // Langsung jalankan sekali saat mount.
    poll();

    // Interval polling.
    const pollId = setInterval(poll, 5000);

    return () => { alive = false; clearInterval(pollId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select program jika hanya 1 pilihan untuk bidang + tahun tersebut.
  useEffect(() => {
    if (editingId) return;
    if (!activeBidangId || !form.tahun) return;
    if (pickProgram) return;
    const uniquePrograms = new Map();
    for (const r of sisaRows) {
      if (r.bidang_id === activeBidangId && String(r.tahun) === String(form.tahun)) {
        if (!uniquePrograms.has(r.kode_program)) {
          uniquePrograms.set(r.kode_program, r.nama_program);
        }
      }
    }
    if (uniquePrograms.size === 1) {
      const [kode] = uniquePrograms.keys();
      setPickProgram(kode);
    }
  }, [activeBidangId, form.tahun, sisaRows, pickProgram, editingId]);

  // Kandidat uraian untuk bidang + tahun yang aktif di form.
  const formRows = useMemo(() => {
    if (!activeBidangId) return [];
    let rows = sisaRows.filter(
      (r) =>
        r.bidang_id === activeBidangId &&
        String(r.tahun) === String(form.tahun || "")
    );
    if (pickProgram) {
      rows = rows.filter((r) => r.kode_program === pickProgram);
    }
    if (pickKegiatan) {
      rows = rows.filter((r) => r.kode_kegiatan === pickKegiatan);
    }
    return rows;
  }, [sisaRows, activeBidangId, form.tahun, pickProgram, pickKegiatan]);

  const programOptions = useMemo(() => {
    const map = new Map();
    for (const r of sisaRows.filter(
      (r) =>
        r.bidang_id === activeBidangId &&
        String(r.tahun) === String(form.tahun || "")
    )) {
      if (!map.has(r.kode_program)) {
        map.set(r.kode_program, {
          kode: r.kode_program,
          nama: r.nama_program,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      String(a.kode).localeCompare(String(b.kode))
    );
  }, [sisaRows, activeBidangId, form.tahun]);

  const kegiatanOptions = useMemo(() => {
    const map = new Map();
    for (const r of sisaRows.filter(
      (r) =>
        r.bidang_id === activeBidangId &&
        String(r.tahun) === String(form.tahun || "") &&
        (!pickProgram || r.kode_program === pickProgram)
    )) {
      if (!map.has(r.kode_kegiatan)) {
        map.set(r.kode_kegiatan, {
          kode: r.kode_kegiatan,
          nama: r.nama_kegiatan,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      String(a.kode).localeCompare(String(b.kode))
    );
  }, [sisaRows, activeBidangId, form.tahun, pickProgram]);

  const subOptions = useMemo(() => {
    const map = new Map();
    for (const r of formRows) {
      if (!map.has(r.kode_sub_kegiatan)) {
        map.set(r.kode_sub_kegiatan, {
          kode: r.kode_sub_kegiatan,
          nama: r.nama_sub_kegiatan,
        });
      }
    }
    return [...map.values()].sort((a, b) =>
      String(a.kode).localeCompare(String(b.kode))
    );
  }, [formRows]);

  // Aturan: 1 NPD hanya boleh 1 sub kegiatan, boleh banyak uraian dari sub itu.
  const lockedSub = items[0]?.kode_sub_kegiatan || "";
  const lockedSubName =
    items[0]?.nama_sub_kegiatan ||
    subOptions.find((s) => s.kode === lockedSub)?.nama ||
    "";
  const isSubLocked = Boolean(lockedSub);
  const effectiveSub = isSubLocked ? lockedSub : pickSub;
  const itemsSubCount = useMemo(
    () => new Set(items.map((it) => it.kode_sub_kegiatan).filter(Boolean)).size,
    [items]
  );
  const isMultiSubLegacy = itemsSubCount > 1;

  const uraianOptions = useMemo(
    () =>
      formRows
        .filter((r) => effectiveSub && r.kode_sub_kegiatan === effectiveSub)
        .sort((a, b) => String(a.kode_uraian).localeCompare(String(b.kode_uraian))),
    [formRows, effectiveSub]
  );

  const pickedRow = useMemo(
    () => formRows.find((r) => r.budget_line_id === pickUraian) || null,
    [formRows, pickUraian]
  );

  // Semester aktif mengikuti tanggal pengajuan pada form.
  const formSemester = useMemo(
    () => semesterOf(form.tanggal_pengajuan),
    [form.tanggal_pengajuan]
  );
  const pickedAngkas = useMemo(() => {
    if (!pickedRow) return 0;
    if (formSemester === 1) return Number(pickedRow.angkas_s1) || 0;
    // SOP baru: sisa S1 yang belum terpakai menambah kuota S2.
    return Number(kuotaS2Efektif(pickedRow)) || 0;
  }, [pickedRow, formSemester]);
  const pickedCarry = useMemo(() => {
    if (!pickedRow || formSemester !== 2) return 0;
    if (pickedRow.carryover_s1 !== undefined) return Math.max(0, Number(pickedRow.carryover_s1 || 0));
    const a1 = Number(pickedRow.angkas_s1 || 0);
    if (!(a1 > 0)) return 0;
    return Math.max(0, Number(pickedRow.sisa_s1 ?? 0));
  }, [pickedRow, formSemester]);
  const pickedSisaSem = useMemo(() => {
    if (!pickedRow) return null;
    if (!(pickedAngkas > 0)) return null; // belum diatur = hanya batas pagu
    if (formSemester === 1) {
      const v = pickedRow.sisa_s1;
      return v === undefined || v === null ? Number(pickedRow.sisa || 0) : Number(v);
    }
    // S2: pakai sisa efektif (view baru sudah efektif, view lama dihitung via helper).
    return Number(sisaS2Efektif(pickedRow));
  }, [pickedRow, pickedAngkas, formSemester]);

  // Real-time nominal validation.
  const nominalValue = useMemo(() => {
    if (!pickNominal) return 0;
    return Number(String(pickNominal).replace(/\./g, "").replace(/,/g, "."));
  }, [pickNominal]);

  const nominalValidation = useMemo(() => {
    if (!pickNominal) return { valid: false, error: "" };
    if (!Number.isFinite(nominalValue) || nominalValue <= 0) {
      return { valid: false, error: "Nominal harus lebih dari Rp 0." };
    }
    const sisa = Number(pickedRow?.sisa || 0);
    if (pickedRow && nominalValue > sisa) {
      return { valid: false, error: `Nominal melebihi sisa pagu ${formatRupiah(sisa)}.` };
    }
    if (pickedRow && pickedSisaSem !== null && nominalValue > pickedSisaSem) {
      if (formSemester === 2 && pickedCarry > 0) {
        return {
          valid: false,
          error: `DIBLOKIR ANGKAS Semester 2: nominal melebihi sisa angkas efektif ${formatRupiah(pickedSisaSem)} (kuota S2 ${formatRupiah(Number(pickedRow.angkas_s2 || 0))} + sisa S1 ${formatRupiah(pickedCarry)}). Tanggal ${form.tanggal_pengajuan || "—"} masuk Semester 2.`,
        };
      }
      return {
        valid: false,
        error: `DIBLOKIR ANGKAS Semester ${formSemester}: nominal melebihi sisa angkas ${formatRupiah(pickedSisaSem)} (kuota ${formatRupiah(pickedAngkas)}). Tanggal ${form.tanggal_pengajuan || "—"} masuk Semester ${formSemester} (S1: Jan–Jun, S2: Jul–Des).`,
      };
    }
    return { valid: true, error: "" };
  }, [pickNominal, nominalValue, pickedRow, pickedSisaSem, pickedAngkas, pickedCarry, formSemester, form.tanggal_pengajuan]);

  const sisaSetelah = useMemo(() => {
    if (!pickedRow || !nominalValidation.valid) return null;
    return Number(pickedRow.sisa || 0) - nominalValue;
  }, [pickedRow, nominalValidation.valid, nominalValue]);

  // Modal field errors for submit validation.
  const modalHasError = useMemo(() => {
    if (!effectiveSub) return true;
    if (!pickUraian) return true;
    if (!pickNominal || !nominalValidation.valid) return true;
    return false;
  }, [effectiveSub, pickUraian, pickNominal, nominalValidation.valid]);

  const totalNominal = useMemo(
    () => items.reduce((a, it) => a + Number(it.nominal || 0), 0),
    [items]
  );

  function setField(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      return next;
    });
    // Ganti bidang/tahun/program = kandidat uraian berubah -> item lama tidak valid lagi.
    if ((k === "bidang_id" || k === "tahun") && items.length > 0) {
      setItems([]);
      setPickProgram("");
      setPickKegiatan("");
      setPickSub("");
      setPickUraian("");
      setPickNominal("");
      setFormError("Bidang/tahun diganti — daftar item dikosongkan, silakan pilih ulang.");
    }
  }

  function addItem() {
    setFormError("");
    setFormModalError("");
    setSubModalError("");
    setUraianModalError("");
    setNominalError("");
    if (editingId && editingStatus === "REVISI") {
      setFormError(
        isAdmin
          ? "Status masih REVISI — klik Kembalikan ke DRAFT dulu untuk ubah nominal."
          : "Status masih REVISI — menunggu admin mengembalikan ke DRAFT. Setelah itu Anda tinggal mengubah dan mengajukan ulang."
      );
      return;
    }
    if (!effectiveSub) {
      setSubModalError("Sub kegiatan wajib dipilih.");
      return;
    }
    if (!pickedRow) {
      setUraianModalError("Uraian belanja wajib dipilih.");
      return;
    }
    // 1 NPD = 1 sub kegiatan. Item berikutnya wajib dari sub yang sama.
    if (isSubLocked && pickedRow.kode_sub_kegiatan !== lockedSub) {
      setFormModalError(
        `1 NPD hanya boleh 1 sub kegiatan (sudah terkunci ke ${lockedSub}). Buat NPD terpisah untuk sub ${pickedRow.kode_sub_kegiatan}.`
      );
      return;
    }
    if (items.some((it) => it.budget_line_id === pickedRow.budget_line_id)) {
      setFormModalError("Uraian ini sudah ada di daftar. Ubah nominalnya langsung di tabel.");
      return;
    }
    if (!pickNominal) {
      setNominalError("Nominal pengajuan wajib diisi.");
      return;
    }
    const nominal = Number(String(pickNominal).replace(/\./g, "").replace(/,/g, "."));
    if (!Number.isFinite(nominal) || nominal <= 0) {
      setNominalError("Nominal harus lebih dari Rp 0.");
      return;
    }
    const sisa = Number(pickedRow.sisa || 0);
    if (nominal > sisa) {
      setNominalError(`Nominal melebihi sisa pagu ${formatRupiah(sisa)}.`);
      return;
    }
    if (pickedSisaSem !== null && nominal > pickedSisaSem) {
      if (formSemester === 2 && pickedCarry > 0) {
        setNominalError(
          `DIBLOKIR ANGKAS Semester 2: nominal melebihi sisa angkas efektif ${formatRupiah(pickedSisaSem)} (kuota S2 ${formatRupiah(Number(pickedRow.angkas_s2 || 0))} + sisa S1 ${formatRupiah(pickedCarry)}).`
        );
      } else {
        setNominalError(
          `DIBLOKIR ANGKAS Semester ${formSemester}: nominal melebihi sisa angkas ${formatRupiah(pickedSisaSem)} (kuota ${formatRupiah(pickedAngkas)}).`
        );
      }
      return;
    }
    setItems((list) => [
      ...list,
      {
        budget_line_id: pickedRow.budget_line_id,
        kode_sub_kegiatan: pickedRow.kode_sub_kegiatan,
        nama_sub_kegiatan: pickedRow.nama_sub_kegiatan,
        kode_uraian: pickedRow.kode_uraian,
        nama_uraian: pickedRow.nama_uraian,
        pagu: Number(pickedRow.pagu || 0),
        sisa,
        nominal,
      },
    ]);
    // Kunci sub ke item pertama agar item berikutnya hanya dari sub yang sama.
    setPickSub(pickedRow.kode_sub_kegiatan);
    setPickUraian("");
    setPickNominal("");
    setSearchUraian("");
    setNominalError("");
    setSubModalError("");
    setUraianModalError("");
    setFormModalError("");
    setShowAddModal(false);
  }

  function gantiSub() {
    if (editingId && editingStatus === "REVISI") return;
    setItems([]);
    setPickProgram("");
    setPickKegiatan("");
    setPickSub("");
    setPickUraian("");
    setPickNominal("");
    setFormError("");
  }

  function updateNominal(id, value) {
    if (editingId && editingStatus === "REVISI") return;
    const nominal = Number(String(value).replace(/\./g, "").replace(/,/g, "."));
    setItems((list) =>
      list.map((it) =>
        it.budget_line_id === id
          ? { ...it, nominal: Number.isFinite(nominal) ? nominal : 0 }
          : it
      )
    );
  }

  function editDraft(d) {
    setSaveResult("");
    setFormError("");
    setActionMsg({ type: "", text: "" });
    setEditingId(d.id);
    setEditingNomor(d.nomor_pengajuan || "");
    setEditingStatus(d.status || "");
    setEditingRemarks([]);
    getClient()
      .from("revisi_remarks")
      .select("id, remark, diberikan_oleh, created_at")
      .eq("pengajuan_id", d.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setEditingRemarks(data || []))
      .catch(() => setEditingRemarks([]));
    setForm({
      bidang_id: d.bidang_id,
      tahun: d.tahun,
      tanggal_pengajuan: d.tanggal_pengajuan,
      nama_npd: d.nama_npd || "",
      ptk_id: d.ptk_id || "",
      catatan: d.catatan || "",
    });
    const enriched = (d.pengajuan_items || []).map((pi) => {
      const ref = sisaRows.find((r) => r.budget_line_id === pi.budget_line_id);
      return {
        budget_line_id: pi.budget_line_id,
        kode_sub_kegiatan: ref?.kode_sub_kegiatan || "",
        nama_sub_kegiatan: ref?.nama_sub_kegiatan || "",
        kode_uraian: ref?.kode_uraian || "",
        nama_uraian: ref?.nama_uraian || "",
        pagu: Number(ref?.pagu || 0),
        sisa: Number(ref?.sisa || 0),
        nominal: Number(pi.nominal || 0),
      };
    });
    setItems(enriched);
    setPickProgram(enriched[0] ? (sisaRows.find((r) => r.budget_line_id === enriched[0].budget_line_id)?.kode_program || "") : "");
    setPickKegiatan(enriched[0] ? (sisaRows.find((r) => r.budget_line_id === enriched[0].budget_line_id)?.kode_kegiatan || "") : "");
    setPickSub("");
    setPickUraian("");
    setPickNominal("");
    window.scrollTo({ top: 400, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingNomor("");
    setEditingStatus("");
    setEditingRemarks([]);
    setItems([]);
    setPickProgram("");
    setPickKegiatan("");
    setPickSub("");
    setPickUraian("");
    setPickNominal("");
    setFormError("");
    setForm((f) => ({
      ...EMPTY_FORM,
      bidang_id: isAdmin ? "" : profile?.bidang_id || "",
    }));
  }

  async function kembalikanKeDraft() {
    if (!editingId) return;
    if (!isAdmin) {
      setFormError("Hanya admin yang dapat mengembalikan ke DRAFT. Hubungi admin, lalu Anda tinggal mengubah dan mengajukan ulang.");
      return;
    }
    setConverting(true);
    setFormError("");
    try {
      const supabase = getClient();
      const { error } = await supabase.rpc("ubah_status_pengajuan", {
        p_pengajuan_id: editingId,
        p_to: "DRAFT",
        p_catatan: "Dikembalikan ke draft untuk revisi nominal",
      });
      if (error) throw error;
      setEditingStatus("DRAFT");
      setDrafts((list) => list.map((x) => (x.id === editingId ? { ...x, status: "DRAFT" } : x)));
      setSaveResult(`${editingNomor} dikembalikan ke DRAFT. Silakan ubah nominal, remark revisi di atas tetap tersimpan.`);
      await loadAll();
    } catch (err) {
      const msg = err.message || "Gagal mengembalikan ke draft.";
      setFormError(
        /Transisi.*tidak diizinkan/i.test(msg)
          ? `${msg} — database belum dimigrasi. Jalankan migration_002_revisi_to_draft.sql di Supabase SQL Editor.`
          : msg
      );
    } finally {
      setConverting(false);
    }
  }

  const lockedByRevisi = editingId && editingStatus === "REVISI";

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaveResult("");
    if (editingId && editingStatus === "REVISI") {
      setFormError(
        isAdmin
          ? "Status masih REVISI — klik Kembalikan ke DRAFT dulu untuk ubah nominal."
          : "Status masih REVISI — menunggu admin mengembalikan ke DRAFT."
      );
      return;
    }
    const bidangId = isAdmin ? form.bidang_id : profile?.bidang_id;
    if (!bidangId) {
      setFormError(
        isAdmin
          ? "Pilih bidang terlebih dahulu."
          : "Akun Anda belum punya bidang. Minta admin mengatur bidang di profiles."
      );
      return;
    }
    if (!pickProgram) {
      setFormError("Pilih program terlebih dahulu.");
      return;
    }
    if (!pickKegiatan) {
      setFormError("Pilih kegiatan terlebih dahulu.");
      return;
    }
    const parsed = pengajuanSchema.safeParse({
      bidang_id: bidangId,
      ptk_id: form.ptk_id || "",
      tanggal_pengajuan: form.tanggal_pengajuan,
      nama_npd: form.nama_npd,
      catatan: form.catatan || "",
      items: items.map((it) => ({
        budget_line_id: it.budget_line_id,
        nominal: Number(it.nominal),
      })),
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || "Form belum valid.");
      return;
    }
    // Aturan: 1 NPD hanya boleh 1 sub kegiatan
    if (new Set(items.map((it) => it.kode_sub_kegiatan).filter(Boolean)).size > 1) {
      setFormError("1 NPD hanya boleh 1 sub kegiatan. Pisahkan sub yang berbeda ke NPD terpisah.");
      return;
    }
    // Cek sisa pagu + sisa angkas semester per item (tanggal bisa berubah setelah item dipilih)
    const sem = semesterOf(form.tanggal_pengajuan);
    for (const it of items) {
      if (!(it.nominal > 0)) {
        setFormError(`Nominal untuk ${it.kode_uraian || "uraian"} harus lebih dari 0.`);
        return;
      }
      const ref = sisaRows.find((r) => r.budget_line_id === it.budget_line_id);
      const sisaLive = ref ? Number(ref.sisa || 0) : Number(it.sisa);
      if (Number(it.nominal) > sisaLive) {
        setFormError(
          `Nominal ${formatRupiah(it.nominal)} melebihi sisa ${formatRupiah(sisaLive)} (${it.kode_uraian}).`
        );
        return;
      }
      if (ref) {
        if (sem === 1) {
          const kuota = Number(ref.angkas_s1) || 0;
          if (kuota > 0) {
            const sisaSemRaw = ref.sisa_s1;
            const sisaSem = sisaSemRaw === undefined || sisaSemRaw === null ? sisaLive : Number(sisaSemRaw);
            if (Number(it.nominal) > sisaSem) {
              setFormError(
                `DIBLOKIR ANGKAS Semester 1: ${it.kode_uraian} nominal ${formatRupiah(it.nominal)} melebihi sisa angkas ${formatRupiah(sisaSem)} (kuota ${formatRupiah(kuota)}). Tanggal ${form.tanggal_pengajuan} masuk Semester 1.`
              );
              return;
            }
          }
        } else {
          // SOP baru: S2 memakai kuota efektif = S2 + sisa S1.
          const kuotaEff = Number(kuotaS2Efektif(ref)) || 0;
          if (kuotaEff > 0) {
            const sisaSem = Number(sisaS2Efektif(ref));
            if (Number(it.nominal) > sisaSem) {
              const carry = ref.carryover_s1 !== undefined
                ? Math.max(0, Number(ref.carryover_s1 || 0))
                : Math.max(0, Number(ref.sisa_s1 ?? 0));
              setFormError(
                `DIBLOKIR ANGKAS Semester 2: ${it.kode_uraian} nominal ${formatRupiah(it.nominal)} melebihi sisa angkas efektif ${formatRupiah(sisaSem)} (kuota S2 ${formatRupiah(Number(ref.angkas_s2 || 0))} + sisa S1 ${formatRupiah(carry)}). Tanggal ${form.tanggal_pengajuan} masuk Semester 2.`
              );
              return;
            }
          }
        }
      }
    }
    setSaving(true);
    try {
      const supabase = getClient();
      if (editingId) {
        const { error: hErr } = await supabase
          .from("pengajuan")
          .update({
            bidang_id: bidangId,
            tahun: Number(form.tahun),
            tanggal_pengajuan: form.tanggal_pengajuan,
            nama_npd: form.nama_npd.trim(),
            ptk_id: form.ptk_id || null,
            catatan: form.catatan?.trim() ? form.catatan.trim() : null,
          })
          .eq("id", editingId);
        if (hErr) throw hErr;
        const { data: existing } = await supabase
          .from("pengajuan_items")
          .select("budget_line_id")
          .eq("pengajuan_id", editingId);
        const keep = new Set(items.map((it) => it.budget_line_id));
        const removed = (existing || [])
          .map((x) => x.budget_line_id)
          .filter((id) => !keep.has(id));
        if (removed.length > 0) {
          const { error: delErr } = await supabase
            .from("pengajuan_items")
            .delete()
            .eq("pengajuan_id", editingId)
            .in("budget_line_id", removed);
          if (delErr) throw delErr;
        }
        if (items.length > 0) {
          const { error: upErr } = await supabase
            .from("pengajuan_items")
            .upsert(
              items.map((it) => ({
                pengajuan_id: editingId,
                budget_line_id: it.budget_line_id,
                nominal: Number(it.nominal),
              })),
              { onConflict: "pengajuan_id,budget_line_id" }
            );
          if (upErr) throw upErr;
        }
        setSaveResult(`Perubahan draft ${editingNomor} tersimpan.`);
      } else {
        const { data: header, error: hErr } = await supabase
          .from("pengajuan")
          .insert({
            bidang_id: bidangId,
            tahun: Number(form.tahun),
            tanggal_pengajuan: form.tanggal_pengajuan,
            nama_npd: form.nama_npd.trim(),
            ptk_id: form.ptk_id || null,
            catatan: form.catatan?.trim() ? form.catatan.trim() : null,
            diajukan_oleh: profile?.id || null,
          })
          .select("id, nomor_pengajuan")
          .single();
        if (hErr) throw hErr;
        const { error: iErr } = await supabase.from("pengajuan_items").insert(
          items.map((it) => ({
            pengajuan_id: header.id,
            budget_line_id: it.budget_line_id,
            nominal: Number(it.nominal),
          }))
        );
        if (iErr) {
          await supabase.from("pengajuan").delete().eq("id", header.id);
          throw iErr;
        }
        setSaveResult(`Draft ${header.nomor_pengajuan} berhasil disimpan.`);
      }
      cancelEdit();
      await loadAll();
    } catch (err) {
      if (err.code === "23505") {
        setFormError("Satu uraian tidak boleh duplikat dalam satu pengajuan.");
      } else if (/melebihi sisa|angkas|diblokir/i.test(err.message || "")) {
        setFormError(err.message);
      } else {
        setFormError(err.message || "Gagal menyimpan pengajuan.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDraft() {
    if (!confirmDelete) return;
    setDeleting(true);
    setActionMsg({ type: "", text: "" });
    try {
      const supabase = getClient();
      const { error } = await supabase
        .from("pengajuan")
        .delete()
        .eq("id", confirmDelete.id);
      if (error) throw error;
      setConfirmDelete(null);
      if (editingId === confirmDelete.id) cancelEdit();
      setActionMsg({ type: "ok", text: `Draft ${confirmDelete.nomor_pengajuan} dihapus.` });
      await loadAll();
    } catch (err) {
      setActionMsg({ type: "err", text: err.message || "Gagal menghapus draft." });
    } finally {
      setDeleting(false);
    }
  }

  async function handleAjukan() {
    if (!confirmAjukan) return;
    setAjukanBusy(true);
    setActionMsg({ type: "", text: "" });
    try {
      const supabase = getClient();
      const { error } = await supabase.rpc("ubah_status_pengajuan", {
        p_pengajuan_id: confirmAjukan.id,
        p_to: "DIAJUKAN",
      });
      if (error) throw error;
      const nomor = confirmAjukan.nomor_pengajuan;
      setConfirmAjukan(null);
      if (editingId === confirmAjukan.id) cancelEdit();
      setActionMsg({ type: "ok", text: `${nomor} sudah DIAJUKAN. Pantau prosesnya di History Pengajuan.` });
      await loadAll();
    } catch (err) {
      setActionMsg({ type: "err", text: err.message || "Gagal mengajukan." });
    } finally {
      setAjukanBusy(false);
    }
  }

  if (!supabaseOk) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pengajuan NPD</h1>
        <div className="mt-6 bg-white rounded-2xl border border-amber-200/80 p-6 shadow-clean">
          <h2 className="font-semibold text-amber-900">Database belum terhubung</h2>
          <p className="text-sm text-slate-600 mt-1.5">
            Periksa variabel lingkungan Supabase di konfigurasi Anda.
          </p>
        </div>
      </div>
    );
  }

  const noBidang = !isAdmin && !profile?.bidang_id;

  return (
    <div className="space-y-6 pb-12">
      {/* ---------- HEADER HALAMAN ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs md:text-sm font-semibold text-blue-600 tracking-wide">
            Pengajuan dana
          </p>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-slate-900 mt-0.5">
            Pengajuan NPD
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            {isAdmin
              ? "Admin bisa memilih semua bidang."
              : "Otomatis memakai bidang dari profil Anda. Nominal divalidasi terhadap sisa pagu + sisa angkas semester (S1: Jan–Jun, S2: Jul–Des + sisa S1 yang belum terpakai)."}
          </p>
        </div>

        {/* Tombol Lihat Panduan */}
        <div>
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 text-xs md:text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <BookOpen size={16} className="text-slate-500" />
            <span>Lihat Panduan</span>
          </button>
        </div>
      </div>

      {/* Pesan Notifikasi */}
      {actionMsg.text && (
        <div
          role={actionMsg.type === "err" ? "alert" : "status"}
          className={`text-xs md:text-sm rounded-xl px-4 py-3 border flex items-center gap-2 ${
            actionMsg.type === "err"
              ? "text-rose-700 bg-rose-50 border-rose-200"
              : "text-emerald-800 bg-emerald-50 border-emerald-200"
          }`}
        >
          {actionMsg.type === "err" ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <span>{actionMsg.text}</span>
        </div>
      )}

      {saveResult && (
        <div
          role="status"
          className="text-xs md:text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2"
        >
          <CheckCircle2 size={16} />
          <span>{saveResult}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-clean p-6 space-y-4">
          <div className="h-28 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-64 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-clean">
          <p className="font-medium text-rose-700">Gagal memuat data: {loadError}</p>
          <button
            type="button"
            onClick={loadAll}
            className="mt-3 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold hover:bg-slate-50 transition-all"
          >
            Coba lagi
          </button>
        </div>
      ) : (
        <>
          {/* ---------- BANNER: DRAFT SAYA ---------- */}
          <div className="relative overflow-hidden rounded-2xl border border-blue-100/90 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-indigo-100/80 p-5 md:p-6 shadow-clean">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* Icon Dokumen Plus */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/70 flex items-center justify-center text-blue-600 shrink-0 shadow-2xs">
                  <FilePlus2 size={24} className="stroke-[2.2]" />
                </div>

                <div>
                  <h2 className="text-base font-bold text-slate-800">Draft saya</h2>
                  <p className="text-xs text-slate-500 font-normal mt-0.5">
                    DRAFT / REVISI milik Anda yang masih bisa diubah, dihapus, atau diajukan.
                  </p>
                  {drafts.length === 0 ? (
                    <p className="text-xs md:text-sm text-slate-600 mt-2 font-normal">
                      Belum ada draft. Isi form di bawah untuk membuat pengajuan baru.
                    </p>
                  ) : (
                    <p className="text-xs md:text-sm text-indigo-700 font-medium mt-1.5">
                      Anda memiliki {drafts.length} draft yang tersimpan. Klik Ubah pada tabel di bawah untuk melanjutkan pengajuan.
                    </p>
                  )}
                </div>
              </div>

              {/* Graphic Illustration 3D di sisi kanan */}
              <div className="hidden md:flex items-center justify-end relative w-56 h-24 shrink-0 pointer-events-none select-none -mr-5 md:-mr-6">
                <svg viewBox="0 0 230 100" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="draftCardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#eef4ff" />
                    </linearGradient>
                    <filter id="draftShadow" x="-30%" y="-30%" width="160%" height="160%">
                      <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#1e3a8a" floodOpacity="0.16" />
                    </filter>
                  </defs>
                  {/* Lingkaran dekoratif gradasi lembut (bleed ke tepi kanan) */}
                  <circle cx="176" cy="32" r="46" fill="#c7d2fe" opacity="0.5" />
                  <circle cx="214" cy="70" r="36" fill="#bfdbfe" opacity="0.6" />
                  <circle cx="148" cy="80" r="18" fill="#a5b4fc" opacity="0.35" />
                  <circle cx="138" cy="14" r="10" fill="none" stroke="#93c5fd" strokeWidth="2" opacity="0.8" />
                  <circle cx="222" cy="20" r="7" fill="#2dd4bf" opacity="0.9" />
                  {/* Dokumen miring dengan badge cek */}
                  <g transform="rotate(-8 118 50)" filter="url(#draftShadow)">
                    <rect x="86" y="12" width="62" height="76" rx="9" fill="url(#draftCardGrad)" stroke="#dbeafe" strokeWidth="1.2" />
                    <rect x="95" y="22" width="25" height="5.5" rx="2.75" fill="#2563eb" />
                    <rect x="95" y="35" width="45" height="3.5" rx="1.75" fill="#93c5fd" opacity="0.9" />
                    <rect x="95" y="43" width="37" height="3.5" rx="1.75" fill="#cbd5e1" />
                    <rect x="95" y="51" width="43" height="3.5" rx="1.75" fill="#cbd5e1" />
                    <rect x="95" y="59" width="27" height="3.5" rx="1.75" fill="#cbd5e1" />
                    <circle cx="134" cy="74" r="8" fill="#3b82f6" />
                    <path d="M130.8 74l2.1 2.1 4-4" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </g>
                </svg>
              </div>
            </div>

            {/* Jika ada draft, tampilkan tabel ringkas di dalam container */}
            {drafts.length > 0 && (
              <div className="mt-4 pt-3 border-t border-blue-200/50 overflow-x-auto">
                {lastRefresh && (
                  <p className="text-[10px] text-slate-400 mb-1 text-right">Last sync: {lastRefresh}</p>
                )}
                <table className="w-full text-xs min-w-[38rem] border-collapse">
                  <thead>
                    <tr className="text-left text-slate-500 font-semibold border-b border-blue-100">
                      <th className="pb-2 pr-4 whitespace-nowrap">Nomor</th>
                      <th className="pb-2 pr-4">Nama NPD / Rincian</th>
                      <th className="pb-2 pr-4 text-right whitespace-nowrap">Total Nominal</th>
                      <th className="pb-2 pr-4 text-center">Status</th>
                      <th className="pb-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-100/60">
                    {drafts.map((d) => (
                      <tr key={d.id} className="hover:bg-white/50 transition-colors">
                        <td className="py-2.5 pr-4 align-top font-mono font-medium text-slate-700 whitespace-nowrap">
                          {d.nomor_pengajuan || "—"}
                        </td>
                        <td className="py-2.5 pr-4 align-top min-w-0">
                          <p className="font-semibold text-slate-800 break-words" style={{ overflowWrap: "anywhere" }}>{d.nama_npd}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
                            {(d.pengajuan_items || []).length} uraian · {d.tanggal_pengajuan} · {bidangMap[d.bidang_id]?.nama || ""}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 align-top text-right font-medium tabular-nums text-slate-900 whitespace-nowrap">
                          {formatRupiah(d.total_nominal)}
                        </td>
                        <td className="py-2.5 pr-4 align-top text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                              d.status === "REVISI"
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-2.5 align-top text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end flex-nowrap">
                            <button
                              type="button"
                              onClick={() => editDraft(d)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 inline-flex items-center gap-1 transition-all"
                            >
                              <Pencil size={12} /> Ubah
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAjukan(d)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs inline-flex items-center gap-1 transition-all"
                            >
                              <Send size={12} /> Ajukan
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDelete(d)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                              title="Hapus draft"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ---------- FORM UTAMA: BUAT PENGAJUAN BARU ---------- */}
          <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-clean p-5 md:p-7">
            {/* Header Form */}
            <div className="flex items-center justify-between gap-3 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shadow-indigo-500/30 shrink-0">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingId ? `Ubah draft: ${editingNomor}` : "Buat pengajuan baru"}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Lengkapi informasi pengajuan NPD terlebih dahulu.
                  </p>
                </div>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-all"
                >
                  <X size={13} /> Batalkan mode ubah
                </button>
              )}
            </div>

            {/* Remark Revisi (jika dalam status revisi) */}
            {editingId && editingRemarks.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs">
                <p className="font-semibold text-amber-900">
                  Remark revisi dari admin ({editingRemarks.length}):
                </p>
                <ul className="mt-2 space-y-1 text-amber-800">
                  {editingRemarks.map((r) => (
                    <li key={r.id} className="leading-relaxed">
                      • {r.remark}
                      <span className="block text-[10px] text-amber-600">
                        {r.created_at ? new Date(r.created_at).toLocaleString("id-ID") : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {lockedByRevisi && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  Status masih <span className="font-semibold">REVISI</span> — nominal terkunci.{" "}
                  {isAdmin
                    ? "Kembalikan ke DRAFT dulu untuk memperbarui nominal."
                    : "Menunggu admin mengembalikan ke status DRAFT."}
                </p>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={kembalikanKeDraft}
                    disabled={converting}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all"
                  >
                    {converting ? "Memproses…" : "Kembalikan ke DRAFT"}
                  </button>
                )}
              </div>
            )}

            {noBidang && (
              <div className="mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                Akun Anda belum memiliki penugasan bidang. Hubungi admin untuk mengatur bidang di profiles.
              </div>
            )}

            <form onSubmit={handleSave} className="mt-5 space-y-5">
              {/* Grid 2 Kolom untuk Input */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                {/* Field: Bidang */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Bidang <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Building2
                      size={17}
                      className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    {isAdmin ? (
                      <select
                        value={form.bidang_id}
                        onChange={(e) => setField("bidang_id", e.target.value)}
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 outline-none appearance-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs"
                      >
                        <option value="">— Pilih bidang —</option>
                        {bidangList.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nama}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={bidangMap[profile?.bidang_id]?.nama || "—"}
                        disabled
                        title="Terkunci ke bidang Anda"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/70 bg-slate-50/80 text-sm text-slate-600 outline-none cursor-not-allowed"
                      />
                    )}
                    {isAdmin && (
                      <ChevronDown
                        size={16}
                        className="text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                    )}
                  </div>
                </div>

                {/* Field: Tahun Anggaran */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tahun anggaran <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Calendar
                      size={17}
                      className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <select
                      value={form.tahun}
                      onChange={(e) => setField("tahun", e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 outline-none appearance-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs"
                    >
                      <option value="2026">2026</option>
                      <option value="2025">2025</option>
                      <option value="2024">2024</option>
                    </select>
                    <ChevronDown
                      size={16}
                      className="text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                  </div>
                </div>

                {/* Field: Program */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Program <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Layers
                      size={17}
                      className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <select
                      value={pickProgram}
                      onChange={(e) => {
                        setPickProgram(e.target.value);
                        setPickKegiatan("");
                        if (items.length > 0) {
                          setItems([]);
                          setPickSub("");
                          setPickUraian("");
                          setPickNominal("");
                          setFormError("Program diganti — daftar item dikosongkan, silakan pilih ulang.");
                        }
                      }}
                      required
                      disabled={!activeBidangId}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 outline-none appearance-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">— Pilih program —</option>
                      {programOptions.map((p) => (
                        <option key={p.kode} value={p.kode}>
                          {p.kode} — {p.nama}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                  </div>
                </div>

                {/* Field: Kegiatan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Kegiatan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Layers
                      size={17}
                      className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <select
                      value={pickKegiatan}
                      onChange={(e) => {
                        setPickKegiatan(e.target.value);
                        if (items.length > 0) {
                          setItems([]);
                          setPickSub("");
                          setPickUraian("");
                          setPickNominal("");
                          setFormError("Kegiatan diganti — daftar item dikosongkan, silakan pilih ulang.");
                        }
                      }}
                      required
                      disabled={!activeBidangId || !pickProgram}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 outline-none appearance-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">— Pilih kegiatan —</option>
                      {kegiatanOptions.map((k) => (
                        <option key={k.kode} value={k.kode}>
                          {k.kode} — {k.nama}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                  </div>
                </div>

                {/* Field: Tanggal Pengajuan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tanggal pengajuan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <Calendar
                      size={17}
                      className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                      type="date"
                      value={form.tanggal_pengajuan}
                      onChange={(e) => setField("tanggal_pengajuan", e.target.value)}
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs"
                    />
                    <CalendarDays
                      size={17}
                      className="text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                  </div>
                </div>

                {/* Field: Nama / Nomor NPD */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nama / nomor NPD <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <FileText
                      size={17}
                      className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <input
                      value={form.nama_npd}
                      onChange={(e) => setField("nama_npd", e.target.value)}
                      required
                      placeholder="cth: NPD Belanja ATK Triwulan I"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs"
                    />
                  </div>
                </div>

                {/* Field: PTK penanda tangan NPD */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Pejabat Pelaksana Teknis Kegiatan (PTK)
                  </label>
                  <div className="relative flex items-center">
                    <UserCog
                      size={17}
                      className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                    <select
                      value={form.ptk_id}
                      onChange={(e) => setField("ptk_id", e.target.value)}
                      disabled={ptkOptions.length === 0}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200/90 bg-white text-sm text-slate-800 outline-none appearance-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-2xs disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">
                        {ptkOptions.length === 0
                          ? "— Belum ada data PTK —"
                          : "— Pilih PTK —"}
                      </option>
                      {ptkOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nama}
                          {p.nip ? ` — NIP ${p.nip}` : ""}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {ptkOptions.length === 0
                      ? "Admin belum mengisi master PTK untuk bidang ini — cetak NPD memakai nama akun pengaju."
                      : "Nama & NIP ini yang tercetak sebagai penanda tangan di NPD."}
                  </p>
                </div>
              </div>

              {/* ---------- SEKSI: TAMBAH URAIAN ---------- */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/80 via-blue-50/40 to-white p-4 md:p-5 mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-indigo-500/30">
                      <Layers size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-800">Tambah uraian</h3>
                        <span className="text-xs text-slate-400 font-normal">
                          1 NPD hanya 1 sub kegiatan.
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {!activeBidangId
                          ? "Pilih bidang dan tahun dulu untuk menambahkan uraian."
                          : !pickProgram
                          ? "Pilih program terlebih dahulu."
                          : !pickKegiatan
                          ? "Pilih kegiatan terlebih dahulu."
                          : isSubLocked
                          ? `Terkunci pada sub: ${lockedSub} — ${lockedSubName}`
                          : "Pilih sub kegiatan dan uraian belanja."}
                      </p>
                    </div>
                  </div>

                  {/* Tombol Tambah Uraian */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeBidangId) {
                        setFormError("Pilih bidang dan tahun terlebih dahulu.");
                        return;
                      }
                      if (!pickProgram) {
                        setFormError("Pilih program terlebih dahulu.");
                        return;
                      }
                      if (!pickKegiatan) {
                        setFormError("Pilih kegiatan terlebih dahulu.");
                        return;
                      }
                      setShowAddModal(true);
                      setSearchUraian("");
                      setSubModalError("");
                      setUraianModalError("");
                      setNominalError("");
                      setFormModalError("");
                    }}
                    disabled={!activeBidangId || !pickProgram || !pickKegiatan || lockedByRevisi}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-xs md:text-sm font-semibold shadow-md shadow-indigo-500/25 transition-all shrink-0"
                  >
                    <Plus size={16} />
                    <span>Tambah Uraian</span>
                  </button>
                </div>

                {/* Indikator Terkunci Sub Kegiatan */}
                {isSubLocked && (
                  <div className="mt-3 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600">
                    <div>
                      Sub kegiatan terpilih: <span className="font-semibold text-slate-900">{lockedSub}</span>
                      {lockedSubName && ` — ${lockedSubName}`}
                    </div>
                    <button
                      type="button"
                      onClick={gantiSub}
                      disabled={lockedByRevisi}
                      className="text-xs font-semibold text-indigo-600 hover:underline shrink-0"
                    >
                      Ganti Sub (Reset {items.length} item)
                    </button>
                  </div>
                )}

                {/* Tabel Uraian */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-xs md:text-sm min-w-[40rem]">
                    <thead>
                      <tr className="text-slate-400 font-semibold border-b border-slate-100">
                        <th className="py-2.5 px-3 text-left w-12">No</th>
                        <th className="py-2.5 px-3 text-left">Uraian</th>
                        <th className="py-2.5 px-3 text-right">Sisa (Rp)</th>
                        <th className="py-2.5 px-3 text-right w-48">Nominal (Rp)</th>
                        <th className="py-2.5 px-3 text-right w-20">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center">
                            <Inbox size={26} className="text-slate-300 mx-auto" />
                            <p className="text-sm font-semibold text-slate-700 mt-2.5">
                              Belum ada uraian
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Tambahkan minimal 1 uraian di atas.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        items.map((it, idx) => {
                          const over = Number(it.nominal) > Number(it.sisa);
                          return (
                            <tr
                              key={it.budget_line_id}
                              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="py-3 px-3 text-slate-500 font-medium">{idx + 1}</td>
                              <td className="py-3 px-3">
                                <span className="font-mono text-xs text-slate-500 font-semibold">
                                  {it.kode_uraian}
                                </span>
                                <p className="font-medium text-slate-800 leading-snug mt-0.5">
                                  {it.nama_uraian}
                                </p>
                                {it.kode_sub_kegiatan && (
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {it.kode_sub_kegiatan} · {it.nama_sub_kegiatan}
                                  </p>
                                )}
                                {over && (
                                  <span className="inline-flex items-center gap-1 text-rose-600 text-xs font-medium mt-1">
                                    <CircleAlert size={12} /> Melebihi sisa {formatRupiah(it.sisa)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums font-medium text-slate-600 whitespace-nowrap">
                                {formatRupiah(it.sisa)}
                              </td>
                              <td className="py-3 px-3 text-right">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={it.nominal ? Number(it.nominal).toLocaleString("id-ID") : ""}
                                  onChange={(e) => {
                                    const raw = e.target.value.replace(/\./g, "").replace(/,/g, "").replace(/\D/g, "");
                                    updateNominal(it.budget_line_id, raw);
                                  }}
                                  disabled={lockedByRevisi}
                                  className={`w-full px-3 py-1.5 rounded-lg border text-sm text-right tabular-nums outline-none transition-all ${
                                    over
                                      ? "border-rose-300 bg-rose-50 text-rose-800"
                                      : "border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  }`}
                                />
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setItems((list) =>
                                      list.filter((x) => x.budget_line_id !== it.budget_line_id)
                                    )
                                  }
                                  disabled={lockedByRevisi}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Hapus uraian"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {items.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-semibold">
                          <td colSpan={2} className="py-3 px-3 text-slate-700">
                            Total Belanja ({items.length} uraian)
                          </td>
                          <td />
                          <td className="py-3 px-3 text-right tabular-nums text-indigo-700 font-bold text-sm">
                            {formatRupiah(totalNominal)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Pesan Error Form */}
              {formError && (
                <div
                  role="alert"
                  className="text-xs md:text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2"
                >
                  <CircleAlert size={16} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Footer Aksi Form */}
              <div className="flex items-center justify-between pt-4">
                {/* Tombol Batal di Kiri Bawah */}
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs md:text-sm font-semibold shadow-2xs transition-all"
                >
                  <X size={16} />
                  <span>Batal</span>
                </button>

                {/* Tombol Simpan Draft di Kanan Bawah */}
                <button
                  type="submit"
                  disabled={saving || noBidang || lockedByRevisi}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs md:text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>{saving ? "Menyimpan…" : editingId ? "Simpan perubahan" : "Simpan draft"}</span>
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ---------- MODAL: TAMBAH URAIAN ---------- */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Pilih Uraian Belanja</h3>
                  <p className="text-xs text-slate-400">1 NPD hanya untuk 1 sub kegiatan</p>
                  {pickProgram && (
                    <p className="text-[11px] text-blue-600 font-medium mt-0.5">
                      Program: {programOptions.find((p) => p.kode === pickProgram)?.nama || pickProgram}
                      {pickKegiatan && ` — Kegiatan: ${kegiatanOptions.find((k) => k.kode === pickKegiatan)?.nama || pickKegiatan}`}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setSearchUraian(""); setSubModalError(""); setUraianModalError(""); setNominalError(""); setFormModalError(""); }}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs md:text-sm">
              {/* Sub Kegiatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sub kegiatan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={isSubLocked ? lockedSub : pickSub}
                  onChange={(e) => {
                    setPickSub(e.target.value);
                    setPickUraian("");
                    setSearchUraian("");
                    setSubModalError("");
                    setUraianModalError("");
                    setNominalError("");
                    setFormModalError("");
                  }}
                  disabled={isSubLocked || lockedByRevisi}
                  className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-slate-800 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500 ${
                    subModalError
                      ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  }`}
                >
                  <option value="">— Pilih sub kegiatan —</option>
                  {subOptions.map((s) => (
                    <option key={s.kode} value={s.kode}>
                      {s.kode} — {s.nama}
                    </option>
                  ))}
                </select>
                {subModalError && (
                  <p className="flex items-center gap-1.5 text-[12px] text-red-600 mt-1.5 animate-in fade-in slide-in-from-top-0.5 duration-150">
                    <CircleAlert size={14} className="shrink-0" />
                    {subModalError}
                  </p>
                )}
                {!subModalError && effectiveSub && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tersedia {uraianOptions.length} uraian pada sub ini.
                  </p>
                )}
              </div>

              {/* Uraian - Searchable */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Uraian belanja <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Search
                    size={15}
                    className="text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchUraian}
                    onChange={(e) => {
                      setSearchUraian(e.target.value);
                      if (pickUraian) {
                        setPickUraian("");
                      }
                      setUraianModalError("");
                    }}
                    disabled={!effectiveSub}
                    placeholder={effectiveSub ? "Ketik kode atau nama uraian…" : "Pilih sub kegiatan dulu"}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border bg-white text-slate-800 text-sm outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500 ${
                      uraianModalError
                        ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    }`}
                  />
                </div>
                {uraianModalError && (
                  <p className="flex items-center gap-1.5 text-[12px] text-red-600 mt-1.5 animate-in fade-in slide-in-from-top-0.5 duration-150">
                    <CircleAlert size={14} className="shrink-0" />
                    {uraianModalError}
                  </p>
                )}
                {pickUraian && !uraianModalError && (
                  <p className="text-[11px] text-blue-600 font-medium mt-1">
                    Dipilih: {uraianOptions.find((r) => r.budget_line_id === pickUraian)?.kode_uraian} — {uraianOptions.find((r) => r.budget_line_id === pickUraian)?.nama_uraian}
                    <button
                      type="button"
                      onClick={() => { setPickUraian(""); setSearchUraian(""); }}
                      className="ml-2 text-rose-500 hover:underline"
                    >
                      Ganti
                    </button>
                  </p>
                )}
                {!pickUraian && effectiveSub && searchUraian && (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
                    {uraianOptions.filter((r) => {
                      const q = searchUraian.toLowerCase();
                      return (
                        r.kode_uraian.toLowerCase().includes(q) ||
                        r.nama_uraian.toLowerCase().includes(q)
                      );
                    }).length === 0 ? (
                      <p className="px-3.5 py-3 text-xs text-slate-400 italic">Tidak ditemukan uraian yang cocok.</p>
                    ) : (
                      uraianOptions.filter((r) => {
                        const q = searchUraian.toLowerCase();
                        return (
                          r.kode_uraian.toLowerCase().includes(q) ||
                          r.nama_uraian.toLowerCase().includes(q)
                        );
                      }).map((r) => (
                        <button
                          key={r.budget_line_id}
                          type="button"
                          onClick={() => {
                            setPickUraian(r.budget_line_id);
                            setSearchUraian("");
                            setUraianModalError("");
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 transition-colors text-sm"
                        >
                          <span className="font-medium text-slate-800">{r.kode_uraian} — {r.nama_uraian}</span>
                          <span className="block text-[11px] text-slate-500 mt-0.5">
                            {Number(r.diproses || 0) > 0 && (
                              <span className="text-amber-600">Dalam proses: {formatRupiah(r.diproses)} · </span>
                            )}
                            Sisa: {formatRupiah(r.sisa)}
                            {(Number(r.angkas_s1 || 0) > 0 || Number(r.angkas_s2 || 0) > 0) && (
                              <span className="text-slate-400"> · Angkas S1 {formatRupiah(r.angkas_s1 || 0)} (sisa {formatRupiah(r.sisa_s1 ?? 0)}) · S2 efektif {formatRupiah(kuotaS2Efektif(r))} (sisa {formatRupiah(sisaS2Efektif({ ...r, sisa: r.sisa }))})</span>
                            )}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {!pickUraian && effectiveSub && !searchUraian && (
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100">
                    {uraianOptions.length === 0 ? (
                      <p className="px-3.5 py-3 text-xs text-slate-400 italic">Tidak ada uraian tersedia.</p>
                    ) : (
                      uraianOptions.map((r) => (
                        <button
                          key={r.budget_line_id}
                          type="button"
                          onClick={() => {
                            setPickUraian(r.budget_line_id);
                            setSearchUraian("");
                            setUraianModalError("");
                          }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50 transition-colors text-sm"
                        >
                          <span className="font-medium text-slate-800">{r.kode_uraian} — {r.nama_uraian}</span>
                          <span className="block text-[11px] text-slate-500 mt-0.5">
                            {Number(r.diproses || 0) > 0 && (
                              <span className="text-amber-600">Dalam proses: {formatRupiah(r.diproses)} · </span>
                            )}
                            Sisa: {formatRupiah(r.sisa)}
                            {(Number(r.angkas_s1 || 0) > 0 || Number(r.angkas_s2 || 0) > 0) && (
                              <span className="text-slate-400"> · Angkas S1 {formatRupiah(r.angkas_s1 || 0)} (sisa {formatRupiah(r.sisa_s1 ?? 0)}) · S2 efektif {formatRupiah(kuotaS2Efektif(r))} (sisa {formatRupiah(sisaS2Efektif({ ...r, sisa: r.sisa }))})</span>
                            )}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Sisa Pagu & Nominal */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Sisa pagu
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-semibold tabular-nums min-h-[42px] flex items-center">
                    {pickedRow ? formatRupiah(pickedRow.sisa) : "—"}
                  </div>
                  {pickedRow && Number(pickedRow.diproses || 0) > 0 && (
                    <p className="text-[11px] text-amber-600 font-medium mt-1.5">
                      Dalam proses: {formatRupiah(pickedRow.diproses)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nominal diajukan (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pickNominal ? Number(pickNominal).toLocaleString("id-ID") : ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\./g, "").replace(/,/g, "").replace(/\D/g, "");
                      setPickNominal(raw);
                      setNominalError("");
                    }}
                    placeholder="0"
                    className={`w-full px-3.5 py-2.5 rounded-xl border bg-white text-slate-800 tabular-nums outline-none transition-all ${
                      nominalError
                        ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    }`}
                  />
                  {nominalError && (
                    <p className="flex items-center gap-1.5 text-[12px] text-red-600 mt-1.5 animate-in fade-in slide-in-from-top-0.5 duration-150">
                      <CircleAlert size={14} className="shrink-0" />
                      {nominalError}
                    </p>
                  )}
                  {!nominalError && sisaSetelah !== null && (
                    <p className="text-[11px] text-emerald-600 font-medium mt-1.5">
                      Sisa setelah pengajuan: {formatRupiah(sisaSetelah)}
                    </p>
                  )}
                </div>
              </div>

              {/* Angkas semester uraian terpilih */}
              {pickedRow && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-700">
                      Angkas — {pickedRow.kode_uraian}
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Tanggal {form.tanggal_pengajuan || "—"} → Semester {formSemester} ({formSemester === 1 ? "Jan–Jun" : "Jul–Des"})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                    <div className={`rounded-xl border px-3 py-2.5 bg-white ${formSemester === 1 ? "border-sky-400 ring-1 ring-sky-200" : "border-slate-200"}`}>
                      <p className="text-[10px] font-bold tracking-wide text-sky-700">
                        SEMESTER 1 · JAN–JUN {formSemester === 1 && "● AKTIF"}
                      </p>
                      <p className="text-sm font-bold tabular-nums text-slate-900 mt-1">
                        {Number(pickedRow.angkas_s1 || 0) > 0 ? formatRupiah(pickedRow.angkas_s1) : <span className="text-slate-400 font-medium">Belum diatur</span>}
                      </p>
                      {Number(pickedRow.angkas_s1 || 0) > 0 && (
                        <p className={`text-[11px] tabular-nums mt-0.5 font-medium ${formSemester === 1 && pickedSisaSem !== null && nominalValue > pickedSisaSem ? "text-rose-600" : "text-slate-500"}`}>
                          Sisa: {formatRupiah(pickedRow.sisa_s1 ?? pickedRow.sisa)}
                        </p>
                      )}
                    </div>
                    <div className={`rounded-xl border px-3 py-2.5 bg-white ${formSemester === 2 ? "border-violet-400 ring-1 ring-violet-200" : "border-slate-200"}`}>
                      <p className="text-[10px] font-bold tracking-wide text-violet-700">
                        SEMESTER 2 · JUL–DES {formSemester === 2 && "● AKTIF"}
                      </p>
                      <p className="text-sm font-bold tabular-nums text-slate-900 mt-1">
                        {(Number(pickedRow.angkas_s1 || 0) > 0 || Number(pickedRow.angkas_s2 || 0) > 0)
                          ? formatRupiah(kuotaS2Efektif(pickedRow))
                          : <span className="text-slate-400 font-medium">Belum diatur</span>}
                      </p>
                      {(Number(pickedRow.angkas_s1 || 0) > 0 || Number(pickedRow.angkas_s2 || 0) > 0) && (
                        <>
                          <p className={`text-[11px] tabular-nums mt-0.5 font-medium ${formSemester === 2 && pickedSisaSem !== null && nominalValue > pickedSisaSem ? "text-rose-600" : "text-slate-500"}`}>
                            Sisa efektif: {formatRupiah(sisaS2Efektif(pickedRow))}
                          </p>
                          {pickedCarry > 0 && (
                            <p className="text-[10px] tabular-nums mt-0.5 text-emerald-600 font-medium">
                              Termasuk sisa S1 {formatRupiah(pickedCarry)}{Number(pickedRow.angkas_s2 || 0) > 0 ? "" : " (S2 belum diatur, memakai sisa S1)"}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {!(Number(pickedRow.angkas_s1 || 0) > 0 || Number(pickedRow.angkas_s2 || 0) > 0) && (
                    <p className="text-[11px] text-slate-400 mt-2">
                      Uraian ini belum punya batas angkas — hanya batas sisa pagu yang berlaku.
                    </p>
                  )}
                </div>
              )}
            </div>

            {formModalError && (
              <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 animate-in fade-in duration-150">
                <CircleAlert size={15} className="shrink-0" />
                <span>{formModalError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setShowAddModal(false); setSearchUraian(""); setSubModalError(""); setUraianModalError(""); setNominalError(""); setFormModalError(""); }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs md:text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={addItem}
                disabled={modalHasError}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-semibold shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Tambahkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- MODAL: LIHAT PANDUAN ---------- */}
      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 p-6 md:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Panduan Pengajuan NPD</h3>
                  <p className="text-xs text-slate-400">Dinas Kepemudaan dan Olahraga Kab. Bojonegoro</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Pilih Bidang, Periode, Program & Kegiatan</h4>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    Pengguna otomatis memilih bidang sesuai akun, sedangkan Administrator dapat memilih seluruh bidang. Pilih program dan kegiatan anggaran untuk memfilter sub kegiatan dan uraian.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Aturan 1 NPD = 1 Sub Kegiatan</h4>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    Setiap berkas NPD hanya diperbolehkan memuat satu sub kegiatan, namun dapat berisi beberapa uraian belanja dari sub kegiatan tersebut.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Validasi Sisa Pagu</h4>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    Nominal yang diajukan tidak boleh melampaui sisa pagu anggaran yang tersedia pada uraian belanja bersangkutan.
                    Bila uraian memakai Angkas, nominal juga tidak boleh melampaui sisa angkas semester tanggal pengajuan
                    (Semester 1: Januari–Juni, Semester 2: Juli–Desember) — kalau lebih, pengajuan diblokir.
                    Sisa angkas Semester 1 yang belum terpakai tetap bisa dipakai di Semester 2 (kuota S2 efektif = S2 + sisa S1).
                  </p>
                </div>
              </div>

              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0 text-xs">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-slate-900">Simpan Draft & Ajukan</h4>
                  <p className="text-slate-500 mt-0.5 leading-relaxed">
                    Klik <strong>Simpan draft</strong> untuk menyimpan draf ke database. Setelah seluruh uraian lengkap, klik tombol <strong>Ajukan</strong> di tabel draf untuk mengirimkan berkas verifikasi ke admin.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs md:text-sm font-semibold hover:bg-slate-800 transition-all"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- KONFIRMASI: AJUKAN KE ADMIN ---------- */}
      {confirmAjukan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">Ajukan NPD ke Admin?</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              <span className="font-mono font-semibold text-slate-800">
                {confirmAjukan.nomor_pengajuan}
              </span>{" "}
              — {confirmAjukan.nama_npd} ({formatRupiah(confirmAjukan.total_nominal)}).
              Setelah diajukan, data akan diverifikasi oleh admin dan tidak dapat diubah tanpa persetujuan revisi.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmAjukan(null)}
                disabled={ajukanBusy}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleAjukan}
                disabled={ajukanBusy}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60"
              >
                {ajukanBusy && <Loader2 size={14} className="animate-spin" />}
                <span>{ajukanBusy ? "Mengirim…" : "Ya, ajukan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- KONFIRMASI: HAPUS DRAFT ---------- */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base">Hapus draft ini?</h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              <span className="font-mono font-semibold text-slate-800">
                {confirmDelete.nomor_pengajuan}
              </span>{" "}
              — {confirmDelete.nama_npd}. Tindakan ini akan menghapus draf pengajuan secara permanen.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteDraft}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs disabled:opacity-60"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                <span>{deleting ? "Menghapus…" : "Ya, hapus"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
