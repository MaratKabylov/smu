export const publicationTypes = ["article", "conference", "book", "chapter", "other"] as const;
export type PublicationType = (typeof publicationTypes)[number];
export type Publication = {
  id: string; scientistId: string; title: string; year: number; journal: string;
  doi: string | null; url: string | null; publicationType: PublicationType;
  status: "draft" | "published" | "archived"; updatedAt: string;
};
export type PublicPublication = Omit<Publication, "status" | "updatedAt"> & { scientistName: string; scientistHref: string };
export const publicationTypeLabels = {
  ru: { article: "Научная статья", conference: "Материал конференции", book: "Книга", chapter: "Глава книги", other: "Другое" },
  kk: { article: "Ғылыми мақала", conference: "Конференция материалы", book: "Кітап", chapter: "Кітап тарауы", other: "Басқа" },
};
