export const pageKeys = [
  "about",
  "foundation",
  "team",
  "partners",
  "documents",
  "contacts",
  "research_program",
  "it_support",
  "publication_support",
] as const;

export type PageKey = (typeof pageKeys)[number];

export const sectionKeys = [
  "hero",
  "featured_research",
  "featured_scientists",
  "research_program",
  "mentorship",
  "scientist_support",
  "latest_articles",
  "opportunities",
  "events",
  "results",
  "partners",
] as const;

export const settingKeys = ["site_name", "contact_email", "social_links"] as const;

export const contentLabels: Record<string, string> = {
  about: "О СМУ",
  foundation: "Фонд",
  team: "Команда",
  partners: "Партнёры",
  documents: "Документы",
  contacts: "Контакты",
  research_program: "Research Program",
  it_support: "IT для учёных",
  publication_support: "Поддержка публикаций",
  hero: "Главный блок",
  featured_research: "Исследования",
  featured_scientists: "Учёные",
  mentorship: "Наставничество",
  scientist_support: "Поддержка учёных",
  latest_articles: "Последние статьи",
  opportunities: "Возможности",
  events: "События",
  results: "Результаты",
  site_name: "Название сайта",
  contact_email: "Контактный email",
  social_links: "Социальные ссылки",
};
