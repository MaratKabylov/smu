import type { Locale } from "./locales";

const common = {
  ru: {
    navigation: "Основная навигация", language: "Выбор языка", region: "Актюбинская область", footer: "Совет молодых учёных",
    sections: { journal: "Журнал", scientists: "Учёные", research: "Исследования", projects: "Проекты", publications: "Публикации", mentorship: "Наставничество", "research-program": "Research Program", events: "События" },
    brands: { journal: "Журнал молодых учёных", scientists: "Научное сообщество", research: "Исследования", projects: "Научные проекты", publications: "Научные публикации", mentorship: "Наставничество", "research-program": "Research Program", events: "События" },
  },
  kk: {
    navigation: "Негізгі навигация", language: "Тілді таңдау", region: "Ақтөбе облысы", footer: "Жас ғалымдар кеңесі",
    sections: { journal: "Журнал", scientists: "Ғалымдар", research: "Зерттеулер", projects: "Жобалар", publications: "Жарияланымдар", mentorship: "Тәлімгерлік", "research-program": "Зерттеу бағдарламасы", events: "Іс-шаралар" },
    brands: { journal: "Жас ғалымдар журналы", scientists: "Ғылыми қауымдастық", research: "Зерттеулер", projects: "Ғылыми жобалар", publications: "Ғылыми жарияланымдар", mentorship: "Тәлімгерлік", "research-program": "Зерттеу бағдарламасы", events: "Іс-шаралар" },
  },
  en: {
    navigation: "Main navigation", language: "Choose language", region: "Aktobe Region", footer: "Council of Young Scientists",
    sections: { journal: "Journal", scientists: "Scientists", research: "Research", projects: "Projects", publications: "Publications", mentorship: "Mentorship", "research-program": "Research Program", events: "Events" },
    brands: { journal: "Young Scientists Journal", scientists: "Scientific community", research: "Research", projects: "Research projects", publications: "Scientific publications", mentorship: "Mentorship", "research-program": "Research Program", events: "Events" },
  },
} as const;
const journalCatalog = {
  ru: {
    eyebrow: "Наука · люди · регион",
    title: "Идеи, которые меняют будущее региона",
    intro: "Исследования, истории и новости научного сообщества Актюбинской области — на русском и казахском языках.",
    categories: "Категории материалов",
    allCategories: "Все материалы",
    search: "Поиск по заголовку",
    tag: "Тематический тег",
    allTags: "Все темы",
    find: "Найти",
    materials: "материалов",
    notFound: "Материалы не найдены",
    changeFilters: "Попробуйте изменить запрос, категорию или тематический тег.",
    empty: "Журнал пока готовится к публикации",
    emptyHint: "Здесь появятся новости, интервью и статьи молодых учёных региона.",
    reset: "Сбросить фильтры",
  },
  kk: {
    eyebrow: "Ғылым · адамдар · өңір",
    title: "Өңірдің болашағын өзгертетін идеялар",
    intro: "Ақтөбе облысының ғылыми қоғамдастығы туралы зерттеулер, оқиғалар мен жаңалықтар қазақ және орыс тілдерінде.",
    categories: "Материалдар санаттары",
    allCategories: "Барлық материалдар",
    search: "Тақырып бойынша іздеу",
    tag: "Тақырыптық белгі",
    allTags: "Барлық тақырыптар",
    find: "Іздеу",
    materials: "материал",
    notFound: "Материалдар табылмады",
    changeFilters: "Сұрауды, санатты немесе тақырыптық белгіні өзгертіп көріңіз.",
    empty: "Журнал жариялануға дайындалуда",
    emptyHint: "Мұнда өңірдің жас ғалымдарының жаңалықтары, сұхбаттары мен мақалалары шығады.",
    reset: "Сүзгілерді қалпына келтіру",
  },
  en: {
    eyebrow: "Science · people · region",
    title: "Ideas shaping the region's future",
    intro: "Research, stories and news from the scientific community of the Aktobe Region.",
    categories: "Content categories", allCategories: "All content", search: "Search by title", tag: "Topic tag",
    allTags: "All topics", find: "Search", materials: "items", notFound: "No content found",
    changeFilters: "Try changing the query, category or topic tag.", empty: "The journal is preparing for publication",
    emptyHint: "News, interviews and articles by the region's young scientists will appear here.", reset: "Reset filters",
  },
} as const;

const scientistCatalog = {
  ru: { eyebrow: "Люди науки", title: "Исследователи, которые развивают регион", intro: "Найдите экспертов, коллег и партнёров среди учёных Актюбинской области.", profiles: "профилей в каталоге", search: "Поиск по имени", organization: "Организация", allOrganizations: "Все организации", field: "Направление", allFields: "Все направления", find: "Найти", empty: "Учёные не найдены", emptyHint: "Измените поисковый запрос или фильтры каталога.", reset: "Сбросить фильтры", journal: "Журнал СМУ" },
  kk: { eyebrow: "Ғылым адамдары", title: "Өңірді дамытатын зерттеушілер", intro: "Ақтөбе облысының ғалымдары арасынан сарапшыларды, әріптестерді және серіктестерді табыңыз.", profiles: "каталогтағы профиль", search: "Аты бойынша іздеу", organization: "Ұйым", allOrganizations: "Барлық ұйымдар", field: "Бағыт", allFields: "Барлық бағыттар", find: "Іздеу", empty: "Ғалымдар табылмады", emptyHint: "Іздеу сұрауын немесе каталог сүзгілерін өзгертіңіз.", reset: "Сүзгілерді қалпына келтіру", journal: "СМУ журналы" },
  en: { eyebrow: "People of science", title: "Researchers advancing the region", intro: "Find experts, colleagues and partners among scientists in the Aktobe Region.", profiles: "profiles in the directory", search: "Search by name", organization: "Organization", allOrganizations: "All organizations", field: "Field", allFields: "All fields", find: "Search", empty: "No scientists found", emptyHint: "Change the search query or directory filters.", reset: "Reset filters", journal: "SMU Journal" },
};

const journalDetail = {
  ru: {
    breadcrumbs: "Навигация по журналу",
    back: "Журнал",
    minutes: "мин чтения",
    category: "Категория",
    topics: "Темы",
    endTitle: "Наука становится ближе",
    endText: "Следите за исследованиями и инициативами молодых учёных Актюбинской области.",
    allMaterials: "Все материалы",
  },
  kk: {
    breadcrumbs: "Журнал навигациясы",
    back: "Журнал",
    minutes: "мин оқу",
    category: "Санат",
    topics: "Тақырыптар",
    endTitle: "Ғылым жақындай түседі",
    endText: "Ақтөбе облысының жас ғалымдарының зерттеулері мен бастамаларын қадағалаңыз.",
    allMaterials: "Барлық материалдар",
  },
  en: {
    breadcrumbs: "Journal navigation", back: "Journal", minutes: "min read", category: "Category", topics: "Topics",
    endTitle: "Science gets closer", endText: "Follow the research and initiatives of young scientists in the Aktobe Region.",
    allMaterials: "All content",
  },
} as const;

const scientistProfile = {
  ru: { breadcrumbs: "Хлебные крошки", catalog: "Каталог учёных", biography: "Биография", expertise: "Направлений", scientificProfile: "Научный профиль", organizationSite: "Сайт организации" },
  kk: { breadcrumbs: "Навигация", catalog: "Ғалымдар каталогы", biography: "Өмірбаян", expertise: "Бағыт", scientificProfile: "Ғылыми профиль", organizationSite: "Ұйымның сайты" },
  en: { breadcrumbs: "Breadcrumbs", catalog: "Scientists directory", biography: "Biography", expertise: "Fields", scientificProfile: "Scientific profile", organizationSite: "Organization website" },
} as const;

const science = {
  ru: { eyebrow: "Наука региона", intro: "Откройте научные работы Актюбинской области: направления, команды и результаты.", search: "Поиск по названию", organizations: "Все организации", fields: "Все направления", stages: "Все этапы", find: "Найти", empty: "Научные работы не найдены", hint: "Здесь появятся опубликованные работы. Попробуйте изменить фильтры.", reset: "Сбросить фильтры", read: "Подробнее", description: "Описание и цели", results: "Результаты", team: "Команда", lead: "Руководитель", noTeam: "Участники не указаны", organization: "Организация", dates: "Сроки", from: "Начало", to: "Окончание", external: "Сайт / публикация", catalog: "Вернуться в каталог", notFound: "Работа не найдена", count: "записей · до 100 последних", footer: "Совет молодых учёных" },
  kk: { eyebrow: "Өңір ғылымы", intro: "Ақтөбе облысының ғылыми жұмыстарын ашыңыз: бағыттар, командалар және нәтижелер.", search: "Атауы бойынша іздеу", organizations: "Барлық ұйымдар", fields: "Барлық бағыттар", stages: "Барлық кезеңдер", find: "Іздеу", empty: "Ғылыми жұмыстар табылмады", hint: "Мұнда жарияланған жұмыстар көрсетіледі. Сүзгілерді өзгертіп көріңіз.", reset: "Сүзгілерді қалпына келтіру", read: "Толығырақ", description: "Сипаттама және мақсаттар", results: "Нәтижелер", team: "Команда", lead: "Жетекші", noTeam: "Қатысушылар көрсетілмеген", organization: "Ұйым", dates: "Мерзімдер", from: "Басталуы", to: "Аяқталуы", external: "Сайт / жарияланым", catalog: "Каталогқа оралу", notFound: "Жұмыс табылмады", count: "жазба · соңғы 100 жазбаға дейін", footer: "Жас ғалымдар кеңесі" },
  en: { eyebrow: "Science in the region", intro: "Explore research from the Aktobe Region: fields, teams and results.", search: "Search by title", organizations: "All organizations", fields: "All fields", stages: "All stages", find: "Search", empty: "No research found", hint: "Published work will appear here. Try changing the filters.", reset: "Reset filters", read: "Learn more", description: "Description and goals", results: "Results", team: "Team", lead: "Lead", noTeam: "No participants listed", organization: "Organization", dates: "Dates", from: "Start", to: "End", external: "Website / publication", catalog: "Back to directory", notFound: "Work not found", count: "records · up to 100 latest", footer: "Council of Young Scientists" },
} as const;

const events = {
  ru: {
    title: "События", eyebrow: "Календарь научного сообщества",
    intro: "Конференции, семинары и встречи учёных Актюбинской области. Выберите событие и присоединяйтесь.",
    search: "Поиск по названию", kinds: "Все типы", formats: "Все форматы", period: "Период",
    upcoming: "Предстоящие и текущие", past: "Прошедшие", all: "Все события", find: "Найти",
    empty: "События не найдены", hint: "Попробуйте изменить фильтры. Новые события появятся после публикации.",
    reset: "Сбросить фильтры", read: "Подробнее", cancelled: "Событие отменено",
    cancelHint: "Мероприятие не состоится. Регистрация закрыта.",
    description: "О событии и программа", organizer: "Организатор", location: "Место проведения",
    dates: "Дата и время", start: "Начало", end: "Окончание", zone: "Время по Актобе · UTC+05:00",
    register: "Зарегистрироваться", deadline: "Дедлайн регистрации", closed: "Регистрация закрыта",
    external: "Сайт события / трансляция", catalog: "Вернуться в каталог", notFound: "Событие не найдено",
    count: "событий · до 100 записей", footer: "Совет молодых учёных",
  },
  kk: {
    title: "Іс-шаралар", eyebrow: "Ғылыми қауымдастық күнтізбесі",
    intro: "Ақтөбе облысы ғалымдарының конференциялары, семинарлары және кездесулері. Іс-шараны таңдап, қатысыңыз.",
    search: "Атауы бойынша іздеу", kinds: "Барлық түрлер", formats: "Барлық форматтар", period: "Кезең",
    upcoming: "Алдағы және ағымдағы", past: "Өткен", all: "Барлық іс-шаралар", find: "Іздеу",
    empty: "Іс-шаралар табылмады", hint: "Сүзгілерді өзгертіп көріңіз. Жаңа іс-шаралар жарияланғаннан кейін пайда болады.",
    reset: "Сүзгілерді қалпына келтіру", read: "Толығырақ", cancelled: "Іс-шара тоқтатылды",
    cancelHint: "Іс-шара өткізілмейді. Тіркелу жабық.",
    description: "Іс-шара туралы және бағдарлама", organizer: "Ұйымдастырушы", location: "Өткізу орны",
    dates: "Күні мен уақыты", start: "Басталуы", end: "Аяқталуы", zone: "Ақтөбе уақыты · UTC+05:00",
    register: "Тіркелу", deadline: "Тіркелу мерзімі", closed: "Тіркелу жабық",
    external: "Іс-шара сайты / трансляция", catalog: "Каталогқа оралу", notFound: "Іс-шара табылмады",
    count: "іс-шара · 100 жазбаға дейін", footer: "Жас ғалымдар кеңесі",
  },
  en: {
    title: "Events", eyebrow: "Scientific community calendar",
    intro: "Conferences, seminars and meetings for scientists in the Aktobe Region. Choose an event and join.",
    search: "Search by title", kinds: "All types", formats: "All formats", period: "Period",
    upcoming: "Upcoming and ongoing", past: "Past", all: "All events", find: "Search",
    empty: "No events found", hint: "Try changing the filters. New events appear after publication.", reset: "Reset filters", read: "Learn more",
    cancelled: "Event cancelled", cancelHint: "This event will not take place. Registration is closed.",
    description: "About the event and programme", organizer: "Organizer", location: "Location", dates: "Date and time",
    start: "Start", end: "End", zone: "Aktobe time · UTC+05:00", register: "Register", deadline: "Registration deadline",
    closed: "Registration closed", external: "Event website / stream", catalog: "Back to directory", notFound: "Event not found",
    count: "events · up to 100 records", footer: "Council of Young Scientists",
  },
} as const;

export function getDictionary(locale: Locale) {
  return {
    common: common[locale], journalCatalog: journalCatalog[locale], scientistCatalog: scientistCatalog[locale],
    journalDetail: journalDetail[locale], scientistProfile: scientistProfile[locale], science: science[locale], events: events[locale],
  };
}
