import type { Tables } from "@/types/database.types";
import "server-only";

import { callDatabaseRpc, databaseJson, type DatabaseClient } from "@/lib/supabase/database";
import type {
  PublicScientistFilters,
  ScientistInput,
  ScientistListFilters,
  ScientistTaxonomyInput,
} from "@/lib/validation/scientist";
import type {
  PublicScientistCard,
  PublicScientistDetail,
  ScientistLocale,
  ScientistOrganization,
  ScientistProfile,
  ScientistStatus,
  ScientistTaxonomy,
  ScientistTaxonomyItem,
  ScientistTranslation,
} from "@/types/domain/scientist";

type ProfileRow = Pick<Tables<"scientist_profiles">, "id" | "user_id" | "organization_id" | "avatar_media_id" | "status" | "public_email" | "orcid" | "scholar_url" | "verified_at" | "created_at" | "updated_at" | "deleted_at">;

type TranslationRow = Pick<Tables<"scientist_profile_translations">, "id" | "scientist_profile_id" | "locale" | "full_name" | "slug" | "position" | "academic_degree" | "short_bio" | "biography">;

type FieldRow = Pick<Tables<"scientific_fields">, "id" | "slug" | "name_ru" | "name_kk" | "is_active">;

type OrganizationRow = FieldRow & Pick<Tables<"scientific_organizations">, "city_ru" | "city_kk" | "website_url" | "logo_media_id">;

type DirectoryTranslationRow = Pick<Tables<"scientific_organization_translations">, "locale" | "name"> & Partial<Pick<Tables<"scientific_organization_translations">, "city">>;

function mapField(row: FieldRow, translations: DirectoryTranslationRow[] = []): ScientistTaxonomyItem {
  return { id: row.id, slug: row.slug, nameRu: row.name_ru, nameKk: row.name_kk, nameEn: translations.find(item => item.locale === "en")?.name ?? null, isActive: row.is_active };
}

function mapOrganization(row: OrganizationRow, translations: DirectoryTranslationRow[] = []): ScientistOrganization {
  return {
    ...mapField(row, translations),
    cityRu: row.city_ru,
    cityKk: row.city_kk,
    cityEn: translations.find(item => item.locale === "en")?.city ?? null,
    websiteUrl: row.website_url,
    logoMediaId: row.logo_media_id,
  };
}

function mapTranslation(row: TranslationRow): ScientistTranslation {
  return {
    id: row.id,
    locale: row.locale,
    fullName: row.full_name,
    slug: row.slug,
    position: row.position,
    academicDegree: row.academic_degree,
    shortBio: row.short_bio,
    biography: row.biography,
  };
}

export class ScientistRepository {
  constructor(private readonly client: DatabaseClient) {}

  async list(filters: ScientistListFilters): Promise<ScientistProfile[]> {
    let matchingIds: string[] | null = null;
    if (filters.query) {
      const { data, error } = await this.client
        .from("scientist_profile_translations")
        .select("scientist_profile_id")
        .ilike("full_name", `%${filters.query}%`);
      if (error) throw error;
      matchingIds = [...new Set(((data ?? [])).map((row) => row.scientist_profile_id))];
      if (matchingIds.length === 0) return [];
    }

    let query = this.client
      .from("scientist_profiles")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (filters.status !== "all") query = query.eq("status", filters.status);
    if (matchingIds) query = query.in("id", matchingIds);
    const { data, error } = await query;
    if (error) throw error;
    return this.hydrateProfiles((data ?? []));
  }

  async getById(id: string): Promise<ScientistProfile | null> {
    const { data, error } = await this.client.from("scientist_profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [profile] = await this.hydrateProfiles([data]);
    return profile ?? null;
  }

  async listTaxonomy(includeInactive = false): Promise<ScientistTaxonomy> {
    let organizationsQuery = this.client
      .from("scientific_organizations")
      .select("id, slug, name_ru, name_kk, city_ru, city_kk, website_url, logo_media_id, is_active")
      .order("name_ru");
    let fieldsQuery = this.client
      .from("scientific_fields")
      .select("id, slug, name_ru, name_kk, is_active")
      .order("name_ru");
    if (!includeInactive) {
      organizationsQuery = organizationsQuery.eq("is_active", true);
      fieldsQuery = fieldsQuery.eq("is_active", true);
    }
    const [organizationsResult, fieldsResult, organizationTranslationsResult, fieldTranslationsResult] = await Promise.all([
      organizationsQuery, fieldsQuery,
      this.client.from("scientific_organization_translations").select("organization_id, locale, name, city"),
      this.client.from("scientific_field_translations").select("field_id, locale, name"),
    ]);
    if (organizationsResult.error) throw organizationsResult.error;
    if (fieldsResult.error) throw fieldsResult.error;
    if (organizationTranslationsResult.error) throw organizationTranslationsResult.error;
    if (fieldTranslationsResult.error) throw fieldTranslationsResult.error;
    const organizationTranslations = (organizationTranslationsResult.data ?? []);
    const fieldTranslations = (fieldTranslationsResult.data ?? []);
    return {
      organizations: (organizationsResult.data ?? []).map(row => mapOrganization(row, organizationTranslations.filter(item => item.organization_id === row.id))),
      fields: (fieldsResult.data ?? []).map(row => mapField(row, fieldTranslations.filter(item => item.field_id === row.id))),
    };
  }

  async create(input: ScientistInput) {
    return callDatabaseRpc(this.client, "save_scientist", { p_id: null, p_input: databaseJson(input) });
  }

  async update(id: string, input: ScientistInput) {
    await callDatabaseRpc(this.client, "save_scientist", { p_id: id, p_input: databaseJson(input) });
  }

  async changeStatus(id: string, status: ScientistStatus) {
    await callDatabaseRpc(this.client, "change_scientist_state", { p_id: id, p_status: status, p_delete: false });
  }

  async softDelete(id: string) {
    await callDatabaseRpc(this.client, "change_scientist_state", { p_id: id, p_status: null, p_delete: true });
  }

  async restoreDeleted(id: string, expectedDeletedAt: string) {
    await callDatabaseRpc(this.client, "restore_deleted_scientist", { p_id: id, p_expected_deleted_at: expectedDeletedAt });
  }

  async createTaxonomyItem(input: ScientistTaxonomyInput) {
    return callDatabaseRpc(this.client, "create_scientist_taxonomy", { p_input: databaseJson(input) });
  }

  async hydrateProfiles(rows: ProfileRow[]): Promise<ScientistProfile[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const organizationIds = [...new Set(rows.flatMap((row) => row.organization_id ? [row.organization_id] : []))];
    const avatarIds = [...new Set(rows.flatMap((row) => row.avatar_media_id ? [row.avatar_media_id] : []))];
    const [translationsResult, linksResult, organizationsResult, avatarsResult, organizationTranslationsResult] = await Promise.all([
      this.client.from("scientist_profile_translations").select("*").in("scientist_profile_id", ids),
      this.client.from("scientist_field_links").select("scientist_profile_id, scientific_field_id").in("scientist_profile_id", ids),
      organizationIds.length > 0
        ? this.client.from("scientific_organizations").select("id, slug, name_ru, name_kk, city_ru, city_kk, website_url, logo_media_id, is_active").in("id", organizationIds)
        : Promise.resolve({ data: [], error: null }),
      avatarIds.length > 0
        ? this.client.from("media_assets").select("id, storage_bucket, storage_path").in("id", avatarIds).eq("status", "ready").is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
      organizationIds.length > 0
        ? this.client.from("scientific_organization_translations").select("organization_id, locale, name, city").in("organization_id", organizationIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (translationsResult.error) throw translationsResult.error;
    if (linksResult.error) throw linksResult.error;
    if (organizationsResult.error) throw organizationsResult.error;
    if (avatarsResult.error) throw avatarsResult.error;
    if (organizationTranslationsResult.error) throw organizationTranslationsResult.error;
    const links = (linksResult.data ?? []);
    const fieldIds = [...new Set(links.map((link) => link.scientific_field_id))];
    const [fieldsResult, fieldTranslationsResult] = await Promise.all([
      fieldIds.length > 0 ? this.client.from("scientific_fields").select("id, slug, name_ru, name_kk, is_active").in("id", fieldIds) : Promise.resolve({ data: [], error: null }),
      fieldIds.length > 0 ? this.client.from("scientific_field_translations").select("field_id, locale, name").in("field_id", fieldIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (fieldsResult.error) throw fieldsResult.error;
    if (fieldTranslationsResult.error) throw fieldTranslationsResult.error;
    const translations = (translationsResult.data ?? []);
    const organizations = (organizationsResult.data ?? []);
    const avatars = (avatarsResult.data ?? []);
    const fields = (fieldsResult.data ?? []);
    const organizationTranslations = (organizationTranslationsResult.data ?? []);
    const fieldTranslations = (fieldTranslationsResult.data ?? []);

    return rows.map((row) => {
      const avatar = avatars.find((item) => item.id === row.avatar_media_id);
      const avatarUrl = avatar
        ? this.client.storage.from(avatar.storage_bucket).getPublicUrl(avatar.storage_path).data.publicUrl
        : null;
      const organization = organizations.find((item) => item.id === row.organization_id);
      return {
        id: row.id,
        userId: row.user_id,
        organizationId: row.organization_id,
        organization: organization ? mapOrganization(organization, organizationTranslations.filter(item => item.organization_id === organization.id)) : null,
        avatarMediaId: row.avatar_media_id,
        avatarUrl,
        status: row.status,
        publicEmail: row.public_email,
        orcid: row.orcid,
        scholarUrl: row.scholar_url,
        verifiedAt: row.verified_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
        translations: translations.filter((item) => item.scientist_profile_id === row.id).map(mapTranslation),
        fields: links.filter((link) => link.scientist_profile_id === row.id).flatMap((link) => {
          const field = fields.find((item) => item.id === link.scientific_field_id);
          return field ? [mapField(field, fieldTranslations.filter(item => item.field_id === field.id))] : [];
        }),
      };
    });
  }
}

export class PublicScientistRepository {
  constructor(private readonly client: DatabaseClient) {}

  async listTaxonomy() {
    return new ScientistRepository(this.client).listTaxonomy();
  }

  async list(filters: PublicScientistFilters, taxonomy: ScientistTaxonomy): Promise<PublicScientistCard[]> {
    const organization = filters.organization
      ? taxonomy.organizations.find((item) => item.slug === filters.organization)
      : null;
    const field = filters.field ? taxonomy.fields.find((item) => item.slug === filters.field) : null;
    if ((filters.organization && !organization) || (filters.field && !field)) return [];

    let translationQuery = this.client
      .from("scientist_profile_translations")
      .select("*")
      .eq("locale", filters.locale);
    if (filters.query) translationQuery = translationQuery.ilike("full_name", `%${filters.query}%`);
    const translationResult = await translationQuery;
    if (translationResult.error) throw translationResult.error;
    let translations = (translationResult.data ?? []);
    if (field) {
      const { data, error } = await this.client
        .from("scientist_field_links")
        .select("scientist_profile_id")
        .eq("scientific_field_id", field.id);
      if (error) throw error;
      const matched = new Set(((data ?? [])).map((row) => row.scientist_profile_id));
      translations = translations.filter((item) => matched.has(item.scientist_profile_id));
    }
    if (translations.length === 0) return [];

    let profileQuery = this.client
      .from("scientist_profiles")
      .select("*")
      .eq("status", "verified")
      .is("deleted_at", null)
      .in("id", translations.map((item) => item.scientist_profile_id))
      .order("verified_at", { ascending: false })
      .limit(100);
    if (organization) profileQuery = profileQuery.eq("organization_id", organization.id);
    const { data, error } = await profileQuery;
    if (error) throw error;
    const profiles = await new ScientistRepository(this.client).hydrateProfiles((data ?? []));
    return profiles.flatMap((profile) => {
      const translation = translations.find((item) => item.scientist_profile_id === profile.id);
      return translation ? [{
        id: profile.id,
        avatarUrl: profile.avatarUrl,
        organization: profile.organization,
        fields: profile.fields,
        translation: mapTranslation(translation),
      }] : [];
    });
  }

  async getBySlug(locale: ScientistLocale, slug: string): Promise<PublicScientistDetail | null> {
    const { data, error } = await this.client
      .from("scientist_profile_translations")
      .select("*")
      .eq("locale", locale)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const translation = data;
    const { data: profileData, error: profileError } = await this.client
      .from("scientist_profiles")
      .select("*")
      .eq("id", translation.scientist_profile_id)
      .eq("status", "verified")
      .is("deleted_at", null)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profileData) return null;
    const [profile] = await new ScientistRepository(this.client).hydrateProfiles([profileData]);
    if (!profile) return null;
    const { data: alternateData, error: alternateError } = await this.client
      .from("scientist_profile_translations")
      .select("*")
      .eq("scientist_profile_id", profile.id)
      .neq("locale", locale);
    if (alternateError) throw alternateError;
    return {
      id: profile.id,
      avatarUrl: profile.avatarUrl,
      organization: profile.organization,
      fields: profile.fields,
      translation: mapTranslation(translation),
      publicEmail: profile.publicEmail,
      orcid: profile.orcid,
      scholarUrl: profile.scholarUrl,
      alternateTranslations: ((alternateData ?? [])).map(mapTranslation),
    };
  }
}
