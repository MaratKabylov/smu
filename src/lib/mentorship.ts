import type { ApplicationStatus, MentorshipFormat, MentorshipStatus } from "../types/domain/mentorship";
export const mentorshipAdminPath = "/admin/programs/mentorship";
export const mentorshipStatusLabels: Record<MentorshipStatus, string> = { draft: "Черновик", published: "Опубликовано", archived: "В архиве" };
export const applicationStatusLabels: Record<ApplicationStatus, string> = { new: "Новая", in_review: "На рассмотрении", accepted: "Принята", rejected: "Отклонена", completed: "Наставничество завершено" };
export const mentorshipFormatLabels: Record<"ru" | "kk", Record<MentorshipFormat, string>> = {
  ru: { online: "Онлайн", offline: "Очно", hybrid: "Смешанный формат" },
  kk: { online: "Онлайн", offline: "Офлайн", hybrid: "Аралас формат" },
};
export function canChangeApplicationStatus(from: ApplicationStatus, to: ApplicationStatus) {
  return from === to || (from === "new" && (to === "in_review" || to === "rejected"))
    || (from === "in_review" && (to === "accepted" || to === "rejected")) || (from === "accepted" && to === "completed");
}
export function canChangeMentorshipStatus(from: MentorshipStatus, to: MentorshipStatus) {
  return from !== to && (from !== "archived" || to === "draft");
}
