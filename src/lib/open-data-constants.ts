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
