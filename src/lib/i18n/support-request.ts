import type { Locale } from "@/lib/i18n/locales";
import { publicFormRateMessage } from "./public-form";
type SupportCopy = {
  title: string; own: string; intro: string; guest: string; contactName: string; email: string; organization: string; name: string; description: string;
  files: string; consent: string; submit: string; pending: string; back: string; empty: string; unavailable: string; previous: string; next: string;
  status: string; priority: string; assignedTo: string; unassigned: string; note: string; save: string; filter: string; all: string; queue: string;
  saved: string; failed: string; invalid: string; session: string; rate: string; stale: string; file: string;
  kinds: Record<"research_proposal" | "it_request" | "publication_support", string>;
  statuses: Record<"new" | "in_review" | "in_progress" | "completed" | "rejected", string>;
  priorities: Record<"low" | "normal" | "high", string>; fields: Record<string, string>;
};
export const supportCopy: Record<Locale, SupportCopy> = {
  ru: {
    title: "Поддержка исследований", own: "Мои обращения", intro: "Предложите исследование, запросите IT-решение или помощь с научной публикацией.",
    guest: "Можно отправить без регистрации. При входе используется подтверждённый email аккаунта, и обращение появится в личном кабинете. Гостевые обращения обрабатываются по указанному email.",
    contactName: "Ваше имя", email: "Email для связи", organization: "Организация (необязательно)", name: "Тема обращения", description: "Описание исследования или задачи",
    files: "Приложения: до 3 PDF, каждый до 1 МиБ. Файлы доступны вам после входа и сотрудникам поддержки.",
    consent: "Согласен на обработку указанных контактов и материалов для рассмотрения обращения. Подтверждаю право передавать приложенные материалы.",
    submit: "Отправить обращение", pending: "Сохранение…", back: "Назад", empty: "Обращений пока нет.", unavailable: "Обращения временно недоступны.", previous: "Назад", next: "Далее",
    status: "Статус", priority: "Приоритет", assignedTo: "Ответственный", unassigned: "Не назначен", note: "Служебная заметка (только для сотрудников)", save: "Сохранить", filter: "Показать", all: "Все статусы", queue: "Очередь обращений",
    saved: "Сохранено. Обращение передано в очередь поддержки.", failed: "Не удалось сохранить. Повторите попытку.", invalid: "Проверьте обязательные поля и согласие.", session: "Сессия недоступна. Войдите с подтверждённым email.", rate: publicFormRateMessage.ru, stale: "Запись изменена. Обновите страницу перед сохранением.", file: "Прикрепите до 3 PDF размером до 1 МиБ каждый.",
    kinds: { research_proposal: "Предложить исследование", it_request: "IT-поддержка", publication_support: "Поддержка публикации" },
    statuses: { new: "Новое", in_review: "На рассмотрении", in_progress: "В работе", completed: "Завершено", rejected: "Отклонено" }, priorities: { low: "Низкий", normal: "Обычный", high: "Высокий" },
    fields: { importance: "Актуальность и ожидаемая польза", region: "Регион исследования", availableData: "Доступные данные", currentProcess: "Текущий рабочий процесс", desiredSolution: "Желаемое IT-решение", dataDescription: "Данные и ограничения доступа", journal: "Журнал или направление публикации", manuscriptStage: "Стадия подготовки рукописи", supportNeeded: "Какая помощь нужна" },
  },
  kk: {
    title: "Зерттеулерді қолдау", own: "Менің өтініштерім", intro: "Зерттеу ұсыныңыз, IT-шешім немесе ғылыми жарияланымға көмек сұраңыз.",
    guest: "Тіркелмей жіберуге болады. Жүйеге кірсеңіз, аккаунттың расталған email мекенжайы қолданылады және өтініш жеке кабинетте көрінеді. Қонақ өтініштері көрсетілген email арқылы қаралады.",
    contactName: "Аты-жөніңіз", email: "Байланыс email", organization: "Ұйым (міндетті емес)", name: "Өтініш тақырыбы", description: "Зерттеу немесе тапсырма сипаттамасы",
    files: "Қосымшалар: 3 PDF-ке дейін, әрқайсысы 1 МиБ-қа дейін. Файлдар жүйеге кіргенде сізге және қолдау қызметкерлеріне қолжетімді.",
    consent: "Өтінішті қарау үшін көрсетілген байланыс деректері мен материалдарды өңдеуге келісемін. Қоса берілген материалдарды жіберуге құқығым бар екенін растаймын.",
    submit: "Өтініш жіберу", pending: "Сақталуда…", back: "Артқа", empty: "Өтініштер әлі жоқ.", unavailable: "Өтініштер уақытша қолжетімсіз.", previous: "Артқа", next: "Келесі",
    status: "Мәртебе", priority: "Басымдық", assignedTo: "Жауапты қызметкер", unassigned: "Тағайындалмаған", note: "Қызметтік жазба (тек қызметкерлер үшін)", save: "Сақтау", filter: "Көрсету", all: "Барлық мәртебелер", queue: "Өтініштер кезегі",
    saved: "Сақталды. Өтініш қолдау кезегіне жіберілді.", failed: "Сақтау мүмкін болмады. Қайталап көріңіз.", invalid: "Міндетті өрістер мен келісімді тексеріңіз.", session: "Сессия қолжетімсіз. Расталған email арқылы кіріңіз.", rate: publicFormRateMessage.kk, stale: "Жазба өзгерді. Сақтау алдында бетті жаңартыңыз.", file: "Әрқайсысы 1 МиБ-қа дейінгі 3 PDF-тен артық тіркемеңіз.",
    kinds: { research_proposal: "Зерттеу ұсыну", it_request: "IT-қолдау", publication_support: "Жарияланымды қолдау" },
    statuses: { new: "Жаңа", in_review: "Қаралуда", in_progress: "Орындалуда", completed: "Аяқталды", rejected: "Қабылданбады" }, priorities: { low: "Төмен", normal: "Қалыпты", high: "Жоғары" },
    fields: { importance: "Өзектілігі және күтілетін пайдасы", region: "Зерттеу аймағы", availableData: "Қолжетімді деректер", currentProcess: "Ағымдағы жұмыс үдерісі", desiredSolution: "Қажетті IT-шешім", dataDescription: "Деректер және қолжетімділік шектеулері", journal: "Журнал немесе жарияланым бағыты", manuscriptStage: "Қолжазбаны дайындау кезеңі", supportNeeded: "Қандай көмек қажет" },
  },
  en: {
    title: "Research support", own: "My support requests", intro: "Propose research, request an IT solution or get help with a scientific publication.",
    guest: "You can submit without registering. When signed in, your verified account email is used and the request appears in your account. Guest requests are handled through the email provided.",
    contactName: "Your name", email: "Contact email", organization: "Organization (optional)", name: "Request title", description: "Research or task description",
    files: "Attachments: up to 3 PDFs, up to 1 MiB each. Signed-in owners and support staff can access the files.",
    consent: "I consent to processing these contact details and materials to handle this request. I confirm that I have the right to share the attachments.",
    submit: "Submit request", pending: "Saving…", back: "Back", empty: "No requests yet.", unavailable: "Support requests are temporarily unavailable.", previous: "Previous", next: "Next",
    status: "Status", priority: "Priority", assignedTo: "Assigned to", unassigned: "Unassigned", note: "Internal note (staff only)", save: "Save", filter: "Apply", all: "All statuses", queue: "Support queue",
    saved: "Saved. The request is in the support queue.", failed: "Could not save. Please try again.", invalid: "Check the required fields and consent.", session: "Session unavailable. Sign in with a verified email.", rate: publicFormRateMessage.en, stale: "This record has changed. Reload before saving.", file: "Attach up to 3 PDFs, up to 1 MiB each.",
    kinds: { research_proposal: "Propose research", it_request: "IT support", publication_support: "Publication support" },
    statuses: { new: "New", in_review: "Under review", in_progress: "In progress", completed: "Completed", rejected: "Rejected" }, priorities: { low: "Low", normal: "Normal", high: "High" },
    fields: { importance: "Significance and expected benefit", region: "Research region", availableData: "Available data", currentProcess: "Current process", desiredSolution: "Desired IT solution", dataDescription: "Data and access restrictions", journal: "Journal or publication field", manuscriptStage: "Manuscript preparation stage", supportNeeded: "Support needed" },
  },
};
