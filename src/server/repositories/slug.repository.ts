import "server-only";

import type { DatabaseClient } from "@/lib/supabase/database";
import type { Locale } from "@/lib/i18n/locales";

export async function getPublicSlugRedirect(
  client: DatabaseClient,
  entityType: "article" | "scientist",
  locale: Locale,
  oldSlug: string,
): Promise<string | null> {
  const { data: history, error } = await client.from("slug_redirects")
    .select("entity_id").eq("entity_type", entityType).eq("locale", locale)
    .eq("old_slug", oldSlug).maybeSingle();
  if (error) throw error;
  if (!history) return null;

  // Explicit public filters apply even to an administrator's session.
  const query = entityType === "article"
    ? client.from("articles").select("id").eq("id", history.entity_id).eq("status", "published").is("deleted_at", null).lte("published_at", "now")
    : client.from("scientist_profiles").select("id").eq("id", history.entity_id).eq("status", "verified").eq("is_public", true).is("deleted_at", null);
  const { data: entity, error: entityError } = await query.maybeSingle();
  if (entityError) throw entityError;
  if (!entity) return null;

  const translationQuery = entityType === "article"
    ? client.from("article_translations").select("slug").eq("article_id", entity.id)
    : client.from("scientist_profile_translations").select("slug").eq("scientist_profile_id", entity.id);
  const { data: translation, error: translationError } = await translationQuery
    .eq("locale", locale).maybeSingle();
  if (translationError) throw translationError;
  return translation && translation.slug !== oldSlug ? translation.slug : null;
}
