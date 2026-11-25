import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// API login dengan dua lapis keamanan:
// 1. Cloudflare Turnstile (cek token ke server Cloudflare)
// 2. Suspend bertingkat per IP+email (1, 2, 4, 8 menit ... maks 24 jam)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_LOCK_SECONDS = 60;

function getIp(req) {
  const xf = req.headers.get("x-forwarded-for") || "";
  return xf.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

async function verifyTurnstile(token, secret, remoteip) {
  if (!secret) return { ok: true, skipped: true }; // fallback kalau belum dikonfigurasi
  if (!token) return { ok: false, error: "Verifikasi bot belum dilakukan. Muat ulang halaman." };
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, response: token, remoteip }),
      }
    );
    const data = await res.json();
    return data.success
      ? { ok: true }
      : { ok: false, error: "Verifikasi bot gagal. Coba muat ulang halaman." };
  } catch {
    return { ok: false, error: "Verifikasi bot tidak dapat dihubungi. Coba lagi." };
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const turnstileToken = String(body.turnstileToken || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) {
    return NextResponse.json({ error: "Konfigurasi server belum lengkap." }, { status: 500 });
  }

  const ip = getIp(req);
  const key = `${ip}|${email}`;

  // admin DB (service_role) untuk fungsi lock -- tidak pernah dikirim ke browser
  const admin = createClient(url, service || anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- Cek suspend dulu ---
  if (service) {
    const { data: chk } = await admin.rpc("login_lock_check", { p_key: key });
    if (chk?.locked) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan gagal. Akun/IP Anda di-suspend selama ${chk.seconds} detik.`,
          locked: true,
          seconds: chk.seconds,
        },
        { status: 429 }
      );
    }
  }

  // --- Verifikasi Turnstile ---
  const turn = await verifyTurnstile(
    turnstileToken,
    process.env.TURNSTILE_SECRET_KEY,
    ip
  );
  if (!turn.ok) {
    return NextResponse.json(
      { error: turn.error, refreshTurnstile: true },
      { status: 400 }
    );
  }

  // --- Coba login lewat Supabase Auth (cookie SSR) ---
  const cookieStore = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Action:abaikan; proxy.js yang refresh
        }
      },
    },
  });

  const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });

  if (signErr) {
    let seconds = 0;
    let remaining = 0;
    let count = 0;
    if (service) {
      const { data: fail } = await admin.rpc("login_lock_fail", { p_key: key });
      seconds = fail?.seconds || 0;
      remaining = fail?.remaining || 0;
      count = fail?.count || 0;
    }
    const pesan =
      "Email atau password salah. Periksa kembali lalu coba lagi." +
      (seconds
        ? ` Akun/IP di-suspend ${seconds} detik setelah 5x salah.`
        : count > 0
          ? ` Percobaan ke-${count}/5 sebelum suspend.`
          : "");
    return NextResponse.json(
      { error: pesan, seconds, remaining, count },
      { status: 401 }
    );
  }

  // sukses -> bersihkan counter
  if (service) {
    await admin.rpc("login_lock_clear", { p_key: key });
  }
  return NextResponse.json({ ok: true });
}
