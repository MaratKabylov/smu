import "server-only";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import { ArticleSchedulingRepository } from "@/server/repositories/article-scheduling.repository";

// Trusted cron operation; interactive scheduling uses the user's session in
// ArticleService. Locking, eligibility, revisions and audit live in one RPC.
export class ArticleSchedulingService {
  async publishDue() {
    return new ArticleSchedulingRepository(createServiceRoleSupabaseClient()).publishDue();
  }
}
