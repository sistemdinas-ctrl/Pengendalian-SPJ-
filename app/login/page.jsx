"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Loader2,
  BarChart3,
  CheckCircle2,
  FileText,
  Users,
} from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════
   DisporaEmblem — SVG logo Dinas
   ═══════════════════════════════════════ */
function DisporaEmblem({ className = "w-10 h-11" }) {
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
    <svg viewBox="0 0 32 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M16 2L3 7V17C3 24.5 8.5 31.5 16 34C23.5 31.5 29 24.5 29 17V7L16 2Z" fill="url(#shield)" stroke="#EAB308" strokeWidth="1.5" />
      <path d="M16 5L6 9V17C6 23 10.3 28.5 16 30.8C21.7 28.5 26 23 26 17V9L16 5Z" fill="#DC2626" opacity="0.85" />
      <circle cx="16" cy="15" r="4.5" fill="#FDE047" />
      <path d="M16 9L17.2 12.8H21L18 15L19.2 19L16 16.5L12.8 19L14 15L11 12.8H14.8L16 9Z" fill="#F59E0B" />
      <path d="M10 24C12 25.5 14 26 16 26C18 26 20 25.5 22 24" stroke="#FEF08A" strokeWidth="1.2" strokeLinecap="round" />
      <defs>
        <linearGradient id="shield" x1="16" y1="2" x2="16" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1E3A8A" />
          <stop offset="0.6" stopColor="#0F172A" />
          <stop offset="1" stopColor="#1E293B" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Logo WEB (aplikasi) — file manual terpisah dari logo Dispora:
// public/logo-web.png. Dipakai di kartu login.
// Bila file belum dipasang, fallback ke logo Dispora.
function WebEmblem({ className = "w-14 h-16" }) {
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

/* ═══════════════════════════════════════
   LoginIllustration — Isometric laptop + dashboard
   ═══════════════════════════════════════ */
function LoginIllustration() {
  return (
    <div className="relative w-full max-w-[440px] aspect-[4/3.2] mx-auto">
      <svg viewBox="0 0 440 340" fill="none" className="w-full h-full">
        {/* Shadow base */}
        <ellipse cx="220" cy="300" rx="150" ry="18" fill="#c7d2fe" opacity="0.3" />

        {/* Platform / desk surface */}
        <ellipse cx="220" cy="290" rx="170" ry="22" fill="#e0e7ff" opacity="0.35" />

        {/* Laptop body */}
        <path d="M100 95H340C347 95 352 100 352 107V215C352 222 347 227 340 227H100C93 227 88 222 88 215V107C88 100 93 95 100 95Z" fill="#4f8cff" />
        <rect x="107" y="102" width="226" height="118" rx="4" fill="#0c1a3d" />

        {/* Screen content */}
        <rect x="107" y="102" width="226" height="14" rx="4" fill="#162350" />
        <circle cx="120" cy="109" r="2.8" fill="#ef4444" />
        <circle cx="130" cy="109" r="2.8" fill="#eab308" />
        <circle cx="140" cy="109" r="2.8" fill="#22c55e" />

        {/* Sidebar */}
        <rect x="107" y="116" width="40" height="104" fill="#131f42" />
        <rect x="114" y="123" width="26" height="3.5" rx="1" fill="#2a3a6a" />
        <rect x="114" y="132" width="26" height="3.5" rx="1" fill="#4f8cff" />
        <rect x="114" y="141" width="26" height="3.5" rx="1" fill="#2a3a6a" />
        <rect x="114" y="150" width="26" height="3.5" rx="1" fill="#2a3a6a" />
        <rect x="114" y="159" width="26" height="3.5" rx="1" fill="#2a3a6a" />
        <rect x="114" y="168" width="26" height="3.5" rx="1" fill="#2a3a6a" />

        {/* Stat cards */}
        <rect x="156" y="118" width="58" height="36" rx="4" fill="#162350" />
        <rect x="161" y="123" width="18" height="3" rx="1" fill="#64748b" />
        <rect x="161" y="130" width="30" height="5" rx="1" fill="#f8fafc" />
        <rect x="161" y="139" width="14" height="3" rx="1" fill="#22c55e" />

        <rect x="220" y="118" width="58" height="36" rx="4" fill="#162350" />
        <rect x="225" y="123" width="18" height="3" rx="1" fill="#64748b" />
        <rect x="225" y="130" width="26" height="5" rx="1" fill="#f8fafc" />
        <rect x="225" y="139" width="12" height="3" rx="1" fill="#4f8cff" />

        <rect x="284" y="118" width="42" height="36" rx="4" fill="#162350" />
        <rect x="289" y="123" width="14" height="3" rx="1" fill="#64748b" />
        <rect x="289" y="130" width="22" height="5" rx="1" fill="#f8fafc" />

        {/* Bar chart */}
        <rect x="164" y="178" width="11" height="28" rx="2" fill="#4f8cff" />
        <rect x="181" y="168" width="11" height="38" rx="2" fill="#6366f1" />
        <rect x="198" y="174" width="11" height="32" rx="2" fill="#4f8cff" />
        <rect x="215" y="160" width="11" height="46" rx="2" fill="#818cf8" />
        <rect x="232" y="176" width="11" height="30" rx="2" fill="#4f8cff" />
        <rect x="249" y="164" width="11" height="42" rx="2" fill="#6366f1" />
        <rect x="266" y="172" width="11" height="34" rx="2" fill="#4f8cff" />
        <rect x="283" y="156" width="11" height="50" rx="2" fill="#818cf8" />

        {/* Keyboard */}
        <path d="M78 227H362L375 250H65L78 227Z" fill="#94a3b8" />
        <path d="M88 229H352L362 246H78L88 229Z" fill="#cbd5e1" />
        <rect x="135" y="234" width="170" height="5" rx="1.5" fill="#e2e8f0" />
      </svg>

      {/* ── Floating Icons ── */}
      {/* Users — top-left */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="absolute top-[2%] left-[0%] w-14 h-14 rounded-2xl bg-white/90 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-white/60 flex items-center justify-center"
      >
        <Users size={24} className="text-indigo-500" />
      </motion.div>

      {/* BarChart — top-right */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="absolute top-[4%] right-[10%] w-12 h-12 rounded-2xl bg-white/90 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-white/60 flex items-center justify-center"
      >
        <BarChart3 size={22} className="text-indigo-500" />
      </motion.div>

      {/* CheckCircle — mid-right */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65, duration: 0.5 }}
        className="absolute top-[32%] right-[-2%] w-13 h-13 rounded-2xl bg-white/90 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-white/60 flex items-center justify-center"
      >
        <CheckCircle2 size={24} className="text-emerald-500" />
      </motion.div>

      {/* FileText — mid-left */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="absolute top-[16%] right-[2%] w-11 h-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-white/60 flex items-center justify-center"
      >
        <FileText size={20} className="text-blue-500" />
      </motion.div>

      {/* Plant */}
      <svg className="absolute bottom-[16%] left-[-2%]" width="64" height="74" viewBox="0 0 64 74" fill="none">
        <ellipse cx="32" cy="68" rx="16" ry="4" fill="#c7d2fe" opacity="0.35" />
        <rect x="22" y="52" width="20" height="18" rx="4" fill="#94a3b8" />
        <rect x="24" y="54" width="16" height="14" rx="3" fill="#a1b4d0" />
        <path d="M32 52C32 52 18 40 14 28C10 16 22 10 32 24C42 10 54 16 50 28C46 40 32 52 32 52Z" fill="#22c55e" />
        <path d="M32 52C32 52 24 42 20 32C16 22 26 16 32 28C38 16 48 22 44 32C40 42 32 52 32 52Z" fill="#16a34a" />
        <path d="M32 52C32 52 28 44 26 38C24 32 30 28 32 34C34 28 40 32 38 38C36 44 32 52 32 52Z" fill="#15803d" />
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════
   BackgroundDecoration — waves + blobs + dots
   ═══════════════════════════════════════ */
function BackgroundDecoration() {
  return (
    <>
      {/* Gradient blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-200/30 via-violet-200/20 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-blue-200/25 via-indigo-100/15 to-transparent blur-3xl pointer-events-none" />

      {/* Top-right wave */}
      <svg className="absolute top-0 right-0 w-[400px] h-[400px] pointer-events-none opacity-40" viewBox="0 0 400 400" fill="none">
        <path d="M400 0C400 0 340 50 290 90C240 130 170 170 80 210C30 230 0 235 0 235V0H400Z" fill="url(#wave1)" />
        <defs>
          <linearGradient id="wave1" x1="0" y1="0" x2="400" y2="400">
            <stop stopColor="#c7d2fe" stopOpacity="0.6" />
            <stop offset="1" stopColor="#e0e7ff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Bottom-left wave */}
      <svg className="absolute bottom-0 left-0 w-[450px] h-[450px] pointer-events-none opacity-30" viewBox="0 0 450 450" fill="none">
        <path d="M0 450C0 450 70 380 150 330C230 280 340 245 450 215V450H0Z" fill="url(#wave2)" />
        <defs>
          <linearGradient id="wave2" x1="0" y1="450" x2="450" y2="0">
            <stop stopColor="#c7d2fe" stopOpacity="0.5" />
            <stop offset="1" stopColor="#e0e7ff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Floating dots */}
      <div className="absolute top-[10%] right-[18%] w-2 h-2 rounded-full bg-white/50" />
      <div className="absolute top-[20%] right-[8%] w-1.5 h-1.5 rounded-full bg-white/40" />
      <div className="absolute bottom-[30%] right-[5%] w-2.5 h-2.5 rounded-full bg-white/45" />
      <div className="absolute top-[6%] left-[40%] w-1.5 h-1.5 rounded-full bg-white/35" />
      <div className="absolute bottom-[45%] left-[12%] w-1.5 h-1.5 rounded-full bg-white/30" />
      <div className="absolute top-[50%] left-[5%] w-2 h-2 rounded-full bg-indigo-200/25" />
    </>
  );
}

/* ═══════════════════════════════════════
   Pesan error login yang ramah (Indonesia).
   Supabase sengaja mengembalikan "Invalid login credentials" untuk
   email salah MAUPUN password salah (agar akun tidak bisa ditebak),
   jadi kita tampilkan gabungan "Email atau password salah".
   ═══════════════════════════════════════ */
function toFriendlyLoginError(err) {
  const raw = String(err?.message || err?.code || "");
  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials") || msg.includes("invalid_grant"))
    return "Email atau password salah. Periksa kembali lalu coba lagi.";
  if (msg.includes("email not confirmed") || msg.includes("email not verified"))
    return "Email belum diverifikasi. Cek inbox email lalu verifikasi dulu.";
  if (msg.includes("too many requests") || msg.includes("rate limit") || msg.includes("over request"))
    return "Terlalu banyak percobaan login. Tunggu sebentar lalu coba lagi.";
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("fetch failed")
  )
    return "Koneksi ke server bermasalah. Periksa internet lalu coba lagi.";
  if (msg.includes("belum diisi") || msg.includes("supabase_url"))
    return "Konfigurasi server belum lengkap. Hubungi admin.";
  return "Email atau password salah. Periksa kembali lalu coba lagi.";
}

/* ═══════════════════════════════════════
   MAIN LOGIN PAGE
   ═══════════════════════════════════════ */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createBrowserClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr) throw signErr;
      window.location.assign("/");
    } catch (err) {
      setError(toFriendlyLoginError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #f8faff 0%, #eef3ff 45%, #f4f0ff 100%)",
      }}
    >
      <BackgroundDecoration />

      {/* ═══════════════════════════════════
          LEFT — Branding + Illustration
          ═══════════════════════════════════ */}
      <div className="hidden lg:flex w-[58%] flex-col relative z-10 p-10 xl:p-14">
        {/* Dinas Logo — top-left */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <DisporaEmblem className="w-14 h-16" />
          <div>
            <p className="font-bold text-[#172033] text-[15px] leading-tight">
              Dinas Kepemudaan dan Olahraga
            </p>
            <p className="text-[12px] text-[#7183a3] mt-0.5">
              Kabupaten Bojonegoro
            </p>
          </div>
        </motion.div>

        {/* Center: Illustration + Tagline */}
        <div className="flex-1 flex flex-col items-center justify-center mt-4">
          {/* Illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full max-w-[460px]"
          >
            <LoginIllustration />
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="text-center mt-6"
          >
            <p className="text-[16px] font-medium text-[#54709c] leading-relaxed">
              Bersama Membangun Pemuda dan Olahraga
              <br />
              Kabupaten Bojonegoro
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-8 h-[6px] rounded-full bg-[#5B5CF6]" />
              <div className="w-[6px] h-[6px] rounded-full bg-[#5B5CF6]/30" />
              <div className="w-[6px] h-[6px] rounded-full bg-[#5B5CF6]/30" />
              <div className="w-[6px] h-[6px] rounded-full bg-[#5B5CF6]/30" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════
          RIGHT — Login Card
          ═══════════════════════════════════ */}
      <div className="flex-1 lg:w-[42%] flex items-center justify-center p-5 sm:p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full max-w-[480px]"
        >
          <div
            className="rounded-[28px] p-8 sm:p-10 border border-white/70"
            style={{
              background: "rgba(255,255,255,0.82)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 24px 70px rgba(40,60,120,0.12)",
            }}
          >
            {/* Logo Web */}
            <div className="flex items-center gap-3.5">
              <WebEmblem className="w-16 h-20 shrink-0" />
              <div>
                <p className="text-[24px] font-bold tracking-tight leading-none text-[#172033]">
                  Kendali Anggaran
                </p>
                <p className="text-[13px] text-[#7183a3] mt-0.5">
                  Sistem Pengajuan dan Pencairan Dana
                </p>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-[28px] font-bold tracking-tight mt-8 text-[#172033]">
              Masuk
            </h1>
            <p className="text-[14.5px] text-[#7183a3] mt-1.5 leading-[1.6]">
              Gunakan akun yang diberikan oleh Dinas Kepemudaan dan
              Olahraga Kabupaten Bojonegoro.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="text-[13px] font-semibold text-[#172033] flex items-center gap-1.5"
                >
                  <Mail size={14} className="text-[#7183a3]" />
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dispora.local"
                  className="mt-2 w-full h-[48px] px-4 rounded-[12px] border border-[#dce4f2] bg-[#f3f6fc] text-[14px] text-[#172033] outline-none transition-all duration-200 placeholder:text-[#94a3b8] focus:border-[#5B5CF6] focus:ring-[4px] focus:ring-[rgba(99,102,241,0.10)]"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="text-[13px] font-semibold text-[#172033] flex items-center gap-1.5"
                >
                  <Lock size={14} className="text-[#7183a3]" />
                  Password
                </label>
                <div className="relative mt-2">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-[48px] px-4 pr-11 rounded-[12px] border border-[#dce4f2] bg-[#f3f6fc] text-[14px] text-[#172033] outline-none transition-all duration-200 placeholder:text-[#94a3b8] focus:border-[#5B5CF6] focus:ring-[4px] focus:ring-[rgba(99,102,241,0.10)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#7183a3] transition-colors duration-150"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-[16px] h-[16px] rounded border-[#dce4f2] text-[#5B5CF6] focus:ring-[#5B5CF6] cursor-pointer accent-[#5B5CF6]"
                  />
                  <span className="text-[14px] text-[#7183a3]">Ingat saya</span>
                </label>
                <button
                  type="button"
                  className="text-[14px] font-semibold text-[#5B5CF6] hover:text-[#7C3AED] hover:underline transition-colors duration-150"
                >
                  Lupa password?
                </button>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="flex items-start gap-2 text-[13px] text-red-600 bg-red-50 border border-red-200/60 rounded-[10px] px-3.5 py-2.5"
                >
                  <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </motion.div>
              )}

              {/* Submit button */}
              <motion.button
                whileHover={{ y: -1, boxShadow: "0 12px 32px rgba(99,102,241,0.35)" }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-[14px] text-white text-[16px] font-bold shadow-[0_10px_25px_rgba(99,102,241,0.25)] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(90deg, #5B5CF6, #7C2FF5)",
                }}
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <LogIn size={18} />
                )}
                {loading ? "Memproses…" : "Masuk"}
              </motion.button>
            </form>

            {/* Footer */}
            <div className="mt-7 pt-4 border-t border-[#e2e8f0] text-center">
              <p className="text-[13px] text-[#94a3b8] tracking-wide">
                Kendali Anggaran v1.0
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════
          MOBILE ONLY — Dinas Logo (top)
          ═══════════════════════════════════ */}
      <div className="lg:hidden absolute top-5 left-5 z-20 flex items-center gap-2.5">
        <DisporaEmblem className="w-11 h-12" />
        <div>
          <p className="font-bold text-[#172033] text-[12px] leading-tight">
            Dispora
          </p>
          <p className="text-[9px] text-[#7183a3]">Bojonegoro</p>
        </div>
      </div>
    </div>
  );
}
