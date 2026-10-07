import type { AccessContext } from "../types/domain/auth";
import type { EventFormat, EventKind, EventStatus, ScienceEvent } from "../types/domain/event";
import type { ScientistLocale } from "../types/domain/scientist";

export const eventTimeZone = "Asia/Aqtobe";
export const eventAdminPath = "/admin/programs/events";
export function canManageEvents(access: AccessContext) {
  return access.permissions.has("events.manage");
}
export function canChangeEventStatus(current: EventStatus, next: EventStatus) {
  if (current === next) return false;
  if (current === "archived") return next === "draft";
  if (next === "cancelled") return current === "published";
  return true;
}
export const eventStatusLabels: Record<EventStatus, string> = {
  draft: "Черновик", published: "Опубликовано", cancelled: "Отменено", archived: "В архиве",
};
export const eventFormatLabels: Record<ScientistLocale, Record<EventFormat, string>> = {
  ru: { offline: "Очно", online: "Онлайн", hybrid: "Гибридный формат" },
  kk: { offline: "Офлайн", online: "Онлайн", hybrid: "Аралас формат" },
  en: { offline: "In person", online: "Online", hybrid: "Hybrid" },
};
export const eventKindLabels: Record<ScientistLocale, Record<EventKind, string>> = {
  ru: { conference: "Конференция", seminar: "Семинар", workshop: "Практикум", meetup: "Встреча" },
  kk: { conference: "Конференция", seminar: "Семинар", workshop: "Практикум", meetup: "Кездесу" },
  en: { conference: "Conference", seminar: "Seminar", workshop: "Workshop", meetup: "Meetup" },
};
export function eventDate(value: string, locale: ScientistLocale) {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: eventTimeZone,
  }).format(new Date(value));
}
// datetime-local has no zone. The editor always uses the event's regional time.
export function eventLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: eventTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find(item => item.type === name)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function eventRegistrationOpen(event: Pick<ScienceEvent, "status" | "startsAt" | "registrationUrl" | "registrationDeadline">, now = new Date()) {
  return event.status === "published" && Boolean(event.registrationUrl)
    && now.getTime() < new Date(event.startsAt).getTime()
    && (!event.registrationDeadline || now.getTime() <= new Date(event.registrationDeadline).getTime());
}
