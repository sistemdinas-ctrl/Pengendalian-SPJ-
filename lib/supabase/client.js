import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

// Client browser — hanya pakai anon key. JANGAN pakai service_role di sini (PRD §17).
// PENTING: pakai versi @supabase/ssr agar sesi tersimpan di cookie,
// sehingga middleware (server) bisa membaca user. Versi @supabase/supabase-js
// biasa menyimpan di localStorage -> middleware selalu menganggap logout
// dan melempar balik ke /login tanpa pesan error.
//
// SINGLETON: satu instance dipakai ulang di seluruh aplikasi.
// Tanpa ini, setiap pemanggilan createBrowserClient() membuat instance baru
// (listener auth, pool realtime, dsb.) -> memori browser membengkak
// dan tab terasa makin berat saat dipakai lama.
let browserClient = null;

export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY belum diisi. Salin .env.example ke .env.local lalu restart npm run dev."
    );
  }
  if (!browserClient) {
    browserClient = createSsrBrowserClient(url, anon);
  }
  return browserClient;
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}