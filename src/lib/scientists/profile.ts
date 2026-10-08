export const verificationStatuses = ["unverified", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof verificationStatuses)[number];
export const verificationLabels: Record<VerificationStatus, string> = {
  unverified: "Не проверен", pending: "Ожидает проверки", verified: "Верифицирован", rejected: "Отклонён",
};
export const scientistLinkTypes = ["orcid", "google_scholar", "scopus", "researchgate", "linkedin", "website"] as const;
export type ScientistLinkType = (typeof scientistLinkTypes)[number];
export type ScientistLink = { type: ScientistLinkType; url: string };
export const scientistLinkLabels: Record<ScientistLinkType, string> = {
  orcid: "ORCID", google_scholar: "Google Scholar", scopus: "Scopus", researchgate: "ResearchGate", linkedin: "LinkedIn", website: "Website",
};
export const collaborationKeys = ["collaboration", "mentoring", "media", "students", "projects", "looking_for_students", "coauthoring", "reviewing", "consulting", "project_supervision"] as const;
export type Collaboration = Partial<Record<(typeof collaborationKeys)[number], boolean>>;
export const collaborationLabels = {
  ru: ["Сотрудничество", "Наставничество", "СМИ", "Работа со студентами", "Совместные проекты", "Поиск студентов", "Соавторство", "Рецензирование", "Консультации", "Руководство проектами"],
  kk: ["Ынтымақтастық", "Тәлімгерлік", "БАҚ", "Студенттермен жұмыс", "Бірлескен жобалар", "Студенттерді іздеу", "Бірлескен авторлық", "Рецензиялау", "Кеңес беру", "Жобаларға жетекшілік"],
  en: ["Collaboration", "Mentoring", "Media", "Working with students", "Joint projects", "Looking for students", "Coauthoring", "Peer review", "Consulting", "Project supervision"],
} as const;
