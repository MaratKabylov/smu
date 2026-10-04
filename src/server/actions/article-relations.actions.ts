"use server";
import { z } from "zod";
import { articleRelationKinds } from "@/types/domain/article-relations";
import { getAdminAccess } from "@/server/services/access.service";
import { ArticleRelationsService } from "@/server/services/article-relations.service";

export async function searchArticleRelations(kind: string, query: string, ids: string[] | null = null) {
  const input = z.object({ kind: z.enum(articleRelationKinds), query: z.string().trim().max(120), ids: z.array(z.uuid()).max(50).nullable() }).safeParse({ kind, query, ids });
  if (!input.success) return { ok: false as const, error: "Некорректный запрос." };
  const result = await getAdminAccess();
  if (result.state !== "allowed") return { ok: false as const, error: "Недостаточно прав." };
  try {
    const options = await new ArticleRelationsService().search(result.access, input.data.kind, input.data.query, input.data.ids);
    return { ok: true as const, options };
  } catch { return { ok: false as const, error: "Не удалось загрузить связи." }; }
}
