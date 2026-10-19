import type { Locale } from "./locales";

export const notificationCopy = {
  ru: { title: "Уведомления", empty: "Уведомлений пока нет.", unread: "Непрочитанных", all: "Отметить все прочитанными", read: "Отметить прочитанным", language: "Язык служебных уведомлений", save: "Сохранить язык", previous: "Назад", next: "Далее" },
  kk: { title: "Хабарламалар", empty: "Әзірге хабарлама жоқ.", unread: "Оқылмаған", all: "Барлығын оқылған деп белгілеу", read: "Оқылған деп белгілеу", language: "Қызметтік хабарламалар тілі", save: "Тілді сақтау", previous: "Артқа", next: "Келесі" },
  en: { title: "Notifications", empty: "No notifications yet.", unread: "Unread", all: "Mark all as read", read: "Mark as read", language: "Service notification language", save: "Save language", previous: "Previous", next: "Next" },
} satisfies Record<Locale, Record<string, string>>;
