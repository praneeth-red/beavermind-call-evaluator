import "server-only";

export function getServerEnv() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase server environment is not configured");
  }

  return { supabaseUrl, supabaseServiceRoleKey };
}
