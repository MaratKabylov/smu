import type { Locale } from "./locales";
import type { opportunityTypes } from "@/lib/validation/opportunity";
export const opportunityTypeLabels: Record<Locale, Record<typeof opportunityTypes[number], string>> = {
  ru: { grant: "Грант", conference: "Конференция", internship: "Стажировка", competition: "Конкурс", open_call: "Открытый набор", scholarship: "Стипендия", other: "Другое" },
  kk: { grant: "Грант", conference: "Конференция", internship: "Тағылымдама", competition: "Байқау", open_call: "Ашық қабылдау", scholarship: "Стипендия", other: "Басқа" },
  en: { grant: "Grant", conference: "Conference", internship: "Internship", competition: "Competition", open_call: "Open call", scholarship: "Scholarship", other: "Other" },
};
export const opportunityCopy = {
  ru: { title: "Возможности", intro: "Гранты, стажировки, конкурсы и открытые наборы для научного сообщества.", search: "Поиск возможностей", types: "Все типы", country: "Код страны (KZ, …)", availability: "Приём заявок", open: "Приём открыт", closed: "Приём закрыт", all: "Все сроки", deadline: "Срок подачи (Актобе, UTC+5)", noDeadline: "Срок не указан", source: "Первоисточник", organization: "Организация", funding: "Финансирование", back: "Все возможности", find: "Найти", empty: "Возможности не найдены", unavailable: "Не удалось загрузить возможности. Попробуйте позже.", read: "Подробнее", reset: "Сбросить фильтры", description: "Описание", countries: "Страна", international: "Не указана / международная" },
  kk: { title: "Мүмкіндіктер", intro: "Ғылыми қауымдастыққа арналған гранттар, тағылымдамалар, байқаулар және ашық қабылдаулар.", search: "Мүмкіндіктерді іздеу", types: "Барлық түрлер", country: "Ел коды (KZ, …)", availability: "Өтінім қабылдау", open: "Қабылдау ашық", closed: "Қабылдау жабық", all: "Барлық мерзімдер", deadline: "Өтінім мерзімі (Ақтөбе, UTC+5)", noDeadline: "Мерзім көрсетілмеген", source: "Бастапқы дереккөз", organization: "Ұйым", funding: "Қаржыландыру", back: "Барлық мүмкіндіктер", find: "Іздеу", empty: "Мүмкіндіктер табылмады", unavailable: "Мүмкіндіктерді жүктеу мүмкін болмады. Кейінірек қайталаңыз.", read: "Толығырақ", reset: "Сүзгілерді қалпына келтіру", description: "Сипаттама", countries: "Ел", international: "Көрсетілмеген / халықаралық" },
  en: { title: "Opportunities", intro: "Grants, internships, competitions and open calls for the scientific community.", search: "Search opportunities", types: "All types", country: "Country code (KZ, …)", availability: "Applications", open: "Applications open", closed: "Applications closed", all: "All deadlines", deadline: "Deadline (Aktobe, UTC+5)", noDeadline: "No deadline specified", source: "Original source", organization: "Organization", funding: "Funding", back: "All opportunities", find: "Search", empty: "No opportunities found", unavailable: "Unable to load opportunities. Please try again later.", read: "Learn more", reset: "Reset filters", description: "Description", countries: "Country", international: "Unspecified / international" },
};
export const opportunityErrors: Record<string, string> = {
  validation: "Проверьте обязательные RU/KK-поля, код страны, дату и HTTP(S)-ссылку на источник.",
  invalid_input: "Проверьте поля формы и переводы RU/KK.",
  forbidden: "Недостаточно прав для этого действия.",
  stale_version: "Запись уже изменена. Обновите страницу перед сохранением.",
  slug_reserved: "Этот slug закреплён за другой возможностью. Выберите другой адрес.",
  slug_conflict: "Этот slug уже занят. Выберите другой адрес.",
  not_found: "Возможность больше недоступна.",
  invalid_transition: "Сначала верните запись из архива в черновики.",
  action_failed: "Не удалось сохранить изменения. Повторите попытку позже.",
};
export function opportunityErrorMessage(code: string) {
  return Object.hasOwn(opportunityErrors, code) ? opportunityErrors[code] : opportunityErrors.action_failed;
}

