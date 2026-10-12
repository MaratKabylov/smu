import type { Locale } from "./locales";
import type { MentorshipKind, MentorshipRelationStatus } from "@/types/domain/mentorship";

export const mentorshipProgressCopy = {
  ru: {
    title: "Наставничество", history: "История решений", application: "Заявка", relation: "Связь", baseline: "Статус на момент обновления системы",
    recent: "Показаны последние 100 решений", withdraw: "Отозвать заявку", confirm: "Подтверждаю отзыв заявки и прекращение активного наставничества", pending: "Сохранение…", saved: "Заявка отозвана.", failed: "Не удалось отозвать заявку. Обновите страницу и повторите попытку.", session: "Сессия истекла. Войдите снова.", unavailable: "Не удалось загрузить историю наставничества.",
    kinds: { mentor: "Наставник", consultant: "Консультант", project_supervisor: "Руководитель проекта", coauthor: "Соавтор", reviewer: "Рецензент", research_program_mentor: "Наставник Research Program" },
    statuses: { active: "Активно", paused: "Приостановлено", completed: "Завершено", cancelled: "Прекращено" },
    withdrawn: "Отозвана",
  },
  kk: {
    title: "Тәлімгерлік", history: "Шешімдер тарихы", application: "Өтінім", relation: "Байланыс", baseline: "Жүйе жаңартылған кездегі мәртебе",
    recent: "Соңғы 100 шешім көрсетілген", withdraw: "Өтінімді қайтарып алу", confirm: "Өтінімді қайтарып алуды және белсенді тәлімгерлікті тоқтатуды растаймын", pending: "Сақтау…", saved: "Өтінім қайтарып алынды.", failed: "Өтінімді қайтарып алу мүмкін болмады. Бетті жаңартып, қайталап көріңіз.", session: "Сессия аяқталды. Қайта кіріңіз.", unavailable: "Тәлімгерлік тарихын жүктеу мүмкін болмады.",
    kinds: { mentor: "Тәлімгер", consultant: "Кеңесші", project_supervisor: "Жоба жетекшісі", coauthor: "Бірлескен автор", reviewer: "Рецензент", research_program_mentor: "Research Program тәлімгері" },
    statuses: { active: "Белсенді", paused: "Уақытша тоқтатылған", completed: "Аяқталған", cancelled: "Тоқтатылған" },
    withdrawn: "Қайтарып алынған",
  },
  en: {
    title: "Mentorship", history: "Decision history", application: "Application", relation: "Relationship", baseline: "Status observed at system upgrade",
    recent: "Showing the latest 100 decisions", withdraw: "Withdraw application", confirm: "I confirm withdrawal and cancellation of any active mentorship", pending: "Saving…", saved: "Application withdrawn.", failed: "Unable to withdraw the application. Refresh the page and try again.", session: "Your session has expired. Please sign in again.", unavailable: "Unable to load mentorship history.",
    kinds: { mentor: "Mentor", consultant: "Consultant", project_supervisor: "Project supervisor", coauthor: "Coauthor", reviewer: "Reviewer", research_program_mentor: "Research Program mentor" },
    statuses: { active: "Active", paused: "Paused", completed: "Completed", cancelled: "Cancelled" },
    withdrawn: "Withdrawn",
  },
} satisfies Record<Locale, { kinds: Record<MentorshipKind, string>; statuses: Record<MentorshipRelationStatus, string> } & Record<string, unknown>>;
