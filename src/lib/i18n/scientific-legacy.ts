import type { Locale } from "./locales";
import type { legacyKinds } from "@/lib/validation/scientific-legacy";
type Copy = {
  title: string; intro: string; ownerIntro: string; create: string; back: string; empty: string; unavailable: string; type: string; all: string; find: string;
  name: string; description: string; sourceText: string; sourceUrl: string; source: string; privateSource: string; publicDescription: string;
  rights: string; save: string; pending: string; saved: string; failed: string; session: string; invalid: string; stale: string;
  consent: string; revoke: string; confirmConsent: string; consentActive: string; consentInactive: string; version: string; optional: string;
  previous: string; next: string; status: string; fallback: string; kinds: Record<(typeof legacyKinds)[number], string>; statuses: Record<"draft" | "published" | "archived", string>;
};
export const legacyCopy: Record<Locale, Copy> = {
  ru: {
    fallback: "Доступный перевод:",
    title: "Научное наследие", intro: "Темы, архивы и исследования, которые можно продолжить. Исходные данные открываются только с разрешения владельца.",
    ownerIntro: "Описание опубликованной записи видно всем. Храните неопубликованные данные и закрытые ссылки в полях исходных данных. После каждого сохранения разрешение на их публикацию сбрасывается.",
    create: "Добавить запись", back: "Назад", empty: "Записей пока нет.", unavailable: "Раздел временно недоступен.", type: "Вид наследия", all: "Все виды", find: "Показать",
    name: "Название", description: "Описание", sourceText: "Исходные данные (текст)", sourceUrl: "Ссылка на архив или данные (HTTP/S)", source: "Исходные данные", privateSource: "Владелец не открыл исходные данные.", publicDescription: "Название и описание станут общедоступными при публикации записи.",
    rights: "Подтверждаю, что владею материалами или уполномочен распоряжаться правами на них.", save: "Сохранить", pending: "Сохранение…", saved: "Сохранено.", failed: "Не удалось сохранить. Обновите страницу и повторите попытку.", session: "Войдите в подтверждённый аккаунт.", invalid: "Проверьте поля формы и подтверждение прав.", stale: "Запись изменилась. Обновите страницу перед повторным действием.",
    consent: "Открыть исходные данные", revoke: "Отозвать разрешение", confirmConsent: "Я явно разрешаю общедоступную публикацию текста и ссылки исходных данных этой сохранённой версии. Понимаю, что уже скачанные копии отозвать нельзя.", consentActive: "Разрешение на публикацию исходных данных этой версии действует.", consentInactive: "Исходные данные закрыты. Для открытия сначала сохраните и опубликуйте запись, затем дайте отдельное разрешение.", version: "Версия", optional: "необязательно", previous: "Назад", next: "Далее", status: "Статус",
    kinds: { topic: "Тема", archive: "Архив исследований", unpublished_data: "Неопубликованные данные", dataset: "Старый набор данных", methodology: "Методика", collection: "Коллекция", unfinished_research: "Незавершённое исследование", scientific_school: "Научная школа", successor_topic: "Тема, которой нужен продолжатель" }, statuses: { draft: "Черновик", published: "Опубликовано", archived: "В архиве" },
  },
  kk: {
    fallback: "Қолжетімді аударма:",
    title: "Ғылыми мұра", intro: "Жалғастыруға болатын тақырыптар, мұрағаттар мен зерттеулер. Бастапқы деректер иесінің рұқсатымен ғана ашылады.",
    ownerIntro: "Жарияланған жазбаның сипаттамасы барлығына көрінеді. Жарияланбаған деректер мен жабық сілтемелерді бастапқы деректер өрістерінде сақтаңыз. Әр сақтаудан кейін оларды жариялау рұқсаты жойылады.",
    create: "Жазба қосу", back: "Артқа", empty: "Әзірге жазбалар жоқ.", unavailable: "Бөлім уақытша қолжетімсіз.", type: "Мұра түрі", all: "Барлық түрлер", find: "Көрсету",
    name: "Атауы", description: "Сипаттамасы", sourceText: "Бастапқы деректер (мәтін)", sourceUrl: "Мұрағатқа немесе деректерге сілтеме (HTTP/S)", source: "Бастапқы деректер", privateSource: "Иесі бастапқы деректерді ашқан жоқ.", publicDescription: "Жазба жарияланғанда атауы мен сипаттамасы жалпыға қолжетімді болады.",
    rights: "Материалдардың иесі екенімді немесе олардың құқықтарын басқаруға өкілетті екенімді растаймын.", save: "Сақтау", pending: "Сақталуда…", saved: "Сақталды.", failed: "Сақтау мүмкін болмады. Бетті жаңартып, қайталаңыз.", session: "Расталған аккаунтқа кіріңіз.", invalid: "Өрістерді және құқықтарды растауды тексеріңіз.", stale: "Жазба өзгерді. Әрекетті қайталамас бұрын бетті жаңартыңыз.",
    consent: "Бастапқы деректерді ашу", revoke: "Рұқсатты қайтарып алу", confirmConsent: "Осы сақталған нұсқаның бастапқы деректер мәтіні мен сілтемесін жалпыға жариялауға нақты рұқсат беремін. Жүктелген көшірмелерді қайтарып алу мүмкін емес екенін түсінемін.", consentActive: "Осы нұсқаның бастапқы деректерін жариялау рұқсаты бар.", consentInactive: "Бастапқы деректер жабық. Ашу үшін алдымен жазбаны сақтап, жариялаңыз, содан кейін бөлек рұқсат беріңіз.", version: "Нұсқа", optional: "міндетті емес", previous: "Артқа", next: "Келесі", status: "Мәртебе",
    kinds: { topic: "Тақырып", archive: "Зерттеу мұрағаты", unpublished_data: "Жарияланбаған деректер", dataset: "Ескі деректер жиынтығы", methodology: "Әдістеме", collection: "Коллекция", unfinished_research: "Аяқталмаған зерттеу", scientific_school: "Ғылыми мектеп", successor_topic: "Жалғастырушы қажет тақырып" }, statuses: { draft: "Жоба", published: "Жарияланды", archived: "Мұрағатта" },
  },
  en: {
    fallback: "Available translation:",
    title: "Scientific legacy", intro: "Topics, archives and research to carry forward. Source data is opened only with its owner's permission.",
    ownerIntro: "Published descriptions are visible to everyone. Keep unpublished data and private links in the source fields. Every save resets permission to publish those fields.",
    create: "Add record", back: "Back", empty: "No records yet.", unavailable: "This section is temporarily unavailable.", type: "Legacy type", all: "All types", find: "Show",
    name: "Title", description: "Description", sourceText: "Source data (text)", sourceUrl: "Archive or data link (HTTP/S)", source: "Source data", privateSource: "The owner has not opened the source data.", publicDescription: "Titles and descriptions become public when this record is published.",
    rights: "I confirm that I own these materials or am authorized to manage their rights.", save: "Save", pending: "Saving…", saved: "Saved.", failed: "Could not save. Refresh the page and try again.", session: "Sign in with a verified account.", invalid: "Check the fields and rights confirmation.", stale: "This record has changed. Refresh the page before trying again.",
    consent: "Open source data", revoke: "Revoke permission", confirmConsent: "I explicitly authorize public access to the source text and link of this saved version. I understand that downloaded copies cannot be recalled.", consentActive: "Permission to publish this version's source data is active.", consentInactive: "Source data is private. Save and publish this record, then give separate permission to open it.", version: "Version", optional: "optional", previous: "Previous", next: "Next", status: "Status",
    kinds: { topic: "Topic", archive: "Research archive", unpublished_data: "Unpublished data", dataset: "Historical dataset", methodology: "Methodology", collection: "Collection", unfinished_research: "Unfinished research", scientific_school: "Scientific school", successor_topic: "Topic seeking a successor" }, statuses: { draft: "Draft", published: "Published", archived: "Archived" },
  },
};
