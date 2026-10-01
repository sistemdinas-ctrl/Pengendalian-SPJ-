"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  PiggyBank,
  Percent,
  Search,
  FileText,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Users,
  Mountain,
  Building2,
  SearchX,
  DatabaseZap,
  Loader2,
  WalletCards,
  Activity,
  Layers,
  Calendar,
  Clock,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { formatRupiah, persenRealisasi, STATUS_META } from "@/lib/domain";
import { useCountUp, StaggerContainer, StaggerItem } from "@/components/Motion";

const GROUP_PAGE_SIZE = 10;

const STATUS_TONE = {
  DRAFT: "bg-slate-100 text-slate-600",
  DIAJUKAN: "bg-blue-100 text-blue-700",
  DIPROSES: "bg-indigo-100 text-indigo-700",
  REVISI: "bg-amber-100 text-amber-800",
  SIAP_DICAIRKAN: "bg-cyan-100 text-cyan-800",
  CAIR: "bg-emerald-100 text-emerald-700",
  SELESAI: "bg-emerald-600 text-white",
  DITOLAK: "bg-rose-100 text-rose-700",
};

const STATUS_ORDER = [
  "DRAFT",
  "DIAJUKAN",
  "DIPROSES",
  "REVISI",
  "SIAP_DICAIRKAN",
  "CAIR",
  "SELESAI",
  "DITOLAK",
];

const BIDANG_ICONS = {
  Keolahragaan: Activity,
  Kepemudaan: Users,
  Kepramukaan: Mountain,
  Sekretariat: Building2,
};

const BIDANG_THEMES = {
  Keolahragaan: {
    card: "from-sky-50 via-blue-50 to-indigo-100",
    border: "border-blue-100",
    iconBg: "bg-sky-100 text-sky-600",
    badge: "bg-white/70 text-sky-700 border-sky-200",
    bar: "bg-sky-500",
  },
  Kepemudaan: {
    card: "from-violet-50 via-purple-50 to-fuchsia-100",
    border: "border-violet-100",
    iconBg: "bg-violet-100 text-violet-600",
    badge: "bg-white/70 text-violet-700 border-violet-200",
    bar: "bg-violet-500",
  },
  Kepramukaan: {
    card: "from-emerald-50 via-teal-50 to-cyan-100",
    border: "border-emerald-100",
    iconBg: "bg-emerald-100 text-emerald-600",
    badge: "bg-white/70 text-emerald-700 border-emerald-200",
    bar: "bg-emerald-500",
  },
  Sekretariat: {
    card: "from-amber-50 via-orange-50 to-rose-100",
    border: "border-orange-100",
    iconBg: "bg-amber-100 text-amber-600",
    badge: "bg-white/70 text-orange-700 border-orange-200",
    bar: "bg-orange-500",
  },
};

/* ──────────────────────────────
   Decorative KPI Graphics
   ────────────────────────────── */
function KpiWaveBlue() {
  return (
    <div className="absolute bottom-0 right-0 w-32 h-14 pointer-events-none overflow-hidden select-none">
      <svg viewBox="0 0 120 50" fill="none" className="w-full h-full">
        <path
          d="M0 45 C30 35, 60 48, 85 30 C105 15, 115 25, 130 18 L130 50 L0 50 Z"
          fill="#bfdbfe"
          fillOpacity="0.45"
        />
        <path
          d="M10 50 C40 38, 75 42, 95 24 C110 10, 120 20, 130 12 L130 50 Z"
          fill="#93c5fd"
          fillOpacity="0.35"
        />
      </svg>
    </div>
  );
}

function KpiMiniBars() {
  return (
    <div className="absolute bottom-3 right-4 flex items-end gap-1 pointer-events-none select-none">
      <div className="w-1.5 h-3 bg-emerald-400/80 rounded-full" />
      <div className="w-1.5 h-5 bg-emerald-400/90 rounded-full" />
      <div className="w-1.5 h-4 bg-emerald-400/80 rounded-full" />
      <div className="w-1.5 h-7 bg-emerald-500/95 rounded-full" />
      <div className="w-1.5 h-9 bg-emerald-400 rounded-full" />
    </div>
  );
}

function KpiWavePurple() {
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

/* ──────────────────────────────
   KPI Card Component
   ────────────────────────────── */
function KpiCard({
  label,
  rawValue,
  displayValue,
  Icon,
  iconBg,
  delay = 0,
  badgeText,
  subtextPrimary,
  subtextSecondary,
  decoration,
  children,
}) {
  const count = useCountUp(rawValue, 900);
  const isCurrency = label !== "Persentase Realisasi" && label !== "% Realisasi";
  const formatted = isCurrency
    ? `Rp ${count.toLocaleString("id-ID")}`
    : `${count.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="relative rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-5 overflow-hidden transition-all duration-300 hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between relative z-0">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
          style={{ boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)" }}
        >
          <Icon size={20} strokeWidth={2.2} className="text-white" />
        </div>
        {badgeText && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
            {badgeText}
          </span>
        )}
      </div>

      <div className="mt-3 relative z-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl lg:text-[22px] font-bold tabular-nums tracking-tight text-slate-900 mt-1 leading-tight">
          {isCurrency ? formatted : displayValue}
        </p>

        <div className="mt-2.5 text-[11px] flex flex-col gap-0.5">
          {subtextPrimary && (
            <span
              className={`font-semibold ${
                label === "Sisa Anggaran"
                  ? "text-purple-600"
                  : label === "Realisasi" || label === "Total Pagu"
                  ? "text-emerald-600"
                  : "text-slate-600"
              }`}
            >
              {subtextPrimary}
            </span>
          )}
          {subtextSecondary && (
            <span className="text-slate-400 leading-tight">
              {subtextSecondary}
            </span>
          )}
        </div>
      </div>

      {children}
      {decoration}
    </motion.div>
  );
}

/* ──────────────────────────────
   Bidang Card Component
   ────────────────────────────── */
function BidangCard({ bidang, delay = 0 }) {
  const Icon = BIDANG_ICONS[bidang.nama] || Building2;
  const theme = BIDANG_THEMES[bidang.nama] || {
    card: "from-slate-50 via-blue-50 to-indigo-100",
    border: "border-slate-200",
    iconBg: "bg-blue-100 text-blue-600",
    badge: "bg-white/70 text-blue-700 border-blue-200",
    bar: "bg-blue-500",
  };
  const persenFormatted = Number(bidang.persen || 0).toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`rounded-2xl border ${theme.border} bg-gradient-to-br ${theme.card} p-5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-shadow duration-300 hover:shadow-md relative overflow-hidden`}
    >
      {/* decorative glow */}
      <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/60 blur-2xl pointer-events-none" />

      {/* Top row: Icon, Name + Value, and Badge */}
      <div className="flex items-start justify-between gap-2 relative">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme.iconBg}`}
          >
            <Icon size={19} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-700 truncate leading-none">
              {bidang.nama}
            </p>
            <p
              title={formatRupiah(bidang.pagu)}
              className="text-base font-extrabold text-slate-900 tabular-nums mt-1.5 leading-tight break-all"
            >
              {formatRupiah(bidang.pagu)}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${theme.badge}`}
        >
          {Number(bidang.persen || 0) === 0 ? "0%" : `${persenFormatted}%`}
        </span>
      </div>

      {/* Progress line with thumb indicator */}
      <div className="h-2 bg-slate-900/10 rounded-full my-4 relative overflow-visible">
        <div
          className={`h-full rounded-full ${theme.bar}`}
          style={{ width: `${Math.max(1.5, Math.min(100, bidang.persen || 0))}%` }}
        />
        <div
          className={`w-3 h-3 rounded-full ring-2 ring-white absolute top-1/2 -translate-y-1/2 ${theme.bar}`}
          style={{
            left: `calc(${Math.max(1.5, Math.min(100, bidang.persen || 0))}% - 6px)`,
          }}
        />
      </div>

      {/* 3-Column Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 text-left border-t border-slate-900/10 relative">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Pagu</p>
          <p
            title={formatRupiah(bidang.pagu)}
            className="text-[13px] font-extrabold text-slate-900 tabular-nums mt-1 break-all leading-tight"
          >
            {formatRupiah(bidang.pagu)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Realisasi</p>
          <p
            title={formatRupiah(bidang.realisasi)}
            className="text-[13px] font-extrabold text-slate-900 tabular-nums mt-1 break-all leading-tight"
          >
            {formatRupiah(bidang.realisasi)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Sisa</p>
          <p
            title={formatRupiah(bidang.sisa)}
            className="text-[13px] font-extrabold text-slate-900 tabular-nums mt-1 break-all leading-tight"
          >
            {formatRupiah(bidang.sisa)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────
   Grafik Realisasi per Bulan
   ────────────────────────────── */
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

// Format ringkas untuk sumbu & tooltip: 1,2 M / 850 jt / 400 rb
function shortRp(n) {
  const v = Number(n || 0);
  if (v >= 1e9) {
    const s = (v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 });
    return `Rp ${s} M`;
  }
  if (v >= 1e6) {
    const s = (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 });
    return `Rp ${s} jt`;
  }
  if (v >= 1e3) {
    const s = (v / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 1 });
    return `Rp ${s} rb`;
  }
  return `Rp ${v.toLocaleString("id-ID")}`;
}

function MonthlyChart({ monthly, year, angkasS1, angkasS2 }) {
  const max = Math.max(...monthly, 0);
  const total = monthly.reduce((a, n) => a + n, 0);
  const s1 = monthly.slice(0, 6).reduce((a, n) => a + n, 0);
  const s2 = monthly.slice(6).reduce((a, n) => a + n, 0);
  const best = monthly.indexOf(max);
  const avg = total / 12;
  const ticks = [1, 0.75, 0.5, 0.25].map((f) => max * f);

  return (
    <div>
      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Total {year}</p>
          <p className="text-base font-extrabold tabular-nums text-slate-900 mt-0.5 truncate" title={formatRupiah(total)}>
            {shortRp(total)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Rata-rata / bulan</p>
          <p className="text-base font-extrabold tabular-nums text-slate-900 mt-0.5 truncate" title={formatRupiah(avg)}>
            {shortRp(avg)}
          </p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-sky-600 uppercase tracking-wide">Semester 1 · Jan–Jun</p>
          <p className="text-base font-extrabold tabular-nums text-sky-800 mt-0.5 truncate" title={formatRupiah(s1)}>
            {shortRp(s1)}
          </p>
          {angkasS1 > 0 && (
            <div className="h-1.5 rounded-full bg-sky-100 mt-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (s1 / angkasS1) * 100)}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-sky-500"
              />
            </div>
          )}
          {angkasS1 > 0 && (
            <p className="text-[10px] tabular-nums text-sky-600 mt-1">
              dari kuota {shortRp(angkasS1)}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3.5 py-2.5">
          <p className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide">Semester 2 · Jul–Des</p>
          <p className="text-base font-extrabold tabular-nums text-violet-800 mt-0.5 truncate" title={formatRupiah(s2)}>
            {shortRp(s2)}
          </p>
          {angkasS2 > 0 && (
            <div className="h-1.5 rounded-full bg-violet-100 mt-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (s2 / angkasS2) * 100)}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="h-full rounded-full bg-violet-500"
              />
            </div>
          )}
          {angkasS2 > 0 && (
            <p className="text-[10px] tabular-nums text-violet-600 mt-1">
              dari kuota {shortRp(angkasS2)}
            </p>
          )}
        </div>
      </div>

      {/* Area grafik */}
      {total === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center">
          <TrendingUp size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-[13px] font-semibold text-slate-500">Belum ada pencairan pada tahun {year}</p>
          <p className="text-xs text-slate-400 mt-0.5">Grafik terisi otomatis setelah ada pengajuan yang dicairkan.</p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="relative">
            {/* Latar semester S1 / S2 */}
            <div className="absolute inset-0 flex rounded-xl overflow-hidden pointer-events-none" aria-hidden>
              <div className="w-1/2 bg-sky-50/50 border-r border-dashed border-sky-200" />
              <div className="w-1/2 bg-violet-50/50" />
            </div>
            <div className="absolute top-1.5 left-3 text-[10px] font-bold text-sky-400 pointer-events-none" aria-hidden>
              S1
            </div>
            <div className="absolute top-1.5 right-3 text-[10px] font-bold text-violet-400 pointer-events-none" aria-hidden>
              S2
            </div>

            <div className="relative flex gap-3 pl-12 pr-2 pt-7">
              {/* Sumbu Y */}
              <div className="absolute left-0 top-7 bottom-6 w-10 flex flex-col justify-between text-right" aria-hidden>
                {ticks.map((t, i) => (
                  <span key={i} className="text-[10px] tabular-nums text-slate-400 leading-none">
                    {shortRp(t).replace("Rp ", "")}
                  </span>
                ))}
              </div>

              {/* Batang per bulan */}
              {monthly.map((v, i) => {
                const h = max > 0 ? Math.max(v > 0 ? 4 : 0, (v / max) * 100) : 0;
                const isS1 = i < 6;
                const isBest = v === max && max > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group min-w-0">
                    <div className="relative w-full h-44 sm:h-52 flex items-end justify-center">
                      {/* Tooltip */}
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold tabular-nums text-white shadow-lg">
                        {MONTH_LABELS[i]} {year}: {formatRupiah(v)}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                      </div>
                      {/* Grid line */}
                      <div className="absolute inset-x-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none" aria-hidden>
                        {[0, 1, 2, 3].map((g) => (
                          <div key={g} className="border-t border-slate-100" />
                        ))}
                      </div>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ duration: 0.6, delay: i * 0.04, ease: [0.25, 0.46, 0.45, 0.94] }}
                        title={`${MONTH_LABELS[i]}: ${formatRupiah(v)}`}
                        className={`relative w-full max-w-10 rounded-t-lg cursor-default transition-all duration-150 group-hover:brightness-110 group-hover:saturate-150 ${
                          isBest
                            ? "bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-300 shadow-[0_4px_14px_rgba(16,185,129,0.35)]"
                            : isS1
                            ? "bg-gradient-to-t from-sky-600 via-sky-500 to-sky-300"
                            : "bg-gradient-to-t from-violet-600 via-violet-500 to-purple-300"
                        }`}
                      >
                        {isBest && (
                          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-500 text-white whitespace-nowrap">
                            TOP
                          </span>
                        )}
                      </motion.div>
                    </div>
                    <span className={`text-[10px] sm:text-[11px] font-semibold ${i === best && max > 0 ? "text-emerald-600" : "text-slate-400"}`}>
                      {MONTH_LABELS[i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-sky-600 to-sky-300" /> S1 · Jan–Jun
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-violet-600 to-purple-300" /> S2 · Jul–Des
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-t from-emerald-600 to-teal-300" /> Bulan tertinggi
            </span>
            <span className="ml-auto text-[11px] text-slate-400">
              Bulan tertinggi: <span className="font-bold text-slate-600">{MONTH_LABELS[best]} · {shortRp(max)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────
   Main Dashboard
   ────────────────────────────── */
export default function DashboardPage() {
  const [supabaseOk, setSupabaseOk] = useState(true);
  const [profile, setProfile] = useState(null);
  const [bidangList, setBidangList] = useState([]);
  const [rows, setRows] = useState([]);
  const [pengajuan, setPengajuan] = useState([]);
  const [disb, setDisb] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filterBidang, setFilterBidang] = useState("semua");
  const [filterTahun, setFilterTahun] = useState("semua");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [collapsed, setCollapsed] = useState({});

  const isAdmin = profile?.role === "admin";
  const bidangMap = useMemo(
    () => Object.fromEntries(bidangList.map((b) => [b.id, b])),
    [bidangList]
  );
  const activeBidang = isAdmin ? filterBidang : profile?.bidang_id || "semua";

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

      const { data: realData, error: realErr } = await supabase
        .from("v_budget_realisasi")
        .select("*")
        .order("kode_sub_kegiatan")
        .order("kode_uraian")
        .limit(5000);
      if (realErr) throw realErr;
      setRows(realData || []);

      const { data: pengData, error: pengErr } = await supabase
        .from("pengajuan")
        .select("status, bidang_id, total_nominal")
        .limit(5000);
      if (pengErr) throw pengErr;
      setPengajuan(pengData || []);

      // Pencairan untuk grafik realisasi per bulan (ikut filter bidang via join pengajuan).
      // Bungkus try/catch sendiri agar grafik kosong saja bila gagal, dashboard tetap tampil.
      try {
        const { data: disbData, error: disbErr } = await supabase
          .from("disbursements")
          .select("nominal, dicairkan_at, pengajuan:pengajuan_id(bidang_id)")
          .order("dicairkan_at")
          .limit(5000);
        if (disbErr) throw disbErr;
        setDisb(disbData || []);
      } catch {
        setDisb([]);
      }

      if (prof?.role !== "admin" && prof?.bidang_id) {
        setFilterBidang(prof.bidang_id);
      }
    } catch (err) {
      if (/belum diisi|NEXT_PUBLIC/i.test(err.message || "")) {
        setSupabaseOk(false);
      } else {
        setLoadError(err.message || "Gagal memuat dashboard.");
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

  const tahunList = useMemo(() => {
    const set = new Set(rows.map((r) => String(r.tahun)).filter(Boolean));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [rows]);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      if (activeBidang !== "semua" && r.bidang_id !== activeBidang) return false;
      if (filterTahun !== "semua" && String(r.tahun) !== String(filterTahun))
        return false;
      return true;
    });
  }, [rows, activeBidang, filterTahun]);

  const totals = useMemo(() => {
    const pagu = visibleRows.reduce((a, r) => a + Number(r.pagu || 0), 0);
    const realisasi = visibleRows.reduce(
      (a, r) => a + Number(r.realisasi || 0),
      0
    );
    const diproses = visibleRows.reduce(
      (a, r) => a + Number(r.diproses || 0),
      0
    );
    return {
      pagu,
      realisasi,
      diproses,
      sisa: pagu - realisasi - diproses,
      persen: persenRealisasi(realisasi, pagu),
    };
  }, [visibleRows]);

  // Total pagu yang sedang diproses (DIAJUKAN / DIPROSES / SIAP_DICAIRKAN).
  const paguDiproses = useMemo(() => {
    const statusProses = new Set(["DIAJUKAN", "DIPROSES", "SIAP_DICAIRKAN"]);
    return pengajuan
      .filter((p) => statusProses.has(p.status))
      .reduce((a, p) => a + Number(p.total_nominal || 0), 0);
  }, [pengajuan]);

  const perBidang = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (filterTahun !== "semua" && String(r.tahun) !== String(filterTahun))
        continue;
      if (!isAdmin && r.bidang_id !== profile?.bidang_id) continue;
      if (!map.has(r.bidang_id)) {
        map.set(r.bidang_id, {
          bidang_id: r.bidang_id,
          nama: bidangMap[r.bidang_id]?.nama || "—",
          pagu: 0,
          realisasi: 0,
        });
      }
      const e = map.get(r.bidang_id);
      e.pagu += Number(r.pagu || 0);
      e.realisasi += Number(r.realisasi || 0);
    }
    return [...map.values()]
      .map((e) => ({
        ...e,
        sisa: e.pagu - e.realisasi,
        persen: persenRealisasi(e.realisasi, e.pagu),
      }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [rows, filterTahun, isAdmin, profile?.bidang_id, bidangMap]);

  const statusCounts = useMemo(() => {
    const counts = {};
    for (const p of pengajuan) {
      if (isAdmin && activeBidang !== "semua" && p.bidang_id !== activeBidang)
        continue;
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [pengajuan, isAdmin, activeBidang]);

  const totalPengajuan = useMemo(
    () => Object.values(statusCounts).reduce((a, n) => a + n, 0),
    [statusCounts]
  );

  // Tahun grafik: default tahun berjalan, opsi dari data pencairan + pagu.
  const [chartYear, setChartYear] = useState(String(new Date().getFullYear()));
  const chartYears = useMemo(() => {
    const set = new Set(tahunList);
    for (const d of disb) {
      if (d.dicairkan_at) set.add(String(new Date(d.dicairkan_at).getFullYear()));
    }
    set.add(String(new Date().getFullYear()));
    return [...set].sort((a, b) => Number(b) - Number(a));
  }, [disb, tahunList]);

  // Realisasi per bulan (dari disbursements.dicairkan_at, ikut filter bidang).
  const monthly = useMemo(() => {
    const arr = Array(12).fill(0);
    for (const d of disb) {
      if (!d.dicairkan_at) continue;
      const dt = new Date(d.dicairkan_at);
      if (String(dt.getFullYear()) !== String(chartYear)) continue;
      const bid = d.pengajuan?.bidang_id;
      if (activeBidang !== "semua") {
        if (bid && bid !== activeBidang) continue;
        if (!bid && !isAdmin) continue;
      }
      arr[dt.getMonth()] += Number(d.nominal || 0);
    }
    return arr;
  }, [disb, chartYear, activeBidang, isAdmin]);

  // Kuota angkas tahun grafik (ikut filter bidang) untuk pembanding semester.
  const angkasYear = useMemo(() => {
    let s1 = 0;
    let s2 = 0;
    for (const r of rows) {
      if (String(r.tahun) !== String(chartYear)) continue;
      if (activeBidang !== "semua" && r.bidang_id !== activeBidang) continue;
      s1 += Number(r.angkas_s1 || 0);
      s2 += Number(r.angkas_s2 || 0);
    }
    return { s1, s2 };
  }, [rows, chartYear, activeBidang]);

  const detailRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/[^0-9]/g, "");
    return visibleRows.filter((r) => {
      if (!q) return true;
      const hay = [
        r.kode_sub_kegiatan,
        r.nama_sub_kegiatan,
        r.kode_uraian,
        r.nama_uraian,
      ]
        .join(" ")
        .toLowerCase();
      if (hay.includes(q)) return true;
      if (
        qDigits &&
        [r.pagu, r.realisasi, r.sisa].some((n) =>
          String(n ?? "")
            .replace(/[^0-9]/g, "")
            .includes(qDigits)
        )
      )
        return true;
      return false;
    });
  }, [visibleRows, search]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of detailRows) {
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
          realisasi: 0,
          diproses: 0,
          sisa: 0,
        });
      }
      const g = map.get(key);
      g.rows.push(r);
      g.pagu += Number(r.pagu || 0);
      g.realisasi += Number(r.realisasi || 0);
      g.diproses += Number(r.diproses || 0);
      g.sisa += Number(r.sisa || 0);
    }
    const list = [...map.values()];
    for (const g of list) {
      g.rows.sort((a, b) =>
        String(a.kode_uraian).localeCompare(String(b.kode_uraian))
      );
      g.persen = g.pagu > 0 ? (g.realisasi / g.pagu) * 100 : 0;
    }
    list.sort(
      (a, b) =>
        String(a.kode_sub_kegiatan).localeCompare(
          String(b.kode_sub_kegiatan)
        ) || String(a.tahun - b.tahun)
    );
    return list;
  }, [detailRows]);

  const totalPages = Math.max(1, Math.ceil(grouped.length / GROUP_PAGE_SIZE));
  const pageGroups = grouped.slice(
    (page - 1) * GROUP_PAGE_SIZE,
    page * GROUP_PAGE_SIZE
  );

  const searching = search.trim() !== "";
  function toggleGroup(key) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  /* ── Supabase not configured ── */
  if (!supabaseOk) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-indigo-600">Ringkasan</p>
        <h1 className="text-2xl font-bold tracking-tight mt-1">Dashboard</h1>
        <div className="mt-6 glass-strong rounded-2xl shadow-glass border border-amber-200/60 p-6">
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

  /* ── Loading Skeleton ── */
  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-4 w-20 rounded skeleton" />
          <div className="h-8 w-48 rounded skeleton mt-2" />
          <div className="h-4 w-96 rounded skeleton mt-2 max-w-full" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/60 bg-white/60 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl skeleton" />
                <div className="flex-1">
                  <div className="h-3 w-20 rounded skeleton" />
                  <div className="h-6 w-32 rounded skeleton mt-1.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200/60 bg-white/60 p-5">
          <div className="h-5 w-40 rounded skeleton" />
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-100 p-4">
                <div className="h-4 w-24 rounded skeleton" />
                <div className="h-2.5 rounded-full skeleton mt-3" />
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="h-3 rounded skeleton" />
                  <div className="h-3 rounded skeleton" />
                  <div className="h-3 rounded skeleton" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Error State ── */
  if (loadError) {
    return (
      <div className="max-w-2xl">
        <div className="glass-strong rounded-2xl shadow-glass border border-rose-200/60 p-8 text-center">
          <DatabaseZap size={40} className="mx-auto text-rose-400 mb-3" />
          <h2 className="font-semibold text-slate-800 text-lg">
            Gagal memuat data
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">
            Terjadi masalah saat mengambil data anggaran.
          </p>
          <button
            type="button"
            onClick={() => loadAll()}
            className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-semibold shadow-glow hover:shadow-lg transition-all duration-200 inline-flex items-center gap-2"
          >
            <RotateCcw size={15} />
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-[28px] font-bold tracking-tight text-slate-900">
            Selamat Datang, Admin
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1 max-w-xl">
            Berikut ringkasan kendali anggaran Dinas Kepemudaan dan Olahraga Kabupaten Bojonegoro
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Tahun */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <select
              value={filterTahun}
              onChange={(e) => setFilterTahun(e.target.value)}
              title="Filter tahun anggaran"
              className="bg-transparent outline-none cursor-pointer text-xs font-semibold text-slate-700 pr-1"
            >
              <option value="semua">Semua tahun</option>
              {tahunList.map((t) => (
                <option key={t} value={t}>
                  Tahun {t}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Bidang */}
          {isAdmin && (
            <div className="flex items-center px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs">
              <select
                value={filterBidang}
                onChange={(e) => setFilterBidang(e.target.value)}
                title="Filter bidang"
                className="bg-transparent outline-none cursor-pointer text-xs font-semibold text-slate-700 pr-1"
              >
                <option value="semua">Semua bidang</option>
                {bidangList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nama}
                  </option>
                ))}
              </select>
            </div>
          )}

        </div>
      </div>

      {/* ── KPI Cards ── */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem>
          <KpiCard
            label="Total Pagu"
            rawValue={totals.pagu}
            Icon={Wallet}
            iconBg="bg-blue-600"
            delay={0}
            subtextSecondary="Total anggaran seluruh bidang"
            decoration={<KpiWaveBlue />}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            label="Realisasi"
            rawValue={totals.realisasi}
            Icon={TrendingUp}
            iconBg="bg-emerald-500"
            delay={0.08}
            subtextPrimary={`${Number(totals.persen || 0).toFixed(2)}%`}
            subtextSecondary="Total yang sudah dicairkan"
            decoration={<KpiMiniBars />}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            label="Pagu Diproses"
            rawValue={paguDiproses}
            Icon={Clock}
            iconBg="bg-amber-500"
            delay={0.16}
            subtextSecondary="Pengajuan sedang diproses"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiCard
            label="Sisa Anggaran"
            rawValue={totals.sisa}
            Icon={PiggyBank}
            iconBg="bg-purple-600"
            delay={0.24}
            subtextSecondary="Sisa anggaran yang belum dicairkan"
            decoration={<KpiWavePurple />}
          />
        </StaggerItem>
      </StaggerContainer>

      {/* ── Pagu per Bidang (Banner Card) ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32, duration: 0.5 }}
        className="rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100"
        aria-label="Realisasi per bidang"
      >
        {/* Banner Header */}
        <div className="banner-bidang-gradient px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Layers size={19} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-bold text-[15px] tracking-tight text-white leading-tight">
                {isAdmin ? "Pagu per Bidang" : "Realisasi Bidang"}
              </h2>
              <p className="text-xs text-blue-100 mt-0.5 leading-tight">
                Ringkasan pagu dan realisasi masing-masing bidang
              </p>
            </div>
          </div>
        </div>

        {/* Bidang Cards Body */}
        <div className="bg-white p-4 sm:p-5">
          {perBidang.length === 0 ? (
            <div className="p-8 text-center">
              <WalletCards size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="font-medium text-slate-600">Belum ada data pagu</p>
              <p className="text-[13px] text-slate-400 mt-1">
                {isAdmin ? (
                  <>
                    Input pagu di{" "}
                    <Link
                      href="/pagu"
                      className="font-semibold text-indigo-600 hover:underline"
                    >
                      Input Pagu
                    </Link>
                  </>
                ) : (
                  "Minta admin menginput pagu untuk bidang Anda."
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {perBidang.map((b, i) => (
                <BidangCard key={b.bidang_id} bidang={b} delay={0.35 + i * 0.07} />
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* ── Grafik Realisasi per Bulan ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38, duration: 0.5 }}
        className="rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100"
        aria-label="Grafik realisasi per bulan"
      >
        <div className="bg-white px-5 sm:px-6 pt-5 pb-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <TrendingUp size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-bold text-[15px] text-slate-900 leading-tight">
                Realisasi per Bulan
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">
                Pencairan dana per bulan{activeBidang !== "semua" ? ` · ${bidangMap[activeBidang]?.nama || ""}` : " · semua bidang"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <select
              value={chartYear}
              onChange={(e) => setChartYear(e.target.value)}
              title="Tahun grafik"
              className="bg-transparent outline-none cursor-pointer text-xs font-semibold text-slate-700 pr-1"
            >
              {chartYears.map((t) => (
                <option key={t} value={t}>
                  Tahun {t}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-5 pt-3">
          <MonthlyChart monthly={monthly} year={chartYear} angkasS1={angkasYear.s1} angkasS2={angkasYear.s2} />
        </div>
      </motion.section>

      {/* ── Detail Pagu & Realisasi ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.5 }}
        className="rounded-2xl bg-white border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
        aria-label="Detail pagu dan realisasi"
      >
        <div className="px-5 pt-5 pb-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <FileText size={18} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-bold text-[15px] text-slate-900 leading-tight">
                Detail Pagu & Realisasi
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-tight">
                Daftar sub kegiatan dan uraian anggaran. Total {grouped.length} sub kegiatan · {detailRows.length} uraian
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari sub kegiatan / uraian / nominal..."
                className="w-full sm:w-64 pl-8 pr-3.5 py-2 rounded-xl border border-slate-200 bg-[#f8fafc] text-xs outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200 placeholder:text-slate-400"
              />
            </label>
          </div>
        </div>

        {grouped.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3">
            <p className="text-xs text-slate-400">
              Halaman {page} dari {totalPages}
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setCollapsed({})}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-all duration-200"
              >
                Buka semua
              </button>
              <button
                type="button"
                onClick={() =>
                  setCollapsed(
                    Object.fromEntries(grouped.map((g) => [g.key, true]))
                  )
                }
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-all duration-200"
              >
                Tutup semua
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto custom-scrollbar border-t border-slate-100">
          <table className="w-full text-[11px] min-w-[48rem]">
            <thead>
              <tr className="text-left text-[10px] font-semibold text-slate-500 border-b border-slate-100 bg-slate-50/70 uppercase tracking-wider">
                <th className="px-1.5 py-2.5 w-5">#</th>
                <th className="px-1.5 py-2.5">Program</th>
                <th className="px-1.5 py-2.5">Kegiatan</th>
                <th className="px-1.5 py-2.5">Kode Sub</th>
                <th className="px-1.5 py-2.5">Uraian</th>
                <th className="px-1.5 py-2.5 text-right">Pagu</th>
                <th className="px-1.5 py-2.5 text-right">Realisasi</th>
                <th className="px-1.5 py-2.5 text-right">Proses</th>
                <th className="px-1.5 py-2.5 text-right">Sisa</th>
                <th className="px-1.5 py-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {pageGroups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <SearchX
                      size={36}
                      className="mx-auto text-slate-300 mb-3"
                    />
                    <p className="font-medium text-slate-600">
                      Data tidak ditemukan
                    </p>
                    <p className="text-[13px] text-slate-400 mt-1">
                      {rows.length === 0
                        ? "Tambahkan pagu di menu Input Pagu."
                        : "Ubah kata kunci atau filter tahun/bidang."}
                    </p>
                  </td>
                </tr>
              ) : (
                pageGroups.flatMap((g, groupIdx) => {
                  const isClosed = !searching && collapsed[g.key];
                  const rowNumber = (page - 1) * GROUP_PAGE_SIZE + groupIdx + 1;
                  const header = (
                    <tr
                      key={g.key}
                      className="border-t border-slate-100 bg-slate-50/40 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-1.5 py-2.5 text-slate-700 font-medium">
                        {rowNumber}
                      </td>
                      <td className="px-1.5 py-2.5 text-slate-600 align-top">
                        <span className="font-mono text-[10px] font-semibold text-slate-700 block truncate max-w-[6rem]">
                          {g.kode_program || "—"}
                        </span>
                        {g.nama_program && (
                          <span className="block text-[10px] text-slate-400 leading-snug mt-0.5 max-w-[6rem] truncate">
                            {g.nama_program}
                          </span>
                        )}
                      </td>
                      <td className="px-1.5 py-2.5 text-slate-600 align-top">
                        <span className="font-mono text-[10px] font-semibold text-slate-700 block truncate max-w-[8rem]">
                          {g.kode_kegiatan || "—"}
                        </span>
                        {g.nama_kegiatan && (
                          <span className="block text-[10px] text-slate-400 leading-snug mt-0.5 max-w-[8rem] truncate">
                            {g.nama_kegiatan}
                          </span>
                        )}
                      </td>
                      <td className="px-1.5 py-2.5" colSpan={2}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.key)}
                          className="flex items-center gap-2 text-left w-full group"
                          aria-expanded={!isClosed}
                          aria-label={`${isClosed ? "Buka" : "Tutup"} ${g.kode_sub_kegiatan}`}
                        >
                          <motion.span
                            animate={{ rotate: isClosed ? -90 : 0 }}
                            transition={{ duration: 0.18 }}
                            className="shrink-0 text-slate-400 group-hover:text-slate-600"
                          >
                            <ChevronDown size={15} />
                          </motion.span>
                          <span className="font-mono text-[11px] font-bold text-slate-800">
                            {g.kode_sub_kegiatan}
                          </span>
                        </button>
                        <p className="text-[11px] font-bold text-slate-900 leading-snug mt-1 truncate max-w-[18rem]">
                          {g.nama_sub_kegiatan}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {bidangMap[g.bidang_id]?.nama || "—"} · {g.rows.length} uraian
                        </p>
                      </td>
                      <td className="px-1.5 py-2.5 text-right tabular-nums whitespace-nowrap font-bold text-slate-800">
                        {formatRupiah(g.pagu)}
                      </td>
                      <td className="px-1.5 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-800 font-medium">
                        {formatRupiah(g.realisasi)}
                      </td>
                      <td className="px-1.5 py-2.5 text-right tabular-nums whitespace-nowrap text-amber-700 font-medium">
                        {Number(g.diproses || 0) > 0 ? formatRupiah(g.diproses) : "—"}
                      </td>
                      <td className="px-1.5 py-2.5 text-right tabular-nums whitespace-nowrap font-bold text-slate-800">
                        {formatRupiah(g.sisa)}
                      </td>
                      <td className="px-1.5 py-2.5 text-right">
                        <span className="tabular-nums text-[11px] font-bold text-slate-700">
                          {Number(g.persen || 0).toFixed(1)}%
                        </span>
                        <span className="block w-10 h-1.5 ml-auto mt-1 rounded-full bg-slate-100 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-blue-500"
                            style={{
                              width: `${Math.min(100, Number(g.persen || 0))}%`,
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  );
                  if (isClosed) return [header];
                  const kids = g.rows.map((r) => (
                    <tr
                      key={r.budget_line_id}
                      className="border-t border-slate-50 hover:bg-blue-50/20 transition-colors"
                    >
                      <td className="px-1.5 py-2"></td>
                      <td className="px-1.5 py-2"></td>
                      <td className="px-1.5 py-2"></td>
                      <td className="px-1.5 py-2">
                        <div className="flex items-center gap-1 pl-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                          <span className="font-mono text-[10px] text-slate-600 font-medium">
                            {r.kode_uraian}
                          </span>
                        </div>
                      </td>
                      <td className="px-1.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-full border border-slate-300 flex items-center justify-center shrink-0">
                            <span className="w-1 h-1 rounded-full bg-slate-400" />
                          </span>
                          <p className="text-[10px] text-slate-700 truncate max-w-[10rem]">
                            {r.nama_uraian}
                          </p>
                        </div>
                      </td>
                      <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap text-slate-600">
                        {formatRupiah(r.pagu)}
                      </td>
                      <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap text-slate-600">
                        {formatRupiah(r.realisasi)}
                      </td>
                      <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap text-amber-600">
                        {Number(r.diproses || 0) > 0 ? formatRupiah(r.diproses) : "—"}
                      </td>
                      <td className="px-1.5 py-2 text-right tabular-nums whitespace-nowrap text-slate-600">
                        {formatRupiah(r.sisa)}
                      </td>
                      <td className="px-1.5 py-2 text-right">
                        <span className="tabular-nums text-[10px] text-slate-600 font-medium">
                          {Number(r.persen_realisasi || 0).toFixed(1)}%
                        </span>
                        <span className="block w-10 h-1 ml-auto mt-1 rounded-full bg-slate-100 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-blue-400"
                            style={{
                              width: `${Math.min(100, Number(r.persen_realisasi || 0))}%`,
                            }}
                          />
                        </span>
                      </td>
                    </tr>
                  ));
                  return [header, ...kids];
                })
              )}
            </tbody>
            {!loading && !loadError && pageGroups.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-[11px]">
                  <td className="px-1.5 py-2.5" colSpan={4}></td>
                  <td className="px-1.5 py-2.5 text-slate-500">
                    Total · {grouped.length} sub · {detailRows.length} uraian
                  </td>
                  <td className="px-1.5 py-2.5 text-right tabular-nums font-bold text-slate-900">
                    {formatRupiah(totals.pagu)}
                  </td>
                  <td className="px-1.5 py-2.5 text-right tabular-nums">
                    {formatRupiah(totals.realisasi)}
                  </td>
                  <td className="px-1.5 py-2.5 text-right tabular-nums font-bold text-amber-700">
                    {totals.diproses > 0 ? formatRupiah(totals.diproses) : "—"}
                  </td>
                  <td className="px-1.5 py-2.5 text-right tabular-nums">
                    {formatRupiah(totals.sisa)}
                  </td>
                  <td className="px-1.5 py-2.5 text-right tabular-nums">
                    {totals.persen}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        {!loading && grouped.length > GROUP_PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-[13px] text-slate-500">
              Halaman {page} dari {totalPages} · sub kegiatan{" "}
              {(page - 1) * GROUP_PAGE_SIZE + 1}–
              {Math.min(page * GROUP_PAGE_SIZE, grouped.length)} dari{" "}
              {grouped.length} ({detailRows.length} uraian)
            </p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Halaman sebelumnya"
                className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Halaman berikutnya"
                className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </motion.section>
    </div>
  );
}
