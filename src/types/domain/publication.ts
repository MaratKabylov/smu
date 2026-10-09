export const publicationTypes = ["article", "conference", "book", "chapter", "other"] as const;
export type PublicationType = (typeof publicationTypes)[number];
export type PublicationCoauthor = { scientistId: string | null; name: string; affiliation: string };
export type PublicPublicationAuthor = PublicationCoauthor & { href: string | null };
export type PublicPublicationWork = { id: string; kind: "research" | "project"; title: string; href: string };
export type Publication = {
  id: string; scientistId: string; title: string; year: number; journal: string;
  doi: string | null; url: string | null; publicationType: PublicationType;
  status: "draft" | "published" | "archived"; updatedAt: string;
  coauthors: PublicationCoauthor[]; workIds: string[];
};
export type PublicPublication = Omit<Publication, "status" | "updatedAt" | "coauthors" | "workIds"> & {
  scientistName: string; scientistHref: string; authors: PublicPublicationAuthor[]; works: PublicPublicationWork[];
};
export const publicationTypeLabels = {
  ru: { article: "Научная статья", conference: "Материал конференции", book: "Книга", chapter: "Глава книги", other: "Другое" },
  kk: { article: "Ғылыми мақала", conference: "Конференция материалы", book: "Кітап", chapter: "Кітап тарауы", other: "Басқа" },
  en: { article: "Research article", conference: "Conference paper", book: "Book", chapter: "Book chapter", other: "Other" },
};
