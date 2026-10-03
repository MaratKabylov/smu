import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export async function getPublicSlugRedirect(
  client: SupabaseClient,
  entityType: "article" | "scientist",
  locale: "ru" | "kk",
  oldSlug: string,
): Promise<string | null> {
  const { data: history, error } = await client.from("slug_redirects")
    .select("entity_id").eq("entity_type", entityType).eq("locale", locale)
    .eq("old_slug", oldSlug).maybeSingle();
  if (error) throw error;
  if (!history) return null;

  // Explicit public filters apply even to an administrator's session.
  let query = client.from(entityType === "article" ? "articles" : "scientist_profiles")
    .select("id").eq("id", history.entity_id)
    .eq("status", entityType === "article" ? "published" : "verified")
    .is("deleted_at", null);
  if (entityType === "article") query = query.lte("published_at", new Date().toISOString());
  const { data: entity, error: entityError } = await query.maybeSingle();
  if (entityError) throw entityError;
  if (!entity) return null;

  const { data: translation, error: translationError } = await client
    .from(entityType === "article" ? "article_translations" : "scientist_profile_translations")
    .select("slug").eq(entityType === "article" ? "article_id" : "scientist_profile_id", entity.id)
    .eq("locale", locale).maybeSingle();
  if (translationError) throw translationError;
  return translation && translation.slug !== oldSlug ? translation.slug : null;
}
