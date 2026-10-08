// Generated from executed supabase/migrations by npm run db:types. Do not edit.
// JSON payloads and general CHECK expressions require application validation.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      "article_authors": {
        Row: {
          "article_id": string;
          "author_id": string;
          "sort_order": number;
          "role": "author" | "coauthor" | "editor" | "translator";
        };
        Insert: {
          "article_id": string;
          "author_id": string;
          "sort_order": number;
          "role": "author" | "coauthor" | "editor" | "translator";
        };
        Update: {
          "article_id"?: string;
          "author_id"?: string;
          "sort_order"?: number;
          "role"?: "author" | "coauthor" | "editor" | "translator";
        };
        Relationships: [
          { foreignKeyName: "article_authors_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_authors_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "authors"; referencedColumns: ["id"] },
        ];
      };
      "article_categories": {
        Row: {
          "id": string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "description_ru": string | null;
          "description_kk": string | null;
          "sort_order": number;
          "is_active": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "description_ru"?: string | null;
          "description_kk"?: string | null;
          "sort_order"?: number;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "slug"?: string;
          "name_ru"?: string;
          "name_kk"?: string;
          "description_ru"?: string | null;
          "description_kk"?: string | null;
          "sort_order"?: number;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
        ];
      };
      "article_category_links": {
        Row: {
          "article_id": string;
          "category_id": string;
          "sort_order": number;
        };
        Insert: {
          "article_id": string;
          "category_id": string;
          "sort_order": number;
        };
        Update: {
          "article_id"?: string;
          "category_id"?: string;
          "sort_order"?: number;
        };
        Relationships: [
          { foreignKeyName: "article_category_links_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_category_links_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "article_categories"; referencedColumns: ["id"] },
        ];
      };
      "article_category_translations": {
        Row: {
          "category_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
        };
        Insert: {
          "category_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
        };
        Update: {
          "category_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "name"?: string;
        };
        Relationships: [
          { foreignKeyName: "article_category_translations_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "article_categories"; referencedColumns: ["id"] },
        ];
      };
      "article_events": {
        Row: {
          "article_id": string;
          "event_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Insert: {
          "article_id": string;
          "event_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Update: {
          "article_id"?: string;
          "event_id"?: string;
          "relation_type"?: "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order"?: number;
        };
        Relationships: [
          { foreignKeyName: "article_events_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_events_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
        ];
      };
      "article_projects": {
        Row: {
          "article_id": string;
          "project_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Insert: {
          "article_id": string;
          "project_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Update: {
          "article_id"?: string;
          "project_id"?: string;
          "relation_type"?: "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order"?: number;
        };
        Relationships: [
          { foreignKeyName: "article_projects_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_projects_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "science_works"; referencedColumns: ["id"] },
        ];
      };
      "article_publications": {
        Row: {
          "article_id": string;
          "publication_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Insert: {
          "article_id": string;
          "publication_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Update: {
          "article_id"?: string;
          "publication_id"?: string;
          "relation_type"?: "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order"?: number;
        };
        Relationships: [
          { foreignKeyName: "article_publications_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_publications_publication_id_fkey"; columns: ["publication_id"]; isOneToOne: false; referencedRelation: "publications"; referencedColumns: ["id"] },
        ];
      };
      "article_research": {
        Row: {
          "article_id": string;
          "research_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Insert: {
          "article_id": string;
          "research_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Update: {
          "article_id"?: string;
          "research_id"?: string;
          "relation_type"?: "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order"?: number;
        };
        Relationships: [
          { foreignKeyName: "article_research_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_research_research_id_fkey"; columns: ["research_id"]; isOneToOne: false; referencedRelation: "science_works"; referencedColumns: ["id"] },
        ];
      };
      "article_reviews": {
        Row: {
          "id": string;
          "article_id": string;
          "content_version": number;
          "reviewer_id": string;
          "decision": "approved" | "changes_requested";
          "comment": string;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "article_id": string;
          "content_version": number;
          "reviewer_id": string;
          "decision": "approved" | "changes_requested";
          "comment": string;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "article_id"?: string;
          "content_version"?: number;
          "reviewer_id"?: string;
          "decision"?: "approved" | "changes_requested";
          "comment"?: string;
          "created_at"?: string;
        };
        Relationships: [
          { foreignKeyName: "article_reviews_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_reviews_reviewer_id_fkey"; columns: ["reviewer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      "article_revisions": {
        Row: {
          "id": string;
          "article_id": string;
          "revision_number": number;
          "content_version": number;
          "reason": "manual" | "review" | "publish" | "before_restore";
          "title_ru": string;
          "title_kk": string;
          "snapshot": Json;
          "created_by": string | null;
          "created_at": string;
          "is_system": boolean;
        };
        Insert: {
          "id"?: string;
          "article_id": string;
          "revision_number": number;
          "content_version": number;
          "reason": "manual" | "review" | "publish" | "before_restore";
          "title_ru": string;
          "title_kk": string;
          "snapshot": Json;
          "created_by"?: string | null;
          "created_at"?: string;
          "is_system"?: boolean;
        };
        Update: {
          "id"?: string;
          "article_id"?: string;
          "revision_number"?: number;
          "content_version"?: number;
          "reason"?: "manual" | "review" | "publish" | "before_restore";
          "title_ru"?: string;
          "title_kk"?: string;
          "snapshot"?: Json;
          "created_by"?: string | null;
          "created_at"?: string;
          "is_system"?: boolean;
        };
        Relationships: [
          { foreignKeyName: "article_revisions_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_revisions_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      "article_scientists": {
        Row: {
          "article_id": string;
          "scientist_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Insert: {
          "article_id": string;
          "scientist_id": string;
          "relation_type": "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order": number;
        };
        Update: {
          "article_id"?: string;
          "scientist_id"?: string;
          "relation_type"?: "author" | "subject" | "expert" | "mentioned" | "reviewer";
          "sort_order"?: number;
        };
        Relationships: [
          { foreignKeyName: "article_scientists_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_scientists_scientist_id_fkey"; columns: ["scientist_id"]; isOneToOne: false; referencedRelation: "scientist_profiles"; referencedColumns: ["id"] },
        ];
      };
      "article_tag_links": {
        Row: {
          "article_id": string;
          "tag_id": string;
          "created_at": string;
        };
        Insert: {
          "article_id": string;
          "tag_id": string;
          "created_at"?: string;
        };
        Update: {
          "article_id"?: string;
          "tag_id"?: string;
          "created_at"?: string;
        };
        Relationships: [
          { foreignKeyName: "article_tag_links_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_tag_links_tag_id_fkey"; columns: ["tag_id"]; isOneToOne: false; referencedRelation: "article_tags"; referencedColumns: ["id"] },
        ];
      };
      "article_tag_translations": {
        Row: {
          "tag_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
        };
        Insert: {
          "tag_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
        };
        Update: {
          "tag_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "name"?: string;
        };
        Relationships: [
          { foreignKeyName: "article_tag_translations_tag_id_fkey"; columns: ["tag_id"]; isOneToOne: false; referencedRelation: "article_tags"; referencedColumns: ["id"] },
        ];
      };
      "article_tags": {
        Row: {
          "id": string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "is_active": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "slug"?: string;
          "name_ru"?: string;
          "name_kk"?: string;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
        ];
      };
      "article_translations": {
        Row: {
          "id": string;
          "article_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "excerpt": string;
          "body": string;
          "seo_title": string | null;
          "seo_description": string | null;
          "created_at": string;
          "updated_at": string;
          "content_json": Json;
          "search_document": string | null;
        };
        Insert: {
          "id"?: string;
          "article_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "excerpt": string;
          "body": string;
          "seo_title"?: string | null;
          "seo_description"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "content_json": Json;
          "search_document"?: never;
        };
        Update: {
          "id"?: string;
          "article_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "title"?: string;
          "slug"?: string;
          "excerpt"?: string;
          "body"?: string;
          "seo_title"?: string | null;
          "seo_description"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "content_json"?: Json;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "article_translations_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
        ];
      };
      "article_type_translations": {
        Row: {
          "type_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
        };
        Insert: {
          "type_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
        };
        Update: {
          "type_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "name"?: string;
        };
        Relationships: [
          { foreignKeyName: "article_type_translations_type_id_fkey"; columns: ["type_id"]; isOneToOne: false; referencedRelation: "article_types"; referencedColumns: ["id"] },
        ];
      };
      "article_types": {
        Row: {
          "id": string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "is_active": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "slug"?: string;
          "name_ru"?: string;
          "name_kk"?: string;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
        ];
      };
      "articles": {
        Row: {
          "id": string;
          "author_id": string;
          "category_id": string | null;
          "cover_media_id": string | null;
          "content_type": string;
          "status": "draft" | "in_review" | "changes_requested" | "approved" | "scheduled" | "published" | "archived";
          "published_at": string | null;
          "created_at": string;
          "updated_at": string;
          "deleted_at": string | null;
          "scientific_reviewer_id": string | null;
          "content_version": number;
          "approved_version": number | null;
          "first_published_at": string | null;
          "updated_by": string | null;
          "requires_scientific_review": boolean;
          "scheduled_at": string | null;
          "scheduled_by": string | null;
        };
        Insert: {
          "id"?: string;
          "author_id": string;
          "category_id"?: string | null;
          "cover_media_id"?: string | null;
          "content_type"?: string;
          "status"?: "draft" | "in_review" | "changes_requested" | "approved" | "scheduled" | "published" | "archived";
          "published_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "scientific_reviewer_id"?: string | null;
          "content_version"?: number;
          "approved_version"?: number | null;
          "first_published_at"?: string | null;
          "updated_by"?: string | null;
          "requires_scientific_review"?: boolean;
          "scheduled_at"?: string | null;
          "scheduled_by"?: string | null;
        };
        Update: {
          "id"?: string;
          "author_id"?: string;
          "category_id"?: string | null;
          "cover_media_id"?: string | null;
          "content_type"?: string;
          "status"?: "draft" | "in_review" | "changes_requested" | "approved" | "scheduled" | "published" | "archived";
          "published_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "scientific_reviewer_id"?: string | null;
          "content_version"?: number;
          "approved_version"?: number | null;
          "first_published_at"?: string | null;
          "updated_by"?: string | null;
          "requires_scientific_review"?: boolean;
          "scheduled_at"?: string | null;
          "scheduled_by"?: string | null;
        };
        Relationships: [
          { foreignKeyName: "articles_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "articles_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "article_categories"; referencedColumns: ["id"] },
          { foreignKeyName: "articles_content_type_fkey"; columns: ["content_type"]; isOneToOne: false; referencedRelation: "article_types"; referencedColumns: ["slug"] },
          { foreignKeyName: "articles_cover_media_id_fkey"; columns: ["cover_media_id"]; isOneToOne: false; referencedRelation: "media_assets"; referencedColumns: ["id"] },
          { foreignKeyName: "articles_scheduled_by_fkey"; columns: ["scheduled_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "articles_scientific_reviewer_id_fkey"; columns: ["scientific_reviewer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "articles_updated_by_fkey"; columns: ["updated_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      "audit_logs": {
        Row: {
          "id": string;
          "user_id": string | null;
          "entity_type": string;
          "entity_id": string | null;
          "action": string;
          "old_data": Json | null;
          "new_data": Json | null;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "user_id"?: string | null;
          "entity_type": string;
          "entity_id"?: string | null;
          "action": string;
          "old_data"?: Json | null;
          "new_data"?: Json | null;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "user_id"?: string | null;
          "entity_type"?: string;
          "entity_id"?: string | null;
          "action"?: string;
          "old_data"?: Json | null;
          "new_data"?: Json | null;
          "created_at"?: string;
        };
        Relationships: [
          { foreignKeyName: "audit_logs_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      "author_translations": {
        Row: {
          "author_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
          "bio": string | null;
        };
        Insert: {
          "author_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
          "bio"?: string | null;
        };
        Update: {
          "author_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "name"?: string;
          "bio"?: string | null;
        };
        Relationships: [
          { foreignKeyName: "author_translations_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "authors"; referencedColumns: ["id"] },
        ];
      };
      "authors": {
        Row: {
          "id": string;
          "profile_id": string | null;
          "name_ru": string;
          "name_kk": string;
          "bio_ru": string | null;
          "bio_kk": string | null;
          "organization": string | null;
          "position": string | null;
          "website_url": string | null;
          "is_active": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "profile_id"?: string | null;
          "name_ru": string;
          "name_kk": string;
          "bio_ru"?: string | null;
          "bio_kk"?: string | null;
          "organization"?: string | null;
          "position"?: string | null;
          "website_url"?: string | null;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "profile_id"?: string | null;
          "name_ru"?: string;
          "name_kk"?: string;
          "bio_ru"?: string | null;
          "bio_kk"?: string | null;
          "organization"?: string | null;
          "position"?: string | null;
          "website_url"?: string | null;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          { foreignKeyName: "authors_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      "event_translations": {
        Row: {
          "event_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "summary": string;
          "description": string;
          "organizer": string;
          "location": string;
          "search_document": string | null;
        };
        Insert: {
          "event_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "summary": string;
          "description": string;
          "organizer": string;
          "location"?: string;
          "search_document"?: never;
        };
        Update: {
          "event_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "title"?: string;
          "slug"?: string;
          "summary"?: string;
          "description"?: string;
          "organizer"?: string;
          "location"?: string;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "event_translations_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
        ];
      };
      "events": {
        Row: {
          "id": string;
          "status": "draft" | "published" | "cancelled" | "archived";
          "kind": "conference" | "seminar" | "workshop" | "meetup";
          "format": "offline" | "online" | "hybrid";
          "starts_at": string;
          "ends_at": string;
          "registration_deadline": string | null;
          "registration_url": string | null;
          "external_url": string | null;
          "cover_media_id": string | null;
          "created_by": string;
          "published_at": string | null;
          "created_at": string;
          "updated_at": string;
          "deleted_at": string | null;
        };
        Insert: {
          "id"?: string;
          "status"?: "draft" | "published" | "cancelled" | "archived";
          "kind": "conference" | "seminar" | "workshop" | "meetup";
          "format": "offline" | "online" | "hybrid";
          "starts_at": string;
          "ends_at": string;
          "registration_deadline"?: string | null;
          "registration_url"?: string | null;
          "external_url"?: string | null;
          "cover_media_id"?: string | null;
          "created_by": string;
          "published_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
        };
        Update: {
          "id"?: string;
          "status"?: "draft" | "published" | "cancelled" | "archived";
          "kind"?: "conference" | "seminar" | "workshop" | "meetup";
          "format"?: "offline" | "online" | "hybrid";
          "starts_at"?: string;
          "ends_at"?: string;
          "registration_deadline"?: string | null;
          "registration_url"?: string | null;
          "external_url"?: string | null;
          "cover_media_id"?: string | null;
          "created_by"?: string;
          "published_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
        };
        Relationships: [
          { foreignKeyName: "events_cover_media_id_fkey"; columns: ["cover_media_id"]; isOneToOne: false; referencedRelation: "media_assets"; referencedColumns: ["id"] },
          { foreignKeyName: "events_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      "media_asset_translations": {
        Row: {
          "media_asset_id": string;
          "locale": "ru" | "kk" | "en";
          "alt_text": string | null;
          "caption": string | null;
        };
        Insert: {
          "media_asset_id": string;
          "locale": "ru" | "kk" | "en";
          "alt_text"?: string | null;
          "caption"?: string | null;
        };
        Update: {
          "media_asset_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "alt_text"?: string | null;
          "caption"?: string | null;
        };
        Relationships: [
          { foreignKeyName: "media_asset_translations_media_asset_id_fkey"; columns: ["media_asset_id"]; isOneToOne: false; referencedRelation: "media_assets"; referencedColumns: ["id"] },
        ];
      };
      "media_assets": {
        Row: {
          "id": string;
          "storage_bucket": string;
          "storage_path": string;
          "file_name": string;
          "mime_type": string;
          "file_size": number;
          "width": number | null;
          "height": number | null;
          "alt_ru": string | null;
          "alt_kk": string | null;
          "caption_ru": string | null;
          "caption_kk": string | null;
          "copyright_holder": string | null;
          "source_url": string | null;
          "uploaded_by": string;
          "status": "uploading" | "ready" | "failed";
          "created_at": string;
          "updated_at": string;
          "deleted_at": string | null;
          "search_document": string | null;
        };
        Insert: {
          "id"?: string;
          "storage_bucket": string;
          "storage_path": string;
          "file_name": string;
          "mime_type": string;
          "file_size": number;
          "width"?: number | null;
          "height"?: number | null;
          "alt_ru"?: string | null;
          "alt_kk"?: string | null;
          "caption_ru"?: string | null;
          "caption_kk"?: string | null;
          "copyright_holder"?: string | null;
          "source_url"?: string | null;
          "uploaded_by": string;
          "status"?: "uploading" | "ready" | "failed";
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "search_document"?: never;
        };
        Update: {
          "id"?: string;
          "storage_bucket"?: string;
          "storage_path"?: string;
          "file_name"?: string;
          "mime_type"?: string;
          "file_size"?: number;
          "width"?: number | null;
          "height"?: number | null;
          "alt_ru"?: string | null;
          "alt_kk"?: string | null;
          "caption_ru"?: string | null;
          "caption_kk"?: string | null;
          "copyright_holder"?: string | null;
          "source_url"?: string | null;
          "uploaded_by"?: string;
          "status"?: "uploading" | "ready" | "failed";
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "media_assets_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      "media_usages": {
        Row: {
          "id": string;
          "media_asset_id": string;
          "entity_type": string;
          "entity_id": string;
          "field_name": string;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "media_asset_id": string;
          "entity_type": string;
          "entity_id": string;
          "field_name": string;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "media_asset_id"?: string;
          "entity_type"?: string;
          "entity_id"?: string;
          "field_name"?: string;
          "created_at"?: string;
        };
        Relationships: [
          { foreignKeyName: "media_usages_media_asset_id_fkey"; columns: ["media_asset_id"]; isOneToOne: false; referencedRelation: "media_assets"; referencedColumns: ["id"] },
        ];
      };
      "mentorship_applications": {
        Row: {
          "id": string;
          "offer_id": string;
          "locale": "ru" | "kk" | "en";
          "full_name": string;
          "email": string;
          "motivation": string;
          "consent_at": string;
          "status": "new" | "in_review" | "accepted" | "rejected" | "completed";
          "manager_note": string;
          "created_at": string;
          "updated_at": string;
          "deleted_at": string | null;
          "search_document": string | null;
        };
        Insert: {
          "id"?: string;
          "offer_id": string;
          "locale": "ru" | "kk" | "en";
          "full_name": string;
          "email": string;
          "motivation": string;
          "consent_at"?: string;
          "status"?: "new" | "in_review" | "accepted" | "rejected" | "completed";
          "manager_note"?: string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "search_document"?: never;
        };
        Update: {
          "id"?: string;
          "offer_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "full_name"?: string;
          "email"?: string;
          "motivation"?: string;
          "consent_at"?: string;
          "status"?: "new" | "in_review" | "accepted" | "rejected" | "completed";
          "manager_note"?: string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "mentorship_applications_offer_id_fkey"; columns: ["offer_id"]; isOneToOne: false; referencedRelation: "mentorship_offers"; referencedColumns: ["id"] },
        ];
      };
      "mentorship_offer_translations": {
        Row: {
          "offer_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "summary": string;
          "description": string;
          "search_document": string | null;
        };
        Insert: {
          "offer_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "summary": string;
          "description": string;
          "search_document"?: never;
        };
        Update: {
          "offer_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "title"?: string;
          "slug"?: string;
          "summary"?: string;
          "description"?: string;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "mentorship_offer_translations_offer_id_fkey"; columns: ["offer_id"]; isOneToOne: false; referencedRelation: "mentorship_offers"; referencedColumns: ["id"] },
        ];
      };
      "mentorship_offers": {
        Row: {
          "id": string;
          "scientist_id": string;
          "field_id": string;
          "format": "online" | "offline" | "hybrid";
          "capacity": number;
          "status": "draft" | "published" | "archived";
          "created_by": string;
          "created_at": string;
          "updated_at": string;
          "deleted_at": string | null;
        };
        Insert: {
          "id"?: string;
          "scientist_id": string;
          "field_id": string;
          "format": "online" | "offline" | "hybrid";
          "capacity": number;
          "status"?: "draft" | "published" | "archived";
          "created_by": string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
        };
        Update: {
          "id"?: string;
          "scientist_id"?: string;
          "field_id"?: string;
          "format"?: "online" | "offline" | "hybrid";
          "capacity"?: number;
          "status"?: "draft" | "published" | "archived";
          "created_by"?: string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
        };
        Relationships: [
          { foreignKeyName: "mentorship_offers_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "mentorship_offers_field_id_fkey"; columns: ["field_id"]; isOneToOne: false; referencedRelation: "scientific_fields"; referencedColumns: ["id"] },
          { foreignKeyName: "mentorship_offers_scientist_id_fkey"; columns: ["scientist_id"]; isOneToOne: false; referencedRelation: "scientist_profiles"; referencedColumns: ["id"] },
        ];
      };
      "permissions": {
        Row: {
          "id": string;
          "code": string;
          "name": string;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "code": string;
          "name": string;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "code"?: string;
          "name"?: string;
          "created_at"?: string;
        };
        Relationships: [
        ];
      };
      "profiles": {
        Row: {
          "id": string;
          "display_name": string | null;
          "created_at": string;
          "updated_at": string;
          "search_document": string | null;
        };
        Insert: {
          "id": string;
          "display_name"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "search_document"?: never;
        };
        Update: {
          "id"?: string;
          "display_name"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "search_document"?: never;
        };
        Relationships: [
        ];
      };
      "publications": {
        Row: {
          "id": string;
          "scientist_id": string;
          "title": string;
          "year": number;
          "journal": string;
          "doi": string | null;
          "url": string | null;
          "publication_type": "article" | "conference" | "book" | "chapter" | "other";
          "status": "draft" | "published" | "archived";
          "created_by": string;
          "created_at": string;
          "updated_at": string;
          "published_at": string | null;
          "deleted_at": string | null;
          "search_document": string | null;
        };
        Insert: {
          "id"?: string;
          "scientist_id": string;
          "title": string;
          "year": number;
          "journal": string;
          "doi"?: string | null;
          "url"?: string | null;
          "publication_type": "article" | "conference" | "book" | "chapter" | "other";
          "status"?: "draft" | "published" | "archived";
          "created_by": string;
          "created_at"?: string;
          "updated_at"?: string;
          "published_at"?: string | null;
          "deleted_at"?: string | null;
          "search_document"?: never;
        };
        Update: {
          "id"?: string;
          "scientist_id"?: string;
          "title"?: string;
          "year"?: number;
          "journal"?: string;
          "doi"?: string | null;
          "url"?: string | null;
          "publication_type"?: "article" | "conference" | "book" | "chapter" | "other";
          "status"?: "draft" | "published" | "archived";
          "created_by"?: string;
          "created_at"?: string;
          "updated_at"?: string;
          "published_at"?: string | null;
          "deleted_at"?: string | null;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "publications_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "publications_scientist_id_fkey"; columns: ["scientist_id"]; isOneToOne: false; referencedRelation: "scientist_profiles"; referencedColumns: ["id"] },
        ];
      };
      "research_program_applications": {
        Row: {
          "id": string;
          "program_id": string;
          "locale": "ru" | "kk" | "en";
          "full_name": string;
          "email": string;
          "motivation": string;
          "consent_at": string;
          "status": "new" | "in_review" | "accepted" | "rejected" | "completed";
          "manager_note": string;
          "created_at": string;
          "updated_at": string;
          "deleted_at": string | null;
          "search_document": string | null;
        };
        Insert: {
          "id"?: string;
          "program_id": string;
          "locale": "ru" | "kk" | "en";
          "full_name": string;
          "email": string;
          "motivation": string;
          "consent_at"?: string;
          "status"?: "new" | "in_review" | "accepted" | "rejected" | "completed";
          "manager_note"?: string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "search_document"?: never;
        };
        Update: {
          "id"?: string;
          "program_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "full_name"?: string;
          "email"?: string;
          "motivation"?: string;
          "consent_at"?: string;
          "status"?: "new" | "in_review" | "accepted" | "rejected" | "completed";
          "manager_note"?: string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "research_program_applications_program_id_fkey"; columns: ["program_id"]; isOneToOne: false; referencedRelation: "research_programs"; referencedColumns: ["id"] },
        ];
      };
      "research_program_translations": {
        Row: {
          "program_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "summary": string;
          "description": string;
          "curriculum": string;
          "eligibility": string;
          "outcomes": string;
          "search_document": string | null;
        };
        Insert: {
          "program_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "summary": string;
          "description": string;
          "curriculum": string;
          "eligibility": string;
          "outcomes": string;
          "search_document"?: never;
        };
        Update: {
          "program_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "title"?: string;
          "slug"?: string;
          "summary"?: string;
          "description"?: string;
          "curriculum"?: string;
          "eligibility"?: string;
          "outcomes"?: string;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "research_program_translations_program_id_fkey"; columns: ["program_id"]; isOneToOne: false; referencedRelation: "research_programs"; referencedColumns: ["id"] },
        ];
      };
      "research_programs": {
        Row: {
          "id": string;
          "coordinator_id": string;
          "field_id": string;
          "format": "online" | "offline" | "hybrid";
          "capacity": number;
          "applications_open_on": string;
          "application_deadline": string;
          "starts_on": string;
          "ends_on": string;
          "status": "draft" | "published" | "archived";
          "created_by": string;
          "created_at": string;
          "updated_at": string;
          "deleted_at": string | null;
        };
        Insert: {
          "id"?: string;
          "coordinator_id": string;
          "field_id": string;
          "format": "online" | "offline" | "hybrid";
          "capacity": number;
          "applications_open_on": string;
          "application_deadline": string;
          "starts_on": string;
          "ends_on": string;
          "status"?: "draft" | "published" | "archived";
          "created_by": string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
        };
        Update: {
          "id"?: string;
          "coordinator_id"?: string;
          "field_id"?: string;
          "format"?: "online" | "offline" | "hybrid";
          "capacity"?: number;
          "applications_open_on"?: string;
          "application_deadline"?: string;
          "starts_on"?: string;
          "ends_on"?: string;
          "status"?: "draft" | "published" | "archived";
          "created_by"?: string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
        };
        Relationships: [
          { foreignKeyName: "research_programs_coordinator_id_fkey"; columns: ["coordinator_id"]; isOneToOne: false; referencedRelation: "scientist_profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "research_programs_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "research_programs_field_id_fkey"; columns: ["field_id"]; isOneToOne: false; referencedRelation: "scientific_fields"; referencedColumns: ["id"] },
        ];
      };
      "role_permissions": {
        Row: {
          "role_id": string;
          "permission_id": string;
        };
        Insert: {
          "role_id": string;
          "permission_id": string;
        };
        Update: {
          "role_id"?: string;
          "permission_id"?: string;
        };
        Relationships: [
          { foreignKeyName: "role_permissions_permission_id_fkey"; columns: ["permission_id"]; isOneToOne: false; referencedRelation: "permissions"; referencedColumns: ["id"] },
          { foreignKeyName: "role_permissions_role_id_fkey"; columns: ["role_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id"] },
        ];
      };
      "roles": {
        Row: {
          "id": string;
          "code": string;
          "name": string;
          "created_at": string;
        };
        Insert: {
          "id"?: string;
          "code": string;
          "name": string;
          "created_at"?: string;
        };
        Update: {
          "id"?: string;
          "code"?: string;
          "name"?: string;
          "created_at"?: string;
        };
        Relationships: [
        ];
      };
      "science_work_members": {
        Row: {
          "work_id": string;
          "scientist_id": string;
          "role": "lead" | "member";
        };
        Insert: {
          "work_id": string;
          "scientist_id": string;
          "role": "lead" | "member";
        };
        Update: {
          "work_id"?: string;
          "scientist_id"?: string;
          "role"?: "lead" | "member";
        };
        Relationships: [
          { foreignKeyName: "science_work_members_scientist_id_fkey"; columns: ["scientist_id"]; isOneToOne: false; referencedRelation: "scientist_profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "science_work_members_work_id_fkey"; columns: ["work_id"]; isOneToOne: false; referencedRelation: "science_works"; referencedColumns: ["id"] },
        ];
      };
      "science_work_translations": {
        Row: {
          "work_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "summary": string;
          "description": string;
          "results": string;
          "search_document": string | null;
        };
        Insert: {
          "work_id": string;
          "locale": "ru" | "kk" | "en";
          "title": string;
          "slug": string;
          "summary": string;
          "description": string;
          "results"?: string;
          "search_document"?: never;
        };
        Update: {
          "work_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "title"?: string;
          "slug"?: string;
          "summary"?: string;
          "description"?: string;
          "results"?: string;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "science_work_translations_work_id_fkey"; columns: ["work_id"]; isOneToOne: false; referencedRelation: "science_works"; referencedColumns: ["id"] },
        ];
      };
      "science_works": {
        Row: {
          "id": string;
          "kind": "research" | "project";
          "status": "draft" | "published" | "archived";
          "stage": "planned" | "active" | "completed";
          "organization_id": string | null;
          "field_id": string;
          "cover_media_id": string | null;
          "start_date": string | null;
          "end_date": string | null;
          "external_url": string | null;
          "doi": string | null;
          "created_by": string;
          "published_at": string | null;
          "created_at": string;
          "updated_at": string;
          "deleted_at": string | null;
        };
        Insert: {
          "id"?: string;
          "kind": "research" | "project";
          "status"?: "draft" | "published" | "archived";
          "stage"?: "planned" | "active" | "completed";
          "organization_id"?: string | null;
          "field_id": string;
          "cover_media_id"?: string | null;
          "start_date"?: string | null;
          "end_date"?: string | null;
          "external_url"?: string | null;
          "doi"?: string | null;
          "created_by": string;
          "published_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
        };
        Update: {
          "id"?: string;
          "kind"?: "research" | "project";
          "status"?: "draft" | "published" | "archived";
          "stage"?: "planned" | "active" | "completed";
          "organization_id"?: string | null;
          "field_id"?: string;
          "cover_media_id"?: string | null;
          "start_date"?: string | null;
          "end_date"?: string | null;
          "external_url"?: string | null;
          "doi"?: string | null;
          "created_by"?: string;
          "published_at"?: string | null;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
        };
        Relationships: [
          { foreignKeyName: "science_works_cover_media_id_fkey"; columns: ["cover_media_id"]; isOneToOne: false; referencedRelation: "media_assets"; referencedColumns: ["id"] },
          { foreignKeyName: "science_works_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "science_works_field_id_fkey"; columns: ["field_id"]; isOneToOne: false; referencedRelation: "scientific_fields"; referencedColumns: ["id"] },
          { foreignKeyName: "science_works_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "scientific_organizations"; referencedColumns: ["id"] },
        ];
      };
      "scientific_field_translations": {
        Row: {
          "field_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
        };
        Insert: {
          "field_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
        };
        Update: {
          "field_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "name"?: string;
        };
        Relationships: [
          { foreignKeyName: "scientific_field_translations_field_id_fkey"; columns: ["field_id"]; isOneToOne: false; referencedRelation: "scientific_fields"; referencedColumns: ["id"] },
        ];
      };
      "scientific_fields": {
        Row: {
          "id": string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "is_active": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "slug"?: string;
          "name_ru"?: string;
          "name_kk"?: string;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
        ];
      };
      "scientific_organization_translations": {
        Row: {
          "organization_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
          "city": string | null;
          "search_document": string | null;
        };
        Insert: {
          "organization_id": string;
          "locale": "ru" | "kk" | "en";
          "name": string;
          "city"?: string | null;
          "search_document"?: never;
        };
        Update: {
          "organization_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "name"?: string;
          "city"?: string | null;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "scientific_organization_translations_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "scientific_organizations"; referencedColumns: ["id"] },
        ];
      };
      "scientific_organizations": {
        Row: {
          "id": string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "city_ru": string | null;
          "city_kk": string | null;
          "website_url": string | null;
          "logo_media_id": string | null;
          "is_active": boolean;
          "created_at": string;
          "updated_at": string;
        };
        Insert: {
          "id"?: string;
          "slug": string;
          "name_ru": string;
          "name_kk": string;
          "city_ru"?: string | null;
          "city_kk"?: string | null;
          "website_url"?: string | null;
          "logo_media_id"?: string | null;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Update: {
          "id"?: string;
          "slug"?: string;
          "name_ru"?: string;
          "name_kk"?: string;
          "city_ru"?: string | null;
          "city_kk"?: string | null;
          "website_url"?: string | null;
          "logo_media_id"?: string | null;
          "is_active"?: boolean;
          "created_at"?: string;
          "updated_at"?: string;
        };
        Relationships: [
          { foreignKeyName: "scientific_organizations_logo_media_id_fkey"; columns: ["logo_media_id"]; isOneToOne: false; referencedRelation: "media_assets"; referencedColumns: ["id"] },
        ];
      };
      "scientist_field_links": {
        Row: {
          "scientist_profile_id": string;
          "scientific_field_id": string;
          "created_at": string;
        };
        Insert: {
          "scientist_profile_id": string;
          "scientific_field_id": string;
          "created_at"?: string;
        };
        Update: {
          "scientist_profile_id"?: string;
          "scientific_field_id"?: string;
          "created_at"?: string;
        };
        Relationships: [
          { foreignKeyName: "scientist_field_links_scientific_field_id_fkey"; columns: ["scientific_field_id"]; isOneToOne: false; referencedRelation: "scientific_fields"; referencedColumns: ["id"] },
          { foreignKeyName: "scientist_field_links_scientist_profile_id_fkey"; columns: ["scientist_profile_id"]; isOneToOne: false; referencedRelation: "scientist_profiles"; referencedColumns: ["id"] },
        ];
      };
      "scientist_profile_translations": {
        Row: {
          "id": string;
          "scientist_profile_id": string;
          "locale": "ru" | "kk" | "en";
          "full_name": string;
          "slug": string;
          "position": string;
          "academic_degree": string | null;
          "short_bio": string;
          "biography": string;
          "created_at": string;
          "updated_at": string;
          "search_document": string | null;
        };
        Insert: {
          "id"?: string;
          "scientist_profile_id": string;
          "locale": "ru" | "kk" | "en";
          "full_name": string;
          "slug": string;
          "position": string;
          "academic_degree"?: string | null;
          "short_bio": string;
          "biography": string;
          "created_at"?: string;
          "updated_at"?: string;
          "search_document"?: never;
        };
        Update: {
          "id"?: string;
          "scientist_profile_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "full_name"?: string;
          "slug"?: string;
          "position"?: string;
          "academic_degree"?: string | null;
          "short_bio"?: string;
          "biography"?: string;
          "created_at"?: string;
          "updated_at"?: string;
          "search_document"?: never;
        };
        Relationships: [
          { foreignKeyName: "scientist_profile_translations_scientist_profile_id_fkey"; columns: ["scientist_profile_id"]; isOneToOne: false; referencedRelation: "scientist_profiles"; referencedColumns: ["id"] },
        ];
      };
      "scientist_profiles": {
        Row: {
          "id": string;
          "user_id": string | null;
          "organization_id": string | null;
          "avatar_media_id": string | null;
          "status": "draft" | "verified";
          "public_email": string | null;
          "orcid": string | null;
          "scholar_url": string | null;
          "verified_at": string | null;
          "verified_by": string | null;
          "created_by": string;
          "created_at": string;
          "updated_at": string;
          "deleted_at": string | null;
          "first_verified_at": string | null;
        };
        Insert: {
          "id"?: string;
          "user_id"?: string | null;
          "organization_id"?: string | null;
          "avatar_media_id"?: string | null;
          "status"?: "draft" | "verified";
          "public_email"?: string | null;
          "orcid"?: string | null;
          "scholar_url"?: string | null;
          "verified_at"?: string | null;
          "verified_by"?: string | null;
          "created_by": string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "first_verified_at"?: string | null;
        };
        Update: {
          "id"?: string;
          "user_id"?: string | null;
          "organization_id"?: string | null;
          "avatar_media_id"?: string | null;
          "status"?: "draft" | "verified";
          "public_email"?: string | null;
          "orcid"?: string | null;
          "scholar_url"?: string | null;
          "verified_at"?: string | null;
          "verified_by"?: string | null;
          "created_by"?: string;
          "created_at"?: string;
          "updated_at"?: string;
          "deleted_at"?: string | null;
          "first_verified_at"?: string | null;
        };
        Relationships: [
          { foreignKeyName: "scientist_profiles_avatar_media_id_fkey"; columns: ["avatar_media_id"]; isOneToOne: false; referencedRelation: "media_assets"; referencedColumns: ["id"] },
          { foreignKeyName: "scientist_profiles_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "scientist_profiles_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "scientific_organizations"; referencedColumns: ["id"] },
          { foreignKeyName: "scientist_profiles_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "scientist_profiles_verified_by_fkey"; columns: ["verified_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      "slug_redirects": {
        Row: {
          "entity_type": "article" | "scientist";
          "entity_id": string;
          "locale": "ru" | "kk" | "en";
          "old_slug": string;
          "created_at": string;
        };
        Insert: {
          "entity_type": "article" | "scientist";
          "entity_id": string;
          "locale": "ru" | "kk" | "en";
          "old_slug": string;
          "created_at"?: string;
        };
        Update: {
          "entity_type"?: "article" | "scientist";
          "entity_id"?: string;
          "locale"?: "ru" | "kk" | "en";
          "old_slug"?: string;
          "created_at"?: string;
        };
        Relationships: [
        ];
      };
      "user_roles": {
        Row: {
          "user_id": string;
          "role_id": string;
          "assigned_by": string | null;
          "assigned_at": string;
        };
        Insert: {
          "user_id": string;
          "role_id": string;
          "assigned_by"?: string | null;
          "assigned_at"?: string;
        };
        Update: {
          "user_id"?: string;
          "role_id"?: string;
          "assigned_by"?: string | null;
          "assigned_at"?: string;
        };
        Relationships: [
          { foreignKeyName: "user_roles_assigned_by_fkey"; columns: ["assigned_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "user_roles_role_id_fkey"; columns: ["role_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id"] },
          { foreignKeyName: "user_roles_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: {
      "search_entries": {
        Row: {
          "id": string | null;
          "section": string | null;
          "locale": string | null;
          "title": string | null;
          "summary": string | null;
          "href": string | null;
          "admin_href": string | null;
          "is_public": boolean | null;
          "admin_allowed": boolean | null;
          "sort_at": string | null;
          "updated_at": string | null;
          "search_document": string | null;
          "attributes": Json | null;
        };
        Relationships: [];
      };
      "smu_article_links": {
        Row: {
          "article_id": string | null;
          "kind": string | null;
          "entity_id": string | null;
          "relation_type": string | null;
          "sort_order": number | null;
        };
        Relationships: [];
      };
      "smu_public_relation_targets": {
        Row: {
          "kind": string | null;
          "entity_id": string | null;
          "locale": string | null;
          "title": string | null;
          "href": string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      "article_version_publishable": {
        Args: {
          "p_id": string | null;
        };
        Returns: boolean;
      };
      "assert_restorable_article_links": {
        Args: {
          "p_id": string | null;
        };
        Returns: undefined;
      };
      "assign_article_reviewer": {
        Args: {
          "p_id": string | null;
          "p_reviewer": string | null;
        };
        Returns: undefined;
      };
      "capture_article_revision": {
        Args: {
          "p_id": string | null;
          "p_reason": string | null;
        };
        Returns: string;
      };
      "change_article_state": {
        Args: {
          "p_id": string | null;
          "p_status": "draft" | "in_review" | "changes_requested" | "approved" | "scheduled" | "published" | "archived" | null;
          "p_delete"?: boolean | null;
          "p_expected_version"?: number | null;
        };
        Returns: undefined;
      };
      "change_article_state_before_scheduling": {
        Args: {
          "p_id": string | null;
          "p_status": "draft" | "in_review" | "changes_requested" | "approved" | "scheduled" | "published" | "archived" | null;
          "p_delete"?: boolean | null;
          "p_expected_version"?: number | null;
        };
        Returns: undefined;
      };
      "change_event_state": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_status": "draft" | "published" | "cancelled" | "archived" | null;
          "p_delete"?: boolean | null;
        };
        Returns: undefined;
      };
      "change_mentorship_offer_state": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_status": "draft" | "published" | "archived" | null;
          "p_delete"?: boolean | null;
        };
        Returns: undefined;
      };
      "change_research_program_state": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_status": "draft" | "published" | "archived" | null;
          "p_delete"?: boolean | null;
        };
        Returns: undefined;
      };
      "change_science_work_state": {
        Args: {
          "p_id": string | null;
          "p_kind": "research" | "project" | null;
          "p_actor": string | null;
          "p_status": "draft" | "published" | "archived" | null;
          "p_delete"?: boolean | null;
        };
        Returns: undefined;
      };
      "change_scientist_state": {
        Args: {
          "p_id": string | null;
          "p_status": "draft" | "verified" | null;
          "p_delete"?: boolean | null;
        };
        Returns: undefined;
      };
      "configure_article_review": {
        Args: {
          "p_id": string | null;
          "p_requires_scientific_review": boolean | null;
          "p_reviewer": string | null;
        };
        Returns: undefined;
      };
      "create_article_revision": {
        Args: {
          "p_id": string | null;
          "p_expected_version": number | null;
        };
        Returns: string;
      };
      "create_article_taxonomy": {
        Args: {
          "p_input": Json | null;
        };
        Returns: string;
      };
      "create_scientist_taxonomy": {
        Args: {
          "p_input": Json | null;
        };
        Returns: string;
      };
      "create_scientist_taxonomy_legacy_locales": {
        Args: {
          "p_input": Json | null;
        };
        Returns: string;
      };
      "has_permission": {
        Args: {
          "permission_code": string | null;
        };
        Returns: boolean;
      };
      "list_article_author_profiles": {
        Args: Record<string, never>;
        Returns: ({ "id": string | null; "display_name": string | null })[];
      };
      "list_article_reviewers": {
        Args: Record<string, never>;
        Returns: ({ "id": string | null; "display_name": string | null })[];
      };
      "list_article_reviews": {
        Args: {
          "p_id": string | null;
        };
        Returns: ({ "id": string | null; "article_id": string | null; "content_version": number | null; "reviewer_id": string | null; "reviewer_name": string | null; "decision": string | null; "comment": string | null; "created_at": string | null })[];
      };
      "list_deleted_editorial_records": {
        Args: {
          "p_kind"?: string | null;
          "p_query"?: string | null;
          "p_page"?: number | null;
        };
        Returns: ({ "id": string | null; "entity_type": string | null; "title_ru": string | null; "title_kk": string | null; "status": string | null; "deleted_at": string | null })[];
      };
      "list_public_publications": {
        Args: {
          "p_locale": string | null;
          "p_id"?: string | null;
          "p_scientist"?: string | null;
        };
        Returns: ({ "id": string | null; "scientist_id": string | null; "title": string | null; "year": number | null; "journal": string | null; "doi": string | null; "url": string | null; "publication_type": string | null; "scientist_name": string | null; "scientist_href": string | null })[];
      };
      "preserve_smu_slug": {
        Args: {
          "p_type": string | null;
          "p_id": string | null;
          "p_locale": string | null;
          "p_old": string | null;
          "p_new": string | null;
          "p_was_public": boolean | null;
        };
        Returns: undefined;
      };
      "public_article_relations": {
        Args: {
          "p_article": string | null;
          "p_locale": string | null;
        };
        Returns: ({ "kind": string | null; "entity_id": string | null; "title": string | null; "href": string | null; "relation_type": string | null })[];
      };
      "public_related_articles": {
        Args: {
          "p_kind": string | null;
          "p_entity": string | null;
          "p_locale": string | null;
        };
        Returns: ({ "id": string | null; "title": string | null; "href": string | null; "excerpt": string | null; "relation_type": string | null })[];
      };
      "publish_scheduled_articles": {
        Args: {
          "p_limit"?: number | null;
        };
        Returns: Json;
      };
      "require_smu_session": {
        Args: Record<string, never>;
        Returns: string;
      };
      "restore_article_revision": {
        Args: {
          "p_id": string | null;
          "p_revision": string | null;
          "p_expected_version": number | null;
        };
        Returns: number;
      };
      "restore_deleted_article": {
        Args: {
          "p_id": string | null;
          "p_expected_deleted_at": string | null;
        };
        Returns: undefined;
      };
      "restore_deleted_scientist": {
        Args: {
          "p_id": string | null;
          "p_expected_deleted_at": string | null;
        };
        Returns: undefined;
      };
      "save_article": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_article_author": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_article_author_legacy_locales": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_article_content": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_article_required_locales": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_article_taxonomy": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_article_taxonomy_legacy_locales": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_event": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_event_required_locales": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_media_metadata": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: undefined;
      };
      "save_mentorship_offer": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_mentorship_offer_required_locales": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_publication": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_research_program": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_research_program_required_locales": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_science_work": {
        Args: {
          "p_id": string | null;
          "p_kind": "research" | "project" | null;
          "p_actor": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_science_work_required_locales": {
        Args: {
          "p_id": string | null;
          "p_kind": "research" | "project" | null;
          "p_actor": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_scientist": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "save_scientist_required_locales": {
        Args: {
          "p_id": string | null;
          "p_input": Json | null;
        };
        Returns: string;
      };
      "schedule_article": {
        Args: {
          "p_id": string | null;
          "p_expected_version": number | null;
          "p_scheduled_at": string | null;
          "p_expected_scheduled_at"?: string | null;
        };
        Returns: undefined;
      };
      "search_admin": {
        Args: {
          "p_query": string | null;
          "p_section"?: string | null;
          "p_page"?: number | null;
          "p_page_size"?: number | null;
        };
        Returns: Json;
      };
      "search_article_relation_targets": {
        Args: {
          "p_kind": string | null;
          "p_query"?: string | null;
          "p_ids"?: (string)[] | null;
        };
        Returns: ({ "kind": string | null; "entity_id": string | null; "title_ru": string | null; "title_kk": string | null })[];
      };
      "search_public": {
        Args: {
          "p_locale": string | null;
          "p_query"?: string | null;
          "p_section"?: string | null;
          "p_filters"?: Json | null;
          "p_page"?: number | null;
          "p_page_size"?: number | null;
        };
        Returns: Json;
      };
      "search_vector": {
        Args: {
          "p_locale": string | null;
          "p_title": string | null;
          "p_body": string | null;
        };
        Returns: string;
      };
      "seo_public_feed": {
        Args: {
          "p_locale": string | null;
          "p_limit"?: number | null;
        };
        Returns: Json;
      };
      "seo_public_page": {
        Args: {
          "p_page"?: number | null;
          "p_page_size"?: number | null;
          "p_section"?: string | null;
          "p_id"?: string | null;
        };
        Returns: Json;
      };
      "smu_plain_text_document": {
        Args: {
          "p_text": string | null;
        };
        Returns: Json;
      };
      "submit_article_review": {
        Args: {
          "p_id": string | null;
          "p_expected_version": number | null;
          "p_decision": string | null;
          "p_comment": string | null;
        };
        Returns: string;
      };
      "submit_mentorship_application": {
        Args: {
          "p_offer": string | null;
          "p_input": Json | null;
        };
        Returns: undefined;
      };
      "submit_research_program_application": {
        Args: {
          "p_program": string | null;
          "p_input": Json | null;
        };
        Returns: undefined;
      };
      "update_mentorship_application": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_status": "new" | "in_review" | "accepted" | "rejected" | "completed" | null;
          "p_note": string | null;
        };
        Returns: undefined;
      };
      "update_research_program_application": {
        Args: {
          "p_id": string | null;
          "p_actor": string | null;
          "p_status": "new" | "in_review" | "accepted" | "rejected" | "completed" | null;
          "p_note": string | null;
        };
        Returns: undefined;
      };
      "validate_smu_rich_text": {
        Args: {
          "p_node": Json | null;
          "p_parent"?: string | null;
          "p_depth"?: number | null;
        };
        Returns: string;
      };
    };
    Enums: {
      "article_content_type": "article" | "news" | "interview" | "announcement";
      "article_status": "draft" | "in_review" | "changes_requested" | "approved" | "scheduled" | "published" | "archived";
      "event_format": "offline" | "online" | "hybrid";
      "event_kind": "conference" | "seminar" | "workshop" | "meetup";
      "event_status": "draft" | "published" | "cancelled" | "archived";
      "media_asset_status": "uploading" | "ready" | "failed";
      "mentorship_application_status": "new" | "in_review" | "accepted" | "rejected" | "completed";
      "mentorship_offer_status": "draft" | "published" | "archived";
      "research_program_application_status": "new" | "in_review" | "accepted" | "rejected" | "completed";
      "research_program_status": "draft" | "published" | "archived";
      "science_work_kind": "research" | "project";
      "science_work_stage": "planned" | "active" | "completed";
      "science_work_status": "draft" | "published" | "archived";
      "scientist_profile_status": "draft" | "verified";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];
export type Functions = Database["public"]["Functions"];
