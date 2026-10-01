import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server client — RLS tetap ditegakkan per user (cookie session).
// Untuk operasi admin sensitif (pencairan), tetap lewat RPC cairkan_pengajuan,
// bukan UPDATE langsung dari frontend (PRD §12, §21).
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
            // dipanggil dari Server Component: abaikan set, middleware yang refresh
          }
        },
      },
    }
  );
}

// Validasi server: JANGAN percaya bidang_id dari input frontend (PRD §2).
// Panggil ini di setiap Server Action / Route Handler sebelum mutation.
export async function requireProfile(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Belum login.");
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("id, role, bidang_id, email, display_name")
    .eq("id", user.id)
    .single();
  if (pErr || !profile) throw new Error("Profile tidak ditemukan. Hubungi admin.");
  return { user, profile };
}

export function assertBidangAllowed(profile, bidangId) {
  if (profile.role === "admin") return;
  if (!profile.bidang_id || profile.bidang_id !== bidangId) {
    throw new Error("Anda tidak berhak mengajukan untuk bidang lain.");
  }
}
