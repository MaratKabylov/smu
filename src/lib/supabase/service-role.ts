import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServiceRoleEnv } from "@/lib/env";

export function createServiceRoleSupabaseClient() {
  const env = getServiceRoleEnv();

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
