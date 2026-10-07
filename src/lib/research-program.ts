import type { ApplicationStatus, ResearchProgram, ResearchProgramFormat, ResearchProgramStatus } from "../types/domain/research-program";
export const researchProgramAdminPath = "/admin/programs/research-program";
export const researchProgramStatusLabels: Record<ResearchProgramStatus, string> = { draft: "Черновик", published: "Опубликовано", archived: "В архиве" };
export const applicationStatusLabels: Record<ApplicationStatus, string> = { new: "Новая", in_review: "На рассмотрении", accepted: "Принята", rejected: "Отклонена", completed: "Участие завершено" };
export const researchProgramFormatLabels: Record<"ru" | "kk" | "en", Record<ResearchProgramFormat, string>> = {
  ru: { online: "Онлайн", offline: "Очно", hybrid: "Смешанный формат" },
  kk: { online: "Онлайн", offline: "Офлайн", hybrid: "Аралас формат" },
  en: { online: "Online", offline: "In person", hybrid: "Hybrid" },
};
export function canChangeApplicationStatus(from: ApplicationStatus, to: ApplicationStatus) {
  return from === to || (from === "new" && (to === "in_review" || to === "rejected"))
    || (from === "in_review" && (to === "accepted" || to === "rejected")) || (from === "accepted" && to === "completed");
}
export function canChangeResearchProgramStatus(from: ResearchProgramStatus, to: ResearchProgramStatus) {
  return from !== to && (from !== "archived" || to === "draft");
}

export function programLocalDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function programApplicationsOpen(program: Pick<ResearchProgram, "status" | "applicationsOpenOn" | "applicationDeadline">, now = new Date()) {
  const today = programLocalDate(now);
  return program.status === "published" && today >= program.applicationsOpenOn && today <= program.applicationDeadline;
}
export function programDate(value: string, locale: "ru" | "kk" | "en") {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"));
}
