import { createBrowserClient } from "@supabase/ssr";

let supabase;

export function createClient() {
  if (supabase) return supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase is not configured. Add the project URL and publishable key to .env.local.");
  }

  supabase = createBrowserClient(url, key);
  return supabase;
}
