import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServiceRoleEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

export function createServiceRoleSupabaseClient() {
  const env = getServiceRoleEnv();

  return createClient<Database>(
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
