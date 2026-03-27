import { createClient } from "@supabase/supabase-js";

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

console.log("URL Kontrol:", !!process.env.NEXT_PUBLIC_SUPABASE_URL);

export const isSupabaseConfigured = Boolean(envUrl && envAnonKey);

if (!isSupabaseConfigured) {
  console.error("UYARI: Keyler eksik");
}

const supabaseUrl = envUrl ?? "https://dummy.supabase.co";
const supabaseAnonKey = envAnonKey ?? "dummy-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});
