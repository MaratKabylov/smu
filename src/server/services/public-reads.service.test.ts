import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  configured: vi.fn(), anonymous: vi.fn(), session: vi.fn(), privileged: vi.fn(),
  repositoryClients: [] as unknown[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));
vi.mock("@/lib/supabase/public", () => ({ createPublicSupabaseClient: mocks.anonymous }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.session }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: mocks.privileged }));
const { Repository, ScienceRepository, MentorshipRepository, ProgramRepository, ListRepository } = vi.hoisted(() => {
class Repository {
  constructor(client: unknown) { mocks.repositoryClients.push(client); }
  async listTaxonomy() { return { categories: [], tags: [], authors: [], contentTypes: [], organizations: [], fields: [] }; }
  async list() { return []; }
  async getBySlug() { return null; }
  async getPublicBySlug() { return null; }
  async publicPage() { return { items: [], total: 0, page: 1, pageSize: 12 }; }
  async publicRelations() { return []; }
  async relatedArticles() { return []; }
}
class ScienceRepository extends Repository { async listPublic() { return { works: [], taxonomy: {} }; } }
class MentorshipRepository extends Repository { async listPublic() { return { offers: [], taxonomy: {} }; } }
class ProgramRepository extends Repository { async listPublic() { return { programs: [], taxonomy: {} }; } }
class ListRepository extends Repository { async listPublic() { return []; } }
return { Repository, ScienceRepository, MentorshipRepository, ProgramRepository, ListRepository };
});
vi.mock("@/server/repositories/public-article.repository", () => ({ PublicArticleRepository: Repository }));
vi.mock("@/server/repositories/scientist.repository", () => ({ ScientistRepository: Repository, PublicScientistRepository: Repository }));
vi.mock("@/server/repositories/science-work.repository", () => ({ ScienceWorkRepository: ScienceRepository }));
vi.mock("@/server/repositories/event.repository", () => ({ EventRepository: ListRepository }));
vi.mock("@/server/repositories/mentorship.repository", () => ({ MentorshipRepository }));
vi.mock("@/server/repositories/research-program.repository", () => ({ ResearchProgramRepository: ProgramRepository }));
vi.mock("@/server/repositories/publication.repository", () => ({ PublicationRepository: ListRepository }));
vi.mock("@/server/repositories/search.repository", () => ({ SearchRepository: Repository }));
vi.mock("@/server/repositories/article-relations.repository", () => ({ ArticleRelationsRepository: Repository }));
vi.mock("@/server/repositories/slug.repository", () => ({ getPublicSlugRedirect: (client: unknown) => { mocks.repositoryClients.push(client); return null; } }));
import { PublicArticleService } from "./public-article.service";
import { PublicScientistService } from "./scientist.service";
import { PublicScienceWorkService } from "./science-work.service";
import { PublicEventService } from "./event.service";
import { PublicMentorshipService } from "./mentorship.service";
import { PublicResearchProgramService } from "./research-program.service";
import { PublicationService } from "./publication.service";
import { ArticleRelationsService } from "./article-relations.service";
import { SearchService } from "./search.service";
import { publicArticleFiltersSchema } from "@/lib/validation/article";
import { publicScientistFiltersSchema } from "@/lib/validation/scientist";
import { publicScienceWorkFiltersSchema } from "@/lib/validation/science-work";
import { publicEventFiltersSchema } from "@/lib/validation/event";
import { mentorshipFiltersSchema } from "@/lib/validation/mentorship";
import { researchProgramFiltersSchema } from "@/lib/validation/research-program";

const anonClient = { session: null };
beforeEach(() => {
  vi.clearAllMocks(); mocks.repositoryClients.length = 0;
  mocks.configured.mockReturnValue(true); mocks.anonymous.mockReturnValue(anonClient);
  mocks.session.mockImplementation(() => { throw new Error("public read accessed visitor session"); });
  mocks.privileged.mockImplementation(() => { throw new Error("public read accessed service role"); });
});
const reads = [
  { name: "journal", run: async () => { const service = new PublicArticleService(); const filters = publicArticleFiltersSchema.parse({ locale: "en" }); await service.listPage(filters, 2); await service.list(filters); await service.getBySlug("en", "water"); await service.getSlugRedirect("en", "old"); } },
  { name: "scientists", run: async () => { const service = new PublicScientistService(); const filters = publicScientistFiltersSchema.parse({ locale: "kk" }); await service.listPage(filters, 2); await service.list(filters); await service.getBySlug("kk", "water"); await service.getSlugRedirect("kk", "old"); } },
  ...(["project", "research"] as const).map(kind => ({ name: kind, run: async () => { const service = new PublicScienceWorkService(); const filters = publicScienceWorkFiltersSchema.parse({ locale: "ru" }); await service.listPage(kind, filters); await service.list(kind, filters); await service.getBySlug(kind, "ru", "water"); } })),
  { name: "events", run: async () => { const service = new PublicEventService(); const filters = publicEventFiltersSchema.parse({ locale: "en" }); await service.listPage(filters); await service.list(filters); await service.getBySlug("en", "water"); } },
  { name: "mentorship", run: async () => { const service = new PublicMentorshipService(); const filters = mentorshipFiltersSchema.parse({ locale: "kk" }); await service.listPage(filters); await service.list(filters); await service.getBySlug("kk", "water"); } },
  { name: "research programme", run: async () => { const service = new PublicResearchProgramService(); const filters = researchProgramFiltersSchema.parse({ locale: "ru" }); await service.listPage(filters); await service.list(filters); await service.getBySlug("ru", "water"); } },
  { name: "publications", run: async () => { const service = new PublicationService(); await service.listPublicPage("en", "water", 2); await service.listPublic("en"); } },
  { name: "relations", run: async () => { const service = new ArticleRelationsService(); await service.publicRelations("article", "kk"); await service.relatedArticles("scientist", "scientist", "kk"); } },
  { name: "global search", run: () => new SearchService().publicPage("en", "water", "", 2) },
];
describe("public read session isolation", () => {
  it.each(reads)("uses anonymous repositories for every $name read", async ({ run }) => {
    await run();
    expect(mocks.anonymous).toHaveBeenCalled();
    expect(mocks.repositoryClients.length).toBeGreaterThan(0);
    expect(mocks.repositoryClients.every(client => client === anonClient)).toBe(true);
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.privileged).not.toHaveBeenCalled();
  });
});
