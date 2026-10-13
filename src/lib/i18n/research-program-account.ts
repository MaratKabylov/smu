import type { Locale } from "./locales";
export const researchProgramAccountCopy = {
  ru: {
    title: "Участие в Research Program", intake: "Набор", dates: "Период программы", curriculum: "План программы",
    participation: "Участие", active: "Активное", completed: "Завершено", pending: "Участие появится после принятия заявки.",
    mentor: "Наставник", noMentor: "Наставник пока не назначен.", unavailableMentor: "Профиль назначенного наставника недоступен.",
    projects: "Мои проекты программы", noProjects: "Назначенных проектов пока нет. Проект появится после связи заявки с вашим научным профилем и участия в команде проекта.",
    outputs: "Результаты", noOutputs: "Опубликованных результатов на этом языке пока нет.", outputsIntro: "Здесь показаны опубликованные результаты и открытые файлы проекта.",
    version: "Версия", download: "Скачать", external: "Открыть результат", license: "Условия использования", profile: "Профиль наставника",
    baseline: "Участие перенесено из прежней версии; дата принятия заявки не зафиксирована.", started: "Принята в программу", unavailable: "Не удалось загрузить участие. Попробуйте позже.",
  },
  kk: {
    title: "Research Program бағдарламасына қатысу", intake: "Қабылдау", dates: "Бағдарлама мерзімі", curriculum: "Бағдарлама жоспары",
    participation: "Қатысу", active: "Белсенді", completed: "Аяқталған", pending: "Өтінім қабылданғаннан кейін қатысу көрсетіледі.",
    mentor: "Тәлімгер", noMentor: "Тәлімгер әлі тағайындалмаған.", unavailableMentor: "Тағайындалған тәлімгердің профилі қолжетімсіз.",
    projects: "Бағдарламадағы жобаларым", noProjects: "Тағайындалған жобалар әлі жоқ. Өтінім ғылыми профиліңізбен байланысып, жоба тобына қосылғаннан кейін жоба көрсетіледі.",
    outputs: "Нәтижелер", noOutputs: "Бұл тілде жарияланған нәтижелер әлі жоқ.", outputsIntro: "Мұнда жобаның жарияланған нәтижелері мен ашық файлдары көрсетіледі.",
    version: "Нұсқа", download: "Жүктеп алу", external: "Нәтижені ашу", license: "Пайдалану шарттары", profile: "Тәлімгер профилі",
    baseline: "Қатысу бұрынғы нұсқадан көшірілген; өтінімнің қабылданған күні тіркелмеген.", started: "Бағдарламаға қабылданды", unavailable: "Қатысу деректерін жүктеу мүмкін болмады. Кейінірек қайталап көріңіз.",
  },
  en: {
    title: "Research Program participation", intake: "Intake", dates: "Program dates", curriculum: "Program curriculum",
    participation: "Participation", active: "Active", completed: "Completed", pending: "Participation will appear after your application is accepted.",
    mentor: "Mentor", noMentor: "No mentor assigned yet.", unavailableMentor: "The assigned mentor's profile is unavailable.",
    projects: "My program projects", noProjects: "No assigned projects yet. A project appears once your application is linked to your scientific profile and you join its team.",
    outputs: "Outputs", noOutputs: "No published outputs in this language yet.", outputsIntro: "Published outputs and public project files are shown here.",
    version: "Version", download: "Download", external: "Open output", license: "Terms of use", profile: "Mentor profile",
    baseline: "Participation was migrated from an earlier version; the acceptance date was not recorded.", started: "Accepted into the program", unavailable: "Unable to load participation. Please try again later.",
  },
} satisfies Record<Locale, unknown>;
