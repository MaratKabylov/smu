import type { Locale } from "@/lib/i18n/locales";
import type { SupportKind } from "@/lib/validation/support-request";
import { publicFormRateMessage } from "./public-form";

type SupportKindOverride = {
  kicker?: string;
  intro?: string;
  contactName?: string;
  organization?: string;
  name?: string;
  description?: string;
  files?: string;
  submit?: string;
  sections?: Partial<SupportCopy["sections"]>;
  placeholders?: Partial<SupportCopy["placeholders"]>;
  fieldPlaceholders?: Record<string, string>;
};

type SupportCopy = {
  title: string; own: string; intro: string; guest: string; contactName: string; email: string; organization: string; name: string; description: string;
  files: string; consent: string; consentNoFiles: string; submit: string; pending: string; back: string; empty: string; unavailable: string; previous: string; next: string;
  status: string; priority: string; assignedTo: string; unassigned: string; note: string; save: string; filter: string; all: string; queue: string;
  saved: string; failed: string; invalid: string; session: string; rate: string; stale: string; file: string;
  sections: { applicant: string; subject: string; parameters: string; attachments: string; attachmentsHint: string };
  placeholders: { contactName: string; email: string; organization: string; title: string; description: string };
  kinds: Record<SupportKind, string>;
  statuses: Record<"new" | "in_review" | "in_progress" | "completed" | "rejected", string>;
  priorities: Record<"low" | "normal" | "high", string>; fields: Record<string, string>;
  kindOverrides?: Partial<Record<SupportKind, SupportKindOverride>>;
};

export const supportCopy: Record<Locale, SupportCopy> = {
  ru: {
    title: "Поддержка исследований", own: "Мои обращения", intro: "Предложите исследование, запросите IT-решение или помощь с научной публикацией.",
    guest: "Можно отправить без регистрации. При входе используется подтверждённый email аккаунта, и обращение появится в личном кабинете. Гостевые обращения обрабатываются по указанному email.",
    contactName: "Ваше имя", email: "Email для связи", organization: "Организация (необязательно)", name: "Тема обращения", description: "Описание исследования или задачи",
    files: "Приложения: до 3 PDF, каждый до 1 МиБ. Файлы доступны вам после входа и сотрудникам поддержки.",
    consent: "Согласен на обработку указанных контактов и материалов для рассмотрения обращения. Подтверждаю право передавать приложенные материалы.",
    consentNoFiles: "Согласен на обработку указанных контактных данных и информации для рассмотрения обращения.",
    submit: "Отправить обращение", pending: "Сохранение…", back: "Назад", empty: "Обращений пока нет.", unavailable: "Обращения временно недоступны.", previous: "Назад", next: "Далее",
    status: "Статус", priority: "Приоритет", assignedTo: "Ответственный", unassigned: "Не назначен", note: "Служебная заметка (только для сотрудников)", save: "Сохранить", filter: "Показать", all: "Все статусы", queue: "Очередь обращений",
    saved: "Сохранено. Обращение передано в очередь поддержки.", failed: "Не удалось сохранить. Повторите попытку.", invalid: "Проверьте обязательные поля и согласие.", session: "Сессия недоступна. Войдите с подтверждённым email.", rate: publicFormRateMessage.ru, stale: "Запись изменена. Обновите страницу перед сохранением.", file: "Прикрепите до 3 PDF размером до 1 МиБ каждый.",
    sections: {
      applicant: "Контактные данные заявителя",
      subject: "Суть обращения",
      parameters: "Параметры и детализация направления",
      attachments: "Приложения (PDF-файлы)",
      attachmentsHint: "Допустимый формат: только PDF. Не более 3 файлов, размер каждого файла до 1 МиБ.",
    },
    placeholders: {
      contactName: "Иван Иванов",
      email: "example@mail.kz",
      organization: "НИИ, университет, лаборатория или предприятие",
      title: "Краткая тема обращения (от 3 до 200 символов)",
      description: "Подробно изложите цели, задачи, текущую ситуацию и ожидаемые результаты (от 20 символов)...",
    },
    kinds: { research_proposal: "Предложить исследование", it_request: "IT-поддержка", publication_support: "Поддержка публикации", open_data_offer: "Предложить данные", open_data_request: "Запросить данные", scientist_application: "Добавление в список учёных" },
    statuses: { new: "Новое", in_review: "На рассмотрении", in_progress: "В работе", completed: "Завершено", rejected: "Отклонено" }, priorities: { low: "Низкий", normal: "Обычный", high: "Высокий" },
    fields: {
      importance: "Актуальность и ожидаемая польза", region: "Регион исследования", availableData: "Доступные данные", currentProcess: "Текущий рабочий процесс", desiredSolution: "Желаемое IT-решение", dataDescription: "Данные и ограничения доступа", journal: "Журнал или направление публикации", manuscriptStage: "Стадия подготовки рукописи", supportNeeded: "Какая помощь нужна",
      category: "Тематика / категория данных", dataFormat: "Формат и объём данных", periodAndSource: "Период охвата и источник данных",
      requestedData: "Требуемые показатели / данные", researchGoal: "Цель исследования / проекта", periodOrFormat: "Желаемый временной период или формат",
      researchFields: "Научные направления и специализация", scientificProfiles: "Ссылки на научные профили (ORCID, Scopus, Google Scholar и др.)", keyAchievements: "Ключевые публикации, проекты и форматы сотрудничества",
    },
    kindOverrides: {
      scientist_application: {
        kicker: "Научное сообщество",
        intro: "Заполните анкету — после проверки модератором ваш профиль будет добавлен в публичный каталог учёных Актюбинской области.",
        contactName: "ФИО полностью",
        organization: "Организация (вуз, НИИ, лаборатория)",
        name: "Должность и учёная степень",
        description: "Биография и научные интересы",
        files: "Дополнительно: CV, резюме или список публикаций (до 3 PDF, каждый до 1 МиБ, необязательно).",
        submit: "Отправить заявку",
        sections: {
          applicant: "Контактные данные учёного",
          subject: "Профиль и научная деятельность",
          parameters: "Научные данные для карточки",
          attachments: "Резюме и материалы (PDF, необязательно)",
        },
        placeholders: {
          contactName: "Иванов Иван Иванович",
          organization: "Например: АРУ им. К. Жубанова, кафедра информатики",
          title: "Например: PhD, к.т.н., старший научный сотрудник",
          description: "Кратко расскажите об образовании, исследовательском опыте, научных интересах и достижениях (от 20 символов)...",
        },
        fieldPlaceholders: {
          researchFields: "Например: экология, анализ данных, биотехнологии, прикладная математика",
          scientificProfiles: "Ссылки на ORCID, Google Scholar, Scopus, ResearchGate или укажите «пока нет»",
          keyAchievements: "Значимые статьи, гранты, проекты, готовность к наставничеству или совместным исследованиям",
        },
      },
    },
  },
  kk: {
    title: "Зерттеулерді қолдау", own: "Менің өтініштерім", intro: "Зерттеу ұсыныңыз, IT-шешім немесе ғылыми жарияланымға көмек сұраңыз.",
    guest: "Тіркелмей жіберуге болады. Жүйеге кірсеңіз, аккаунттың расталған email мекенжайы қолданылады және өтініш жеке кабинетте көрінеді. Қонақ өтініштері көрсетілген email арқылы қаралады.",
    contactName: "Аты-жөніңіз", email: "Байланыс email", organization: "Ұйым (міндетті емес)", name: "Өтініш тақырыбы", description: "Зерттеу немесе тапсырма сипаттамасы",
    files: "Қосымшалар: 3 PDF-ке дейін, әрқайсысы 1 МиБ-қа дейін. Файлдар жүйеге кіргенде сізге және қолдау қызметкерлеріне қолжетімді.",
    consent: "Өтінішті қарау үшін көрсетілген байланыс деректері мен материалдарды өңдеуге келісемін. Қоса берілген материалдарды жіберуге құқығым бар екенін растаймын.",
    consentNoFiles: "Өтінішті қарау үшін көрсетілген байланыс деректері мен ақпаратты өңдеуге келісемін.",
    submit: "Өтініш жіберу", pending: "Сақталуда…", back: "Артқа", empty: "Өтініштер әлі жоқ.", unavailable: "Өтініштер уақытша қолжетімсіз.", previous: "Артқа", next: "Келесі",
    status: "Мәртебе", priority: "Басымдық", assignedTo: "Жауапты қызметкер", unassigned: "Тағайындалмаған", note: "Қызметтік жазба (тек қызметкерлер үшін)", save: "Сақтау", filter: "Көрсету", all: "Барлық мәртебелер", queue: "Өтініштер кезегі",
    saved: "Сақталды. Өтініш қолдау кезегіне жіберілді.", failed: "Сақтау мүмкін болмады. Қайталап көріңіз.", invalid: "Міндетті өрістер мен келісімді тексеріңіз.", session: "Сессия қолжетімсіз. Расталған email арқылы кіріңіз.", rate: publicFormRateMessage.kk, stale: "Жазба өзгерді. Сақтау алдында бетті жаңартыңыз.", file: "Әрқайсысы 1 МиБ-қа дейінгі 3 PDF-тен артық тіркемеңіз.",
    sections: {
      applicant: "Өтініш берушінің байланыс деректері",
      subject: "Өтініштің мазмұны",
      parameters: "Бағыт параметрлері мен мәліметтері",
      attachments: "Қосымшалар (PDF файлдар)",
      attachmentsHint: "Рұқсат етілген пішім: тек PDF. 3 файлдан артық емес, әр файлдың өлшемі 1 МиБ-қа дейін.",
    },
    placeholders: {
      contactName: "Асан Үсенов",
      email: "example@mail.kz",
      organization: "ҒЗИ, университет, зертхана немесе кәсіпорын",
      title: "Өтініштің қысқаша тақырыбы (3-тен 200 таңбаға дейін)",
      description: "Мақсаттарды, міндеттерді, ағымдағы жағдайды және күтілетін нәтижелерді толық сипаттаңыз (20 таңбадан кем емес)...",
    },
    kinds: { research_proposal: "Зерттеу ұсыну", it_request: "IT-қолдау", publication_support: "Жарияланымды қолдау", open_data_offer: "Деректер ұсыну", open_data_request: "Деректерге сұраныс жіберу", scientist_application: "Ғалымдар тізіміне қосылу" },
    statuses: { new: "Жаңа", in_review: "Қаралуда", in_progress: "Орындалуда", completed: "Аяқталды", rejected: "Қабылданбады" }, priorities: { low: "Төмен", normal: "Қалыпты", high: "Жоғары" },
    fields: {
      importance: "Өзектілігі және күтілетін пайдасы", region: "Зерттеу аймағы", availableData: "Қолжетімді деректер", currentProcess: "Ағымдағы жұмыс үдерісі", desiredSolution: "Қажетті IT-шешім", dataDescription: "Деректер және қолжетімділік шектеулері", journal: "Журнал немесе жарияланым бағыты", manuscriptStage: "Қолжазбаны дайындау кезеңі", supportNeeded: "Қандай көмек қажет",
      category: "Деректер тақырыбы / санаты", dataFormat: "Деректердің пішімі мен көлемі", periodAndSource: "Қамту кезеңі және дереккөз",
      requestedData: "Қажетті көрсеткіштер / деректер", researchGoal: "Зерттеу / жоба мақсаты", periodOrFormat: "Қажетті уақыт кезеңі немесе пішім",
      researchFields: "Ғылыми бағыттар және мамандану", scientificProfiles: "Ғылыми профильдерге сілтемелер (ORCID, Scopus, Google Scholar және т.б.)", keyAchievements: "Негізгі жарияланымдар, жобалар және ынтымақтастық бағыттары",
    },
    kindOverrides: {
      scientist_application: {
        kicker: "Ғылыми қауымдастық",
        intro: "Сауалнаманы толтырыңыз — модератор тексергеннен кейін профиліңіз Ақтөбе облысы ғалымдарының ашық каталогына қосылады.",
        contactName: "Толық аты-жөніңіз",
        organization: "Ұйым (ЖОО, ҒЗИ, зертхана)",
        name: "Лауазымы және ғылыми дәрежесі",
        description: "Өмірбаян және ғылыми қызығушылықтар",
        files: "Қосымша: CV, түйіндеме немесе жарияланымдар тізімі (3 PDF-ке дейін, әрқайсысы 1 МиБ-қа дейін, міндетті емес).",
        submit: "Өтінім жіберу",
        sections: {
          applicant: "Ғалымның байланыс деректері",
          subject: "Профиль және ғылыми қызмет",
          parameters: "Карточкаға арналған ғылыми деректер",
          attachments: "Түйіндеме және материалдар (PDF, міндетті емес)",
        },
        placeholders: {
          contactName: "Үсенов Асан Үсенұлы",
          organization: "Мысалы: Қ. Жұбанов атындағы АӨУ, информатика кафедрасы",
          title: "Мысалы: PhD, аға ғылыми қызметкер, қауымдастырылған профессор",
          description: "Біліміңіз, зерттеу тәжірибеңіз, ғылыми қызығушылықтарыңыз бен жетістіктеріңіз туралы қысқаша жазыңыз (20 таңбадан кем емес)...",
        },
        fieldPlaceholders: {
          researchFields: "Мысалы: экология, деректерді талдау, биотехнология, қолданбалы математика",
          scientificProfiles: "ORCID, Google Scholar, Scopus, ResearchGate сілтемелері немесе «әзірге жоқ» деп көрсетіңіз",
          keyAchievements: "Негізгі мақалалар, гранттар, жобалар, тәлімгерлікке немесе бірлескен зерттеулерге дайындық",
        },
      },
    },
  },
  en: {
    title: "Research support", own: "My support requests", intro: "Propose research, request an IT solution or get help with a scientific publication.",
    guest: "You can submit without registering. When signed in, your verified account email is used and the request appears in your account. Guest requests are handled through the email provided.",
    contactName: "Your name", email: "Contact email", organization: "Organization (optional)", name: "Request title", description: "Research or task description",
    files: "Attachments: up to 3 PDFs, up to 1 MiB each. Signed-in owners and support staff can access the files.",
    consent: "I consent to processing these contact details and materials to handle this request. I confirm that I have the right to share the attachments.",
    consentNoFiles: "I consent to processing these contact details and information to handle this request.",
    submit: "Submit request", pending: "Saving…", back: "Back", empty: "No requests yet.", unavailable: "Support requests are temporarily unavailable.", previous: "Previous", next: "Next",
    status: "Status", priority: "Priority", assignedTo: "Assigned to", unassigned: "Unassigned", note: "Internal note (staff only)", save: "Save", filter: "Apply", all: "All statuses", queue: "Support queue",
    saved: "Saved. The request is in the support queue.", failed: "Could not save. Please try again.", invalid: "Check the required fields and consent.", session: "Session unavailable. Sign in with a verified email.", rate: publicFormRateMessage.en, stale: "This record has changed. Reload before saving.", file: "Attach up to 3 PDFs, up to 1 MiB each.",
    sections: {
      applicant: "Applicant contact details",
      subject: "Request overview",
      parameters: "Direction parameters and details",
      attachments: "Attachments (PDF files)",
      attachmentsHint: "Allowed format: PDF only. Up to 3 files, max 1 MiB each.",
    },
    placeholders: {
      contactName: "Jane Doe",
      email: "example@mail.kz",
      organization: "Institute, university, laboratory or organization",
      title: "Short request title (3 to 200 characters)",
      description: "Describe the goals, context, and expected outcome in detail (at least 20 characters)...",
    },
    kinds: { research_proposal: "Propose research", it_request: "IT support", publication_support: "Publication support", open_data_offer: "Contribute data", open_data_request: "Request data", scientist_application: "Join the scientists directory" },
    statuses: { new: "New", in_review: "Under review", in_progress: "In progress", completed: "Completed", rejected: "Rejected" }, priorities: { low: "Low", normal: "Normal", high: "High" },
    fields: {
      importance: "Significance and expected benefit", region: "Research region", availableData: "Available data", currentProcess: "Current process", desiredSolution: "Desired IT solution", dataDescription: "Data and access restrictions", journal: "Journal or publication field", manuscriptStage: "Manuscript preparation stage", supportNeeded: "Support needed",
      category: "Data topic / category", dataFormat: "Data format and volume", periodAndSource: "Coverage period and source",
      requestedData: "Required indicators / data", researchGoal: "Research / project objective", periodOrFormat: "Desired time period or format",
      researchFields: "Research fields and specialization", scientificProfiles: "Scientific profile links (ORCID, Scopus, Google Scholar, etc.)", keyAchievements: "Key publications, projects, and collaboration interests",
    },
    kindOverrides: {
      scientist_application: {
        kicker: "Scientific community",
        intro: "Fill out this form — after moderator review, your profile will be added to the public directory of scientists of the Aktobe Region.",
        contactName: "Full name",
        organization: "Organization (university, institute, lab)",
        name: "Position and academic degree",
        description: "Biography and research interests",
        files: "Optional: CV, resume, or list of publications (up to 3 PDFs, up to 1 MiB each).",
        submit: "Submit application",
        sections: {
          applicant: "Scientist contact details",
          subject: "Profile and research background",
          parameters: "Directory profile details",
          attachments: "CV and documents (PDF, optional)",
        },
        placeholders: {
          contactName: "Jane Doe",
          organization: "e.g., Zhubanov University, Department of Computer Science",
          title: "e.g., PhD, Associate Professor, Senior Researcher",
          description: "Briefly describe your education, research experience, scientific interests, and key achievements (at least 20 characters)...",
        },
        fieldPlaceholders: {
          researchFields: "e.g., ecology, data analysis, biotechnology, applied mathematics",
          scientificProfiles: "Links to ORCID, Google Scholar, Scopus, ResearchGate, or write \"none yet\"",
          keyAchievements: "Key papers, grants, projects, and interest in mentorship or joint research",
        },
      },
    },
  },
};

export const supportAdminMeta: Record<
  SupportKind,
  { title: string; kicker: string; description: string }
> = {
  research_proposal: {
    title: "Предложения исследований",
    kicker: "Научные инициативы",
    description: "Инициативы, темы и запросы на проведение исследований от учёных и организаций региона.",
  },
  it_request: {
    title: "IT-заявки",
    kicker: "Цифровизация науки",
    description: "Запросы на разработку, автоматизацию процессов, базы данных и цифровую поддержку.",
  },
  publication_support: {
    title: "Поддержка публикаций",
    kicker: "Научные публикации",
    description: "Заявки на финансирование, редакционную помощь и сопровождение публикаций в рецензируемых изданиях.",
  },
  open_data_offer: {
    title: "Предложения данных",
    kicker: "Open Data Aktobe",
    description: "Предложения научных данных и массивов от учёных, институтов и исследователей региона.",
  },
  open_data_request: {
    title: "Запросы данных",
    kicker: "Open Data Aktobe",
    description: "Запросы на предоставление, поиск и формирование научных наборов данных региона.",
  },
  scientist_application: {
    title: "Заявки учёных",
    kicker: "Научное сообщество",
    description: "Заявки исследователей на добавление профиля в публичный список учёных региона.",
  },
};
