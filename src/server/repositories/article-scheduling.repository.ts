import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const resultSchema = z.object({
  published: z.number().int().min(0).max(100),
  rejected: z.number().int().min(0).max(100),
});

export class ArticleSchedulingRepository {
  constructor(private readonly client: SupabaseClient) {}

  async publishDue() {
    const { data, error } = await this.client.rpc("publish_scheduled_articles", { p_limit: 100 });
    if (error) throw error;
    return resultSchema.parse(data);
  }
}
