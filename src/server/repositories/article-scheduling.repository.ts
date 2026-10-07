import "server-only";
import { z } from "zod";
import type { DatabaseClient } from "@/lib/supabase/database";

const resultSchema = z.object({
  published: z.number().int().min(0).max(100),
  rejected: z.number().int().min(0).max(100),
});

export class ArticleSchedulingRepository {
  constructor(private readonly client: DatabaseClient) {}

  async publishDue() {
    const { data, error } = await this.client.rpc("publish_scheduled_articles", { p_limit: 100 });
    if (error) throw error;
    return resultSchema.parse(data);
  }
}
