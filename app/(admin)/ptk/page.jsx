"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  UserCog,
  Search,
  Building2,
  CircleAlert,
  CheckCircle2,
  Power,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { ptkSchema } from "@/lib/validation";

const JABATAN_DEFAULT = "Pejabat Pelaksana Teknis Kegiatan";

const EMPTY_FORM = {
  bidang_id: "",
  nama: "",
  nip: "",
  jabatan: JABATAN_DEFAULT,
  aktif: true,
};

export default function PtkPage() {
  const [supabaseOk, setSupabaseOk] = useState(true);
  const [profile, setProfile] = useState(null);
  const [bidangList, setBidangList] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tableMissing, setTableMissing] = useState(false);

  const [filterBidang, setFilterBidang] = useState("semua");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionMsg, setActionMsg] = useState({ type: "", text: "" });

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
    setTableMissing(false);
    try {
      const supabase = getClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

      const { data: ptkData, error: ptkErr } = await supabase
        .from("ptk")
        .select("id, bidang_id, nama, nip, jabatan, aktif, created_at")
        .order("nama");
      if (ptkErr) {
        // Tabel belum ada -> migration_012 belum dijalankan.
        if (ptkErr.code === "42P01" || /ptk/i.test(ptkErr.message || "")) {
          setTableMissing(true);
          setRows([]);
          return;
        }
        throw ptkErr;
      }
      setRows(ptkData || []);

      if (prof?.role !== "admin" && prof?.bidang_id) {
        setFilterBidang(prof.bidang_id);
      }
    } catch (err) {
      if (/belum diisi|NEXT_PUBLIC/i.test(err.message || "")) {
        setSupabaseOk(false);
      } else {
        setLoadError(err.message || "Gagal memuat data PTK.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeBidang = isAdmin ? filterBidang : profile?.bidang_id || "semua";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeBidang !== "semua" && r.bidang_id !== activeBidang) return false;
      if (!q) return true;
      const hay = [r.nama, r.nip, r.jabatan, bidangMap[r.bidang_id]?.nama]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, activeBidang, search, bidangMap]);

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openAdd() {
    setEditingId(null);
    setFormError("");
    setActionMsg({ type: "", text: "" });
    setForm({
      ...EMPTY_FORM,
      bidang_id: isAdmin
        ? filterBidang !== "semua"
          ? filterBidang
          : ""
        : profile?.bidang_id || "",
    });
    setShowForm(true);
  }

  function openEdit(row) {
    setEditingId(row.id);
    setFormError("");
    setActionMsg({ type: "", text: "" });
    setForm({
      bidang_id: row.bidang_id || "",
      nama: row.nama || "",
      nip: row.nip || "",
      jabatan: row.jabatan || JABATAN_DEFAULT,
      aktif: row.aktif !== false,
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    if (!isAdmin) {
      setFormError("Hanya admin yang bisa menambah/mengubah data PTK.");
      return;
    }
    const parsed = ptkSchema.safeParse({
      bidang_id: form.bidang_id,
      nama: form.nama,
      nip: form.nip || "",
      jabatan: form.jabatan || JABATAN_DEFAULT,
      aktif: form.aktif,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || "Form belum valid.");
      return;
    }
    setSaving(true);
    try {
      const supabase = getClient();
      const payload = {
        bidang_id: parsed.data.bidang_id,
        nama: parsed.data.nama,
        nip: parsed.data.nip || "",
        jabatan: parsed.data.jabatan || JABATAN_DEFAULT,
        aktif: parsed.data.aktif,
      };
      if (editingId) {
        const { error } = await supabase
          .from("ptk")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
        setActionMsg({
          type: "ok",
          text: `Data PPTK ${payload.nama} tersimpan.`,
        });
      } else {
        const { error } = await supabase.from("ptk").insert(payload);
        if (error) {
          if (error.code === "23505") {
            throw new Error("PTK dengan nama tersebut sudah ada di bidang ini.");
          }
          throw error;
        }
        setActionMsg({ type: "ok", text: `PTK ${payload.nama} ditambahkan.` });
      }
      setShowForm(false);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setFormError(err.message || "Gagal menyimpan data PTK.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAktif(row) {
    setActionMsg({ type: "", text: "" });
    try {
      const supabase = getClient();
      const { error } = await supabase
        .from("ptk")
        .update({ aktif: !row.aktif })
        .eq("id", row.id);
      if (error) throw error;
      setRows((list) =>
        list.map((r) => (r.id === row.id ? { ...r, aktif: !row.aktif } : r))
      );
      setActionMsg({
        type: "ok",
        text: `${row.nama} ${row.aktif ? "dinonaktifkan" : "diaktifkan"}.`,
      });
    } catch (err) {
      setActionMsg({
        type: "err",
        text: err.message || "Gagal mengubah status.",
      });
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const supabase = getClient();
      const { error } = await supabase
        .from("ptk")
        .delete()
        .eq("id", confirmDelete.id);
      if (error) throw error;
      setRows((list) => list.filter((r) => r.id !== confirmDelete.id));
      setActionMsg({ type: "ok", text: `PTK ${confirmDelete.nama} dihapus.` });
      setConfirmDelete(null);
    } catch (err) {
      setActionMsg({
        type: "err",
        text: err.message || "Gagal menghapus data.",
      });
    } finally {
      setDeleting(false);
    }
  }

  /* ── Supabase belum dikonfigurasi ── */
  if (!supabaseOk) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-indigo-600">Master data</p>
        <h1 className="text-2xl font-bold tracking-tight mt-1">Data PPTK</h1>
        <div className="mt-6 rounded-2xl bg-white border border-amber-200/70 p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h2 className="font-semibold text-amber-900">
            Database belum terhubung
          </h2>
          <p className="text-sm text-slate-600 mt-1.5">
            Isi{" "}
            <code className="font-mono text-[13px] bg-amber-50 px-1.5 py-0.5 rounded">
              .env.local
            </code>{" "}
            lalu restart{" "}
            <code className="font-mono text-[13px] bg-amber-50 px-1.5 py-0.5 rounded">
              npm run dev
            </code>
            .
          </p>
        </div>
      </div>
    );
  }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-40 rounded skeleton" />
          <div className="h-4 w-96 rounded skeleton mt-2 max-w-full" />
        </div>
        <div className="rounded-2xl border border-slate-200/60 bg-white p-5">
          <div className="h-5 w-52 rounded skeleton" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 rounded skeleton mt-3" />
          ))}
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (loadError) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-2xl bg-white border border-rose-200/70 p-8 text-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <CircleAlert size={38} className="mx-auto text-rose-400 mb-3" />
          <h2 className="font-semibold text-slate-800 text-lg">
            Gagal memuat data PTK
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">{loadError}</p>
          <button
            type="button"
            onClick={() => loadAll()}
            className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-glow hover:shadow-lg transition-all inline-flex items-center gap-2"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">Master data</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Data PPTK
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1 max-w-3xl">
            Pejabat Pelaksana Teknis Kegiatan per bidang. Nama &amp; NIP di sini
            dipakai otomatis sebagai penanda tangan pada cetak NPD.
            {isAdmin
              ? " Anda admin — bisa tambah/ubah/hapus."
              : " Mode baca — Anda hanya melihat PTK bidang Anda."}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-95 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <Plus size={15} />
            Tambah PTK
          </button>
        )}
      </div>

      {/* ── Notifikasi ── */}
      {tableMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[13px] font-semibold text-amber-900">
            Tabel <code className="font-mono">ptk</code> belum ada.
          </p>
          <p className="text-[13px] text-amber-800 mt-1">
            Jalankan{" "}
            <code className="font-mono text-[12px] bg-white/70 px-1.5 py-0.5 rounded">
              supabase/migration_012_ptk.sql
            </code>{" "}
            di Supabase SQL Editor, lalu muat ulang halaman ini.
          </p>
        </div>
      )}
      {actionMsg.text && (
        <p
          role="status"
          className={`text-[13px] rounded-xl px-3.5 py-2.5 border flex items-start gap-2 ${
            actionMsg.type === "err"
              ? "text-rose-700 bg-rose-50 border-rose-200"
              : "text-emerald-800 bg-emerald-50 border-emerald-200"
          }`}
        >
          {actionMsg.type === "err" ? (
            <CircleAlert size={15} className="mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          )}
          <span>{actionMsg.text}</span>
        </p>
      )}

      {/* ── Filter bar ── */}
      <div className="rounded-2xl bg-white border border-slate-100 p-3 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#f8fafc] border border-slate-200/70">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama PTK / NIP..."
            className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
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
      </div>

      {/* ── Tabel PTK ── */}
      <section
        className="rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden"
        aria-label="Daftar PTK"
      >
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0">
            <UserCog size={18} strokeWidth={2.2} />
          </div>
          <div>
            <h2 className="font-bold text-[15px] text-slate-900 leading-tight">
              Pejabat Pelaksana Teknis Kegiatan
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-tight">
              Total {filtered.length} PTK
              {activeBidang !== "semua" && bidangMap[activeBidang]
                ? ` · ${bidangMap[activeBidang].nama}`
                : ""}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar border-t border-slate-100">
          <table className="w-full text-xs min-w-[52rem]">
            <thead>
              <tr className="text-left text-[11px] font-semibold text-slate-500 border-b border-slate-100 bg-slate-50/70">
                <th className="px-5 py-3 w-8">#</th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">NIP</th>
                <th className="px-4 py-3">Jabatan</th>
                <th className="px-4 py-3">Bidang</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <UserCog size={36} className="mx-auto text-slate-300 mb-3" />
                    <p className="font-medium text-slate-600">
                      Belum ada data PTK
                    </p>
                    <p className="text-[13px] text-slate-400 mt-1">
                      {isAdmin
                        ? "Klik “Tambah PTK” untuk mengisi nama & NIP penanda tangan NPD."
                        : "Minta admin menambahkan data PTK bidang Anda."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => (
                  <tr
                    key={r.id}
                    className="border-t border-slate-50 hover:bg-blue-50/20 transition-colors"
                  >
                    <td className="px-5 py-3 text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-slate-800">
                        {r.nama}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-slate-700 whitespace-nowrap">
                      {r.nip || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.jabatan || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {bidangMap[r.bidang_id]?.nama || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          r.aktif
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                        }`}
                      >
                        {r.aktif ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleAktif(r)}
                            title={r.aktif ? "Nonaktifkan" : "Aktifkan"}
                            aria-label={r.aktif ? "Nonaktifkan" : "Aktifkan"}
                            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                          >
                            <Power size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(r)}
                            title="Ubah"
                            aria-label={`Ubah ${r.nama}`}
                            className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(r)}
                            title="Hapus"
                            aria-label={`Hapus ${r.nama}`}
                            className="p-2 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- MODAL: TAMBAH / UBAH PTK ---------- */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Ubah data PTK" : "Tambah data PTK"}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <UserCog size={17} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {editingId ? "Ubah data PTK" : "Tambah data PTK"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Nama &amp; NIP dipakai pada cetak NPD
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                aria-label="Tutup"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formError && (
                <p
                  role="alert"
                  className="text-[13px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2"
                >
                  <CircleAlert size={15} className="mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Bidang <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.bidang_id}
                  onChange={(e) => setField("bidang_id", e.target.value)}
                  disabled={!isAdmin}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">— Pilih bidang —</option>
                  {bidangList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nama}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nama PTK <span className="text-rose-500">*</span>
                </label>
                <input
                  value={form.nama}
                  onChange={(e) => setField("nama", e.target.value)}
                  required
                  placeholder="cth: DENNI JAMRUDINAVIA, S.IP., MM"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  NIP
                </label>
                <input
                  value={form.nip}
                  onChange={(e) => setField("nip", e.target.value)}
                  placeholder="cth: 19810604 201001 2 001"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-mono text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Tulis sesuai dokumen resmi (boleh pakai spasi).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Jabatan
                </label>
                <input
                  value={form.jabatan}
                  onChange={(e) => setField("jabatan", e.target.value)}
                  placeholder={JABATAN_DEFAULT}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>

              <label className="flex items-center gap-2.5 text-[13px] text-slate-700">
                <input
                  type="checkbox"
                  checked={form.aktif}
                  onChange={(e) => setField("aktif", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                />
                Aktif (muncul di pilihan pengajuan NPD)
              </label>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-glow hover:shadow-lg disabled:opacity-50 transition-all"
                >
                  {saving && <Loader2 size={15} className="animate-spin" />}
                  {saving ? "Menyimpan…" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- MODAL: KONFIRMASI HAPUS ---------- */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi hapus PTK"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Hapus data PTK?</h2>
                <p className="text-[13px] text-slate-600 mt-1.5">
                  <span className="font-semibold">{confirmDelete.nama}</span>
                  {confirmDelete.nip ? ` (NIP ${confirmDelete.nip})` : ""} akan
                  dihapus permanen. NPD lama tetap tersimpan, tetapi tanda
                  tangan cetaknya tidak lagi terisi otomatis.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-50 transition-all"
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
