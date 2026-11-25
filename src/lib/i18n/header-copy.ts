import type { Locale, PublicSection } from "./locales";

type HeaderStrings = {
  navigation: string;
  language: string;
  footer: string;
  menu: string;
  apply: string;
  tasks: string;
  science: string;
  about: string;
  find: string;
  account: string;
  legacy: string;
  sections: Record<PublicSection, string>;
};

export const publicHeaderCopy: Record<Locale, HeaderStrings> = {
  ru: {
    navigation: "Основная навигация",
    language: "Выбор языка",
    footer: "Совет молодых учёных",
    menu: "Открыть меню",
    apply: "Подать заявку",
    tasks: "Задачи региона",
    science: "IT for Science",
    about: "О Совете",
    find: "Найти",
    account: "Личный кабинет",
    legacy: "Научное наследие",
    sections: {
      journal: "Журнал",
      scientists: "Учёные",
      research: "Исследования",
      projects: "Проекты",
      publications: "Публикации",
      mentorship: "Наставничество",
      "research-program": "Research Program",
      events: "События",
      opportunities: "Возможности",
      results: "Научные результаты",
    },
  },
  kk: {
    navigation: "Негізгі навигация",
    language: "Тілді таңдау",
    footer: "Жас ғалымдар кеңесі",
    menu: "Мәзірді ашу",
    apply: "Өтінім беру",
    tasks: "Өңір міндеттері",
    science: "IT for Science",
    about: "Кеңес туралы",
    find: "Іздеу",
    account: "Жеке кабинет",
    legacy: "Ғылыми мұра",
    sections: {
      journal: "Журнал",
      scientists: "Ғалымдар",
      research: "Зерттеулер",
      projects: "Жобалар",
      publications: "Жарияланымдар",
      mentorship: "Тәлімгерлік",
      "research-program": "Зерттеу бағдарламасы",
      events: "Іс-шаралар",
      opportunities: "Мүмкіндіктер",
      results: "Ғылыми нәтижелер",
    },
  },
  en: {
    navigation: "Main navigation",
    language: "Choose language",
    footer: "Council of Young Scientists",
    menu: "Open menu",
    apply: "Apply now",
    tasks: "Regional challenges",
    science: "IT for Science",
    about: "About the Council",
    find: "Search",
    account: "My account",
    legacy: "Scientific legacy",
    sections: {
      journal: "Journal",
      scientists: "Scientists",
      research: "Research",
      projects: "Projects",
      publications: "Publications",
      mentorship: "Mentorship",
      "research-program": "Research Program",
      events: "Events",
      opportunities: "Opportunities",
      results: "Research Outputs",
    },
  },
};
