import type { Locale } from "./locales";
import { mentorshipProgressCopy } from "./mentorship-progress";

export const accountRecordsCopy = {
  ru: {
    sections: { scientist: "Мой научный профиль", articles: "Мои статьи", projects: "Мои проекты и исследования", applications: "Мои заявки" },
    intro: "Здесь доступны записи, связанные с вашим аккаунтом. Редактирование доступно при наличии соответствующих прав.",
    empty: "Связанных записей пока нет.", untitled: "Без названия", open: "Открыть", edit: "Редактировать", back: "В кабинет", backToList: "К списку", previous: "Назад", next: "Далее", total: "Всего записей", updated: "Обновлено", fallback: "Язык материала", body: "Содержание", unavailable: "Не удалось загрузить записи. Попробуйте позже.",
    claim: "Найти мои заявки по email", claimIntro: "Свяжите заявки на наставничество и Research Program с подтверждённым email вашего аккаунта. Повторный поиск добавит новые заявки.", claiming: "Поиск…", claimed: "Привязано заявок", failed: "Не удалось привязать заявки. Попробуйте позже.", session: "Сессия истекла. Войдите снова.",
    kinds: { scientist: "Научный профиль", article: "Статья", project: "Проект", research: "Исследование", mentorship_application: "Заявка на наставничество", program_application: "Заявка в Research Program" },
    relationships: { owner: "Владелец", member: "Участник", applicant: "Заявитель" },
    statuses: { draft: "Черновик", unverified: "Не проверен", pending: "На проверке", verified: "Подтверждён", rejected: "Отклонён", in_review: "На рассмотрении", changes_requested: "Нужны правки", approved: "Одобрен", scheduled: "Запланирован", published: "Опубликован", archived: "В архиве", new: "Новая", accepted: "Принята", completed: "Завершена" },
  },
  kk: {
    sections: { scientist: "Менің ғылыми профилім", articles: "Менің мақалаларым", projects: "Менің жобаларым мен зерттеулерім", applications: "Менің өтінімдерім" },
    intro: "Аккаунтыңызбен байланысқан жазбалар осында көрсетіледі. Тиісті құқықтар болса, өңдеуге болады.",
    empty: "Байланысқан жазбалар әлі жоқ.", untitled: "Атаусыз", open: "Ашу", edit: "Өңдеу", back: "Кабинетке", backToList: "Тізімге", previous: "Артқа", next: "Келесі", total: "Жазбалар саны", updated: "Жаңартылды", fallback: "Материал тілі", body: "Мазмұны", unavailable: "Жазбаларды жүктеу мүмкін болмады. Кейінірек қайталап көріңіз.",
    claim: "Email арқылы өтінімдерімді табу", claimIntro: "Тәлімгерлік және Research Program өтінімдерін аккаунтыңыздың расталған email мекенжайымен байланыстырыңыз. Қайта іздеу жаңа өтінімдерді қосады.", claiming: "Іздеу…", claimed: "Байланыстырылған өтінімдер", failed: "Өтінімдерді байланыстыру мүмкін болмады. Кейінірек қайталап көріңіз.", session: "Сессия аяқталды. Қайта кіріңіз.",
    kinds: { scientist: "Ғылыми профиль", article: "Мақала", project: "Жоба", research: "Зерттеу", mentorship_application: "Тәлімгерлік өтінімі", program_application: "Research Program өтінімі" },
    relationships: { owner: "Иесі", member: "Қатысушы", applicant: "Өтініш беруші" },
    statuses: { draft: "Жоба", unverified: "Тексерілмеген", pending: "Тексеруде", verified: "Расталған", rejected: "Қабылданбаған", in_review: "Қаралуда", changes_requested: "Түзету қажет", approved: "Мақұлданған", scheduled: "Жоспарланған", published: "Жарияланған", archived: "Мұрағатта", new: "Жаңа", accepted: "Қабылданған", completed: "Аяқталған" },
  },
  en: {
    sections: { scientist: "My scientific profile", articles: "My articles", projects: "My projects and research", applications: "My applications" },
    intro: "View records linked to your account. Editing is available with the appropriate permissions.",
    empty: "No linked records yet.", untitled: "Untitled", open: "Open", edit: "Edit", back: "Back to account", backToList: "Back to list", previous: "Previous", next: "Next", total: "Total records", updated: "Updated", fallback: "Content language", body: "Content", unavailable: "Unable to load records. Please try again later.",
    claim: "Find my applications by email", claimIntro: "Link mentorship and Research Program applications using your verified account email. Search again to add new applications.", claiming: "Searching…", claimed: "Applications linked", failed: "Unable to link applications. Please try again later.", session: "Your session has expired. Please sign in again.",
    kinds: { scientist: "Scientific profile", article: "Article", project: "Project", research: "Research", mentorship_application: "Mentorship application", program_application: "Research Program application" },
    relationships: { owner: "Owner", member: "Participant", applicant: "Applicant" },
    statuses: { draft: "Draft", unverified: "Unverified", pending: "Pending verification", verified: "Verified", rejected: "Rejected", in_review: "In review", changes_requested: "Changes requested", approved: "Approved", scheduled: "Scheduled", published: "Published", archived: "Archived", new: "New", accepted: "Accepted", completed: "Completed" },
  },
} satisfies Record<Locale, unknown>;

export function accountStatus(locale: Locale, status: string) {
  if (status === "withdrawn") return mentorshipProgressCopy[locale].withdrawn;
  const statuses: Record<string, string> = accountRecordsCopy[locale].statuses;
  return statuses[status] ?? status;
}
