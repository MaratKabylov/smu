import type { AccessContext } from "../types/domain/auth";
import type { ScienceWorkKind, ScienceWorkStage, ScienceWorkStatus } from "../types/domain/science-work";

export function canManageScienceWork(access: AccessContext, kind: ScienceWorkKind) {
  return access.permissions.has(kind === "project" ? "projects.manage" : "research.manage");
}
export function scienceWorkPath(kind: ScienceWorkKind) {
  return kind === "project" ? "/projects" : "/research";
}
export function scienceWorkAdminPath(kind: ScienceWorkKind) {
  return "/admin/science" + scienceWorkPath(kind);
}
export function canChangeScienceWorkStatus(current: ScienceWorkStatus, next: ScienceWorkStatus) {
  return current !== next && (current !== "archived" || next === "draft");
}
export const scienceWorkStatusLabels: Record<ScienceWorkStatus, string> = {
  draft: "Черновик", published: "Опубликовано", archived: "В архиве",
};
export const scienceWorkStageLabels: Record<"ru" | "kk" | "en", Record<ScienceWorkStage, string>> = {
  ru: { planned: "Планируется", active: "В работе", completed: "Завершено" },
  kk: { planned: "Жоспарланған", active: "Орындалуда", completed: "Аяқталған" },
  en: { planned: "Planned", active: "Active", completed: "Completed" },
};
export const scienceWorkTitles = {
  ru: { research: "Исследования", project: "Научные проекты" },
  kk: { research: "Зерттеулер", project: "Ғылыми жобалар" },
  en: { research: "Research", project: "Research projects" },
} as const;
