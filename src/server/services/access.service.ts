import "server-only";

import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { canAccessAdmin } from "@/lib/permissions/permissions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AccessRepository } from "@/server/repositories/access.repository";
import type { AccessContext } from "@/types/domain/auth";

export type AdminAccessResult =
  | { state: "setup" }
  | { state: "unauthenticated" }
  | { state: "forbidden" }
  | { state: "allowed"; access: AccessContext; email: string | null };

export class AccessService {
  async getAdminAccess(): Promise<AdminAccessResult> {
    if (!isSupabaseConfigured()) return { state: "setup" };

    const client = await createServerSupabaseClient();
    const {
      data: { user },
    } = await client.auth.getUser();

    if (!user) return { state: "unauthenticated" };

    const access = await new AccessRepository(client).getForUser(user.id);

    if (!canAccessAdmin(access)) return { state: "forbidden" };

    return { state: "allowed", access, email: user.email ?? null };
  }
}

export const getAdminAccess = cache(() => new AccessService().getAdminAccess());
