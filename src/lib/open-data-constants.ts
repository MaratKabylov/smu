export const openDataCategoryStatuses = [
  "planned",
  "collecting",
  "processing",
  "collected",
] as const;

export const openDataCategoryStatusLabels = {
  ru: {
    planned: "Запланировано",
    collecting: "Ведётся сбор",
    processing: "Ведётся обработка",
    collected: "Данные собраны",
  },
  kk: {
    planned: "Жоспарланған",
    collecting: "Деректер жиналуда",
    processing: "Өңделуде",
    collected: "Деректер жиналды",
  },
  en: {
    planned: "Planned",
    collecting: "Collecting data",
    processing: "Processing data",
    collected: "Data collected",
  },
} as const;

export const openDataInitiativeStatuses = [
  { value: "collecting", label: "Ведётся сбор и систематизация" },
  { value: "processing", label: "Идёт обработка данных" },
  { value: "active", label: "Платформа активна" },
  { value: "planned", label: "Подготовка запуска" },
] as const;

export type OpenDataIconOption = {
  value: string;
  label: string;
};

export const openDataIconOptions: readonly OpenDataIconOption[] = [
  { value: "database", label: "База данных" },
  { value: "layers", label: "Источники / Слои" },
  { value: "file-text", label: "Записи / Документы" },
  { value: "sparkles", label: "Направления" },
  { value: "hard-drive", label: "Объём данных" },
  { value: "map-pin", label: "География / GIS" },
  { value: "calendar", label: "Временной охват" },
  { value: "leaf", label: "Экология" },
  { value: "users", label: "Демография" },
  { value: "cloud-sun", label: "Климат и погода" },
  { value: "droplets", label: "Водные ресурсы" },
  { value: "truck", label: "Транспорт" },
  { value: "trending-up", label: "Экономика" },
  { value: "mountain", label: "Природные ресурсы" },
  { value: "heart-pulse", label: "Здравоохранение" },
  { value: "graduation-cap", label: "Образование" },
  { value: "sprout", label: "Сельское хозяйство" },
  { value: "bug", label: "Биоразнообразие" },
  { value: "flame", label: "Природные пожары" },
  { value: "building-2", label: "Урбанистика" },
  { value: "landmark", label: "История и архивы" },
  { value: "folder", label: "Категория" },
  { value: "bar-chart", label: "Статистика" },
  { value: "globe", label: "Открытая сеть" },
  { value: "activity", label: "Мониторинг" },
  { value: "award", label: "Достижения" },
  { value: "book-open", label: "Справочники" },
  { value: "flask", label: "Наука и исследования" },
] as const;

export const openDataAdminErrors: Record<string, string> = {
  validation: "Проверьте обязательные поля на русском и казахском языках, формат кодов, дат и ссылок.",
  forbidden: "Недостаточно прав для управления разделом Open Data Aktobe.",
  duplicate: "Запись с таким кодом или slug уже существует. Укажите уникальное значение.",
  slug_conflict: "Запись с таким кодом или slug уже существует. Укажите уникальное значение.",
  not_found: "Запись не найдена или уже была удалена.",
  action_failed: "Не удалось выполнить операцию. Проверьте данные и повторите попытку.",
};

export function openDataErrorMessage(code?: string | null): string {
  if (!code) return openDataAdminErrors.action_failed;
  return Object.hasOwn(openDataAdminErrors, code)
    ? openDataAdminErrors[code]
    : openDataAdminErrors.action_failed;
}
