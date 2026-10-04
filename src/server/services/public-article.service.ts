import "server-only";

import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PublicArticleFilters } from "@/lib/validation/article";
import { PublicArticleRepository } from "@/server/repositories/public-article.repository";
import { getPublicSlugRedirect } from "@/server/repositories/slug.repository";
import type { ArticleLocale, ArticleTaxonomy } from "@/types/domain/article";

const emptyTaxonomy: ArticleTaxonomy = { categories: [], tags: [], authors: [], contentTypes: [] };

export class PublicArticleService {
  async getSlugRedirect(locale: ArticleLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    return getPublicSlugRedirect(await createServerSupabaseClient(), "article", locale, slug);
  }
  async list(filters: PublicArticleFilters) {
    if (!isSupabaseConfigured()) {
      return { articles: [], taxonomy: emptyTaxonomy };
    }
    const client = await createServerSupabaseClient();
    const repository = new PublicArticleRepository(client);
    const taxonomy = await repository.listTaxonomy();
    const articles = await repository.list(filters, taxonomy);
    return { articles, taxonomy };
  }

  async getBySlug(locale: ArticleLocale, slug: string) {
    if (!isSupabaseConfigured()) return null;
    const client = await createServerSupabaseClient();
    return new PublicArticleRepository(client).getBySlug(locale, slug);
  }
}

export const getPublishedArticleBySlug = cache(
  (locale: ArticleLocale, slug: string) =>
    new PublicArticleService().getBySlug(locale, slug),
);
