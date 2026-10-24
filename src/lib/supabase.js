import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.SUPABASE_URL;
const key = import.meta.env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Faltan SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY");
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
