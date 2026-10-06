// The editorial calendar uses Kazakhstan time explicitly, independently of
// the browser/server timezone. Databases receive an absolute UTC timestamp.
export const editorialTimeZone = "Asia/Almaty";
export const editorialTimeZoneLabel = "Время Казахстана (UTC+5)";

export function scheduleInputValue(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: editorialTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function scheduleDisplayValue(timestamp: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: editorialTimeZone, dateStyle: "medium", timeStyle: "short",
  }).format(new Date(timestamp));
}
