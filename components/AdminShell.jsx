"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  WalletCards,
  FilePlus2,
  History,
  FileSpreadsheet,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronDown,
  Building2,
  UserCog,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pagu", label: "Input Pagu", icon: WalletCards },
  { href: "/npd", label: "Pengajuan NPD", icon: FilePlus2 },
  { href: "/history", label: "History Pengajuan", icon: History },
  { href: "/laporan", label: "Laporan SPJ", icon: FileSpreadsheet },
  // Master data PTK — hanya admin (dipakai saat cetak NPD).
  { href: "/ptk", label: "Data PPTK", icon: UserCog, adminOnly: true },
];

const BIDANG_ICONS = {
  Keolahragaan: "Dumbbell",
  Kepemudaan: "Users",
  Kepramukaan: "Mountain",
  Sekretariat: "Building2",
};

function DisporaEmblem({ className = "w-6 h-7" }) {
  // Logo dinas memakai file manual: public/logo-dispora.png.
  // Bila file belum dipasang, otomatis fallback ke SVG bawaan.
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo-dispora.png"
        alt="Logo Dispora Bojonegoro"
        className={`${className} object-contain`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 32 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logo Dispora Bojonegoro"
    >
      {/* Shield Base */}
      <path
        d="M16 2L3 7V17C3 24.5 8.5 31.5 16 34C23.5 31.5 29 24.5 29 17V7L16 2Z"
        fill="url(#dispora-shield-grad)"
        stroke="#EAB308"
        strokeWidth="1.5"
      />
      {/* Inner Red & Gold Ribbon / Details */}
      <path
        d="M16 5L6 9V17C6 23 10.3 28.5 16 30.8C21.7 28.5 26 23 26 17V9L16 5Z"
        fill="#DC2626"
        opacity="0.85"
      />
      {/* Golden Torch / Star Emblem in Center */}
      <circle cx="16" cy="15" r="4.5" fill="#FDE047" />
      <path
        d="M16 9L17.2 12.8H21L18 15L19.2 19L16 16.5L12.8 19L14 15L11 12.8H14.8L16 9Z"
        fill="#F59E0B"
      />
      <path
        d="M10 24C12 25.5 14 26 16 26C18 26 20 25.5 22 24"
        stroke="#FEF08A"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="dispora-shield-grad" x1="16" y1="2" x2="16" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E3A8A" />
          <stop offset="0.6" stopColor="#0F172A" />
          <stop offset="1" stopColor="#1E293B" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Logo WEB (aplikasi) — file manual terpisah dari logo Dispora:
// public/logo-web.png. Dipakai di brand sidebar & topbar mobile.
// Bila file belum dipasang, fallback ke logo Dispora.
function WebEmblem({ className = "w-9 h-10" }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logo-web.png"
        alt="Logo Kendali Anggaran"
        className={`${className} object-contain`}
        onError={() => setFailed(true)}
      />
    );
  }
  return <DisporaEmblem className={className} />;
}

function SilkWaveGraphic() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-64 overflow-hidden pointer-events-none z-0">
      <svg
        viewBox="0 0 250 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="wave-grad-1" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
            <stop offset="40%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="80%" stopColor="#8b5cf6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="wave-grad-2" x1="10%" y1="100%" x2="90%" y2="20%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Layer 1: Flowing upward wave */}
        <path
          d="M-20 260 C 40 210, 30 140, 110 160 C 180 180, 210 120, 270 90 L 270 260 Z"
          fill="url(#wave-grad-1)"
        />
        {/* Layer 2: Glowing ridge */}
        <path
          d="M-30 260 C 20 180, 70 220, 140 170 C 200 130, 220 70, 270 50"
          stroke="url(#wave-grad-1)"
          strokeWidth="1.8"
          strokeOpacity="0.5"
        />
        {/* Layer 3: Secondary smooth wave */}
        <path
          d="M-10 260 C 50 230, 90 190, 160 210 C 220 230, 240 180, 270 150 L 270 260 Z"
          fill="url(#wave-grad-2)"
        />
        <path
          d="M-10 260 C 60 210, 100 170, 170 190 C 230 210, 240 150, 270 120"
          stroke="url(#wave-grad-2)"
          strokeWidth="1.2"
          strokeOpacity="0.4"
        />
      </svg>
    </div>
  );
}

function NavLink({ item, isActive, onClick, collapsed = false }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`relative flex items-center rounded-xl text-[13px] font-medium transition-all duration-200 group ${
        collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5"
      } ${
        isActive
          ? "text-white font-semibold shadow-md"
          : "text-slate-300/80 hover:text-white hover:bg-white/[0.06]"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      {isActive && (
        <motion.div
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl"
          style={{
            background: "linear-gradient(90deg, #2563EB 0%, #38BDF8 100%)",
            boxShadow:
              "0 4px 14px rgba(37, 99, 235, 0.4), 0 0 0 1px rgba(56, 189, 248, 0.3)",
          }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative z-10 transition-transform duration-200 group-hover:translate-x-0.5">
        <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
      </span>
      {!collapsed && <span className="relative z-10">{item.label}</span>}
    </Link>
  );
}

function initialOf(name) {
  const t = (name || "").trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [bidangNama, setBidangNama] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = createBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setSession(false);
          return;
        }
        setSession(user);
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, email, display_name, role, bidang_id")
          .eq("id", user.id)
          .single();
        if (cancelled) return;
        if (prof) {
          setProfile(prof);
          if (prof.bidang_id) {
            const { data: bid } = await supabase
              .from("bidang")
              .select("nama")
              .eq("id", prof.bidang_id)
              .single();
            if (!cancelled && bid) setBidangNama(bid.nama);
          } else {
            setBidangNama(null);
          }
        }
      } catch {
        if (!cancelled) setSession(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
    } finally {
      window.location.assign("/login");
    }
  }

  const displayName =
    profile?.display_name || session?.email?.split("@")[0] || null;
  const isAdmin = profile?.role === "admin";

  return (
    <div className="flex min-h-screen bg-[#f0f4f9]">
      {/* Desktop Sidebar */}
      <aside
        className={`sidebar-dark shrink-0 hidden md:flex flex-col sticky top-0 h-screen z-20 transition-all duration-300 relative overflow-hidden ${
          sidebarCollapsed ? "w-[72px]" : "w-[240px]"
        }`}
      >
        {/* Silk Wave Glowing Decorative Graphic */}
        <SilkWaveGraphic />

        {/* Logo */}
        <div
          className={`h-16 flex items-center border-b border-white/[0.08] shrink-0 relative z-10 ${
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="shrink-0 flex items-center justify-center"
            >
              <WebEmblem className="w-12 h-14" />
            </motion.div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-[14px] font-bold tracking-tight leading-none text-white">
                  Kendali Anggaran
                </p>
                <p className="text-[9.5px] text-slate-400 mt-1 leading-none tracking-wide">
                  Dispora Bojonegoro
                </p>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <span className="text-blue-300/40 text-xs select-none">✦</span>
          )}
        </div>

        {/* Navigation */}
        <nav
          className={`py-3 space-y-1 relative z-10 ${
            sidebarCollapsed ? "px-2" : "px-3"
          }`}
          aria-label="Navigasi utama"
        >
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <NavLink
                key={item.href}
                item={item}
                isActive={isActive}
                collapsed={sidebarCollapsed}
              />
            );
          })}
        </nav>

        {/* User Info */}
        <div
          className={`mt-auto border-t border-white/[0.08] shrink-0 relative z-10 ${
            sidebarCollapsed ? "p-2" : "px-4 py-3"
          }`}
        >
          {session === null ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse shrink-0" />
              {!sidebarCollapsed && (
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
                  <div className="h-2 w-12 rounded bg-white/10 animate-pulse" />
                </div>
              )}
            </div>
          ) : !session ? (
            <p className="text-xs text-slate-500 text-center">
              Hubungkan Supabase
            </p>
          ) : (
            <>
              <div
                className={`flex items-center gap-2.5 ${
                  sidebarCollapsed ? "justify-center" : ""
                }`}
              >
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white bg-indigo-900/60 border border-indigo-400/30"
                  title={session.email || ""}
                >
                  {initialOf(displayName)}
                </motion.div>
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-white truncate leading-none">
                      {displayName?.toLowerCase() || "admin"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-1 leading-none">
                      {isAdmin ? (
                        "Administrator"
                      ) : bidangNama ? (
                        bidangNama
                      ) : (
                        "Staff Bidang"
                      )}
                    </p>
                  </div>
                )}
                {!sidebarCollapsed && (
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    title="Keluar"
                    aria-label="Keluar"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/[0.06] transition-colors disabled:opacity-60"
                  >
                    <LogOut size={15} />
                  </motion.button>
                )}
              </div>
              {sidebarCollapsed && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  title="Keluar"
                  aria-label="Keluar"
                  className="mt-2 w-full flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/[0.06] transition-colors disabled:opacity-60"
                >
                  <LogOut size={15} />
                </motion.button>
              )}
            </>
          )}
        </div>

        {/* Collapse toggle (desktop) */}
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden md:flex absolute -right-3 top-20 w-6 h-6 rounded-full bg-white border border-slate-200 items-center justify-center text-slate-400 hover:text-slate-600 hover:shadow-md transition-all z-30"
          aria-label={sidebarCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
        >
          <ChevronLeft
            size={14}
            className={`transition-transform duration-200 ${
              sidebarCollapsed ? "rotate-180" : ""
            }`}
          />
        </button>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 glass-strong shadow-glass h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <WebEmblem className="w-10 h-11 shrink-0" />
          <span className="font-bold text-sm gradient-text-dark">Kendali Anggaran</span>
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-white/60"
          aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </motion.button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="md:hidden fixed top-14 left-0 bottom-0 z-50 w-72 sidebar-dark flex flex-col"
            >
              <nav
                className="flex-1 px-3 py-4 space-y-1"
                aria-label="Navigasi mobile"
              >
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                  Menu
                </p>
                {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  return (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={isActive}
                      onClick={() => setMobileOpen(false)}
                    />
                  );
                })}
              </nav>
              <div className="p-4 border-t border-white/[0.08]">
                {session && (
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{
                        background:
                          "linear-gradient(135deg, #2563EB, #3B82F6)",
                      }}
                    >
                      {initialOf(displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white truncate">
                        {displayName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {isAdmin ? "Administrator" : bidangNama || "Bidang"}
                      </p>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  aria-label="Keluar"
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-400 hover:text-rose-400 hover:bg-white/[0.06] transition-colors"
                >
                  <LogOut size={16} />
                  {loggingOut ? "Keluar…" : "Keluar"}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center justify-end px-4 md:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3.5">
            {/* Instansi badge */}
            <div className="hidden sm:flex items-center gap-2.5 pl-1 pr-2 py-1">
              <DisporaEmblem className="w-9 h-10 shrink-0 drop-shadow-xs" />
              <div className="text-left leading-tight">
                <p className="font-semibold text-slate-800 text-[11px] tracking-tight">
                  Dinas Kepemudaan dan Olahraga
                </p>
                <p className="text-slate-400 text-[9.5px]">Kabupaten Bojonegoro</p>
              </div>
            </div>

            {/* User avatar */}
            <div className="flex items-center gap-1 cursor-pointer">
              <motion.div
                whileHover={{ scale: 1.06 }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                style={{
                  background: "linear-gradient(135deg, #818cf8 0%, #6366f1 100%)",
                }}
                title={session?.email || displayName || "Admin"}
              >
                {initialOf(displayName || "Admin")}
              </motion.div>
              <ChevronDown size={14} className="text-slate-400" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-4 md:p-7 pb-20 md:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}