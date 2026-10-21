import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Award,
  BriefcaseBusiness,
  CalendarDays,
  Code2,
  FlaskConical,
  GraduationCap,
  Handshake,
  Lightbulb,
  Mail,
  MapPin,
  Menu,
  Microscope,
  Send,
  Trophy,
  Users,
} from "lucide-react";
import { homeCatalogs, homeCopy, type HomeCard, type Homepage } from "@/lib/homepage";
import { locales, type Locale } from "@/lib/i18n/locales";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { supportCopy } from "@/lib/i18n/support-request";
import styles from "./PublicHomepage.module.css";

const copy = {
  ru: {
    navigation: "Навигация по платформе",
    menu: "Открыть меню",
    nav: { scientists: "Учёные", research: "Исследования", projects: "Задачи региона", science: "IT for Science", opportunities: "Возможности", about: "О Совете" },
    apply: "Подать заявку",
    heroTitle: "Наука, которая работает для региона",
    heroIntro: "Объединяем учёных, данные и реальные задачи Актюбинской области.",
    scientist: "Я учёный",
    propose: "Предложить задачу",
    stats: ["Учёных в сообществе", "Исследовательских проектов", "Партнёров в регионе"],
    actionsTitle: "Что вы можете сделать на платформе",
    actions: [
      ["Найти коллег", "Ищите исследователей по направлениям и компетенциям, собирайте команды."],
      ["Запустить исследование", "Публикуйте идею, находите данные и партнёров, начинайте совместные проекты."],
      ["Получить IT-помощь", "Разработка сервисов, анализ данных и визуализация для исследовательских задач."],
      ["Найти гранты", "Актуальные программы, конкурсы и другие возможности для ваших исследований."],
    ],
    researchTitle: "Актуальные исследования",
    researchEmpty: "Опубликованные исследования появятся здесь. Каталог уже доступен для просмотра.",
    allResearch: "Все исследования",
    tasksTitle: "Задачи региона",
    tasks: [
      ["Научные проекты", "Работы, в которых исследовательские команды решают прикладные задачи региона."],
      ["Research Program", "Программы для развития идей — от постановки задачи до публичного результата."],
      ["Наставничество", "Поддержка опытных учёных для молодых исследователей и проектных команд."],
    ],
    itTitle: "IT for Science",
    itText: "Бесплатно помогаем учёным создавать цифровые инструменты для исследований.",
    itCta: "Рассказать о задаче",
    opportunitiesTitle: "Возможности для учёных",
    opportunities: [
      ["Гранты", "Актуальные грантовые программы для идей и проектов."],
      ["Конференции", "Научные конференции, семинары и мероприятия."],
      ["Конкурсы", "Конкурсы и премии для учёных и исследовательских команд."],
      ["Стажировки", "Стажировки в научных и технологических организациях."],
    ],
    more: "Подробнее",
    all: "Все материалы",
    footerText: "Объединяем учёных, данные и технологии для решения задач и развития Актюбинской области.",
    footerNav: "Навигация",
    contacts: "Контакты",
    connect: "Мы на связи",
    connectText: "Предложите исследовательскую или цифровую задачу команде Совета.",
    write: "Написать нам",
    region: "Актюбинская область, Казахстан",
    made: "Сделано для науки и региона",
  },
  kk: {
    navigation: "Платформа навигациясы",
    menu: "Мәзірді ашу",
    nav: { scientists: "Ғалымдар", research: "Зерттеулер", projects: "Өңір міндеттері", science: "IT for Science", opportunities: "Мүмкіндіктер", about: "Кеңес туралы" },
    apply: "Өтінім беру",
    heroTitle: "Өңір үшін жұмыс істейтін ғылым",
    heroIntro: "Ақтөбе облысының ғалымдарын, деректерін және нақты міндеттерін біріктіреміз.",
    scientist: "Мен ғалыммын",
    propose: "Міндет ұсыну",
    stats: ["Қауымдастықтағы ғалымдар", "Зерттеу жобалары", "Өңірдегі серіктестер"],
    actionsTitle: "Платформада не істей аласыз",
    actions: [
      ["Әріптестерді табу", "Зерттеушілерді бағыттары мен құзыреттері бойынша тауып, команда құрыңыз."],
      ["Зерттеуді бастау", "Идеяны жариялап, деректер мен серіктестерді тауып, ортақ жоба бастаңыз."],
      ["IT-көмек алу", "Зерттеу міндеттеріне арналған сервистер, деректерді талдау және визуализация."],
      ["Гранттарды табу", "Зерттеулерге арналған өзекті бағдарламалар, байқаулар мен мүмкіндіктер."],
    ],
    researchTitle: "Өзекті зерттеулер",
    researchEmpty: "Жарияланған зерттеулер осында пайда болады. Каталогты қазір қарауға болады.",
    allResearch: "Барлық зерттеулер",
    tasksTitle: "Өңір міндеттері",
    tasks: [
      ["Ғылыми жобалар", "Зерттеу топтары өңірдің қолданбалы міндеттерін шешетін жұмыстар."],
      ["Research Program", "Идеяны міндет қоюдан бастап ашық нәтижеге дейін дамыту бағдарламалары."],
      ["Тәлімгерлік", "Жас зерттеушілер мен жобалық командаларға тәжірибелі ғалымдардың қолдауы."],
    ],
    itTitle: "IT for Science",
    itText: "Ғалымдарға зерттеуге арналған цифрлық құралдарды тегін жасауға көмектесеміз.",
    itCta: "Міндет туралы айту",
    opportunitiesTitle: "Ғалымдарға арналған мүмкіндіктер",
    opportunities: [
      ["Гранттар", "Идеялар мен жобаларға арналған өзекті гранттық бағдарламалар."],
      ["Конференциялар", "Ғылыми конференциялар, семинарлар және іс-шаралар."],
      ["Байқаулар", "Ғалымдар мен зерттеу топтарына арналған байқаулар мен сыйлықтар."],
      ["Тағылымдамалар", "Ғылыми және технологиялық ұйымдардағы тағылымдамалар."],
    ],
    more: "Толығырақ",
    all: "Барлық материалдар",
    footerText: "Ақтөбе облысының міндеттерін шешу және дамыту үшін ғалымдарды, деректер мен технологияларды біріктіреміз.",
    footerNav: "Навигация",
    contacts: "Байланыстар",
    connect: "Байланыста болайық",
    connectText: "Кеңес командасына зерттеу немесе цифрлық міндет ұсыныңыз.",
    write: "Бізге жазу",
    region: "Ақтөбе облысы, Қазақстан",
    made: "Ғылым мен өңір үшін жасалды",
  },
  en: {
    navigation: "Platform navigation",
    menu: "Open menu",
    nav: { scientists: "Scientists", research: "Research", projects: "Regional challenges", science: "IT for Science", opportunities: "Opportunities", about: "About the Council" },
    apply: "Apply now",
    heroTitle: "Science that works for the region",
    heroIntro: "We connect scientists, data, and real challenges of the Aktobe Region.",
    scientist: "I am a scientist",
    propose: "Propose a challenge",
    stats: ["Scientists in the community", "Research projects", "Regional partners"],
    actionsTitle: "What you can do on the platform",
    actions: [
      ["Find colleagues", "Discover researchers by field and expertise and build a team."],
      ["Launch research", "Publish an idea, find data and partners, and start a joint project."],
      ["Get IT support", "Services, data analysis, and visualization for research challenges."],
      ["Find grants", "Current programs, competitions, and opportunities for your research."],
    ],
    researchTitle: "Featured research",
    researchEmpty: "Published research will appear here. The full catalogue is already available.",
    allResearch: "All research",
    tasksTitle: "Regional challenges",
    tasks: [
      ["Research projects", "Work where research teams solve applied challenges facing the region."],
      ["Research Program", "Programs that take an idea from a clear challenge to a public outcome."],
      ["Mentorship", "Experienced researchers supporting young scientists and project teams."],
    ],
    itTitle: "IT for Science",
    itText: "We help scientists build digital research tools free of charge.",
    itCta: "Tell us about a challenge",
    opportunitiesTitle: "Opportunities for scientists",
    opportunities: [
      ["Grants", "Current grant programs for ideas and projects."],
      ["Conferences", "Scientific conferences, seminars, and events."],
      ["Competitions", "Competitions and awards for scientists and research teams."],
      ["Internships", "Placements at scientific and technology organizations."],
    ],
    more: "Learn more",
    all: "All materials",
    footerText: "Connecting scientists, data, and technology to solve challenges and advance the Aktobe Region.",
    footerNav: "Navigation",
    contacts: "Contacts",
    connect: "Stay connected",
    connectText: "Bring a research or digital challenge to the Council team.",
    write: "Contact us",
    region: "Aktobe Region, Kazakhstan",
    made: "Made for science and the region",
  },
} as const;

const actionIcons = [Users, FlaskConical, Code2, Award];
const actionHrefs = (locale: Locale) => [
  `/${locale}/scientists`,
  `/${locale}/support/research_proposal`,
  `/${locale}/support/it_request`,
  `/${locale}/opportunities?type=grant`,
];
const opportunityIcons = [Award, CalendarDays, Trophy, GraduationCap];
const opportunityTypes = ["grant", "conference", "competition", "internship"];
const taskIcons = [Microscope, Lightbulb, Handshake];
const taskHrefs = (locale: Locale) => [`/${locale}/projects`, `/${locale}/research-program`, `/${locale}/mentorship`];

function Brand({ locale, priority = false }: { locale: Locale; priority?: boolean }) {
  const russian = locale === "ru";
  return <span className={styles.brand}>
    <Image
      className={styles.brandLogo}
      src={russian ? "/images/smu-logo-ru.png" : "/images/smu-logo-kk.png"}
      width={1448}
      height={1086}
      sizes="(max-width: 820px) 190px, 225px"
      alt={russian ? "Совет молодых учёных" : "Жас ғалымдар кеңесі"}
      priority={priority}
    />
  </span>;
}

function HomeHeader({ locale, siteName }: { locale: Locale; siteName: string }) {
  const text = copy[locale];
  const links = [
    [text.nav.scientists, `/${locale}/scientists`], [text.nav.research, `/${locale}/research`],
    [text.nav.projects, `/${locale}/projects`], [text.nav.science, `/${locale}/support/it_request`],
    [text.nav.opportunities, `/${locale}/opportunities`], [text.nav.about, `/${locale}/pages/about`],
  ] as const;
  return <header className={styles.header}><div className={styles.headerInner}>
    <Link className={styles.brandLink} href={`/${locale}`} aria-label={siteName}><Brand locale={locale} priority /></Link>
    <nav className={styles.desktopNav} aria-label={text.navigation}>{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav>
    <div className={styles.headerTools}>
      <span className={styles.languages}>{locales.map(language => <Link key={language} href={`/${language}`} aria-current={language === locale ? "page" : undefined}>{language.toUpperCase()}</Link>)}</span>
      <Link className={styles.headerCta} href={`/${locale}/support/research_proposal`}>{text.apply}</Link>
      <details className={styles.mobileMenu}><summary aria-label={text.menu}><Menu aria-hidden="true" /></summary><div><nav aria-label={text.navigation}>{links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</nav></div></details>
    </div>
  </div></header>;
}

function HeroVisual() {
  return <div className={styles.heroVisual} aria-hidden="true">
    <Image
      className={styles.heroArtwork}
      src="/images/hero-aktobe-science.png"
      width={1536}
      height={1024}
      sizes="(max-width: 820px) 92vw, 52vw"
      alt=""
      priority
    />
  </div>;
}

function SectionHeading({ title, href, link, id }: { title: string; href?: string; link?: string; id?: string }) {
  return <div className={styles.sectionHeading}><h2 id={id}>{title}</h2>{href && link ? <Link href={href}>{link}<ArrowRight aria-hidden="true" /></Link> : null}</div>;
}

function ResearchCard({ item, index }: { item: HomeCard; index: number }) {
  return <Link className={styles.researchCard} href={item.href}>
    <span className={`${styles.researchCover} ${styles[`cover${index % 3}`]}`} aria-hidden="true"><FlaskConical /><i /><b /></span>
    <span className={styles.researchBody}><span className={styles.badge}>{index % 2 === 0 ? "Research" : "Science project"}</span><strong>{item.title}</strong>{item.summary ? <span>{item.summary}</span> : null}<span className={styles.cardLink}><MapPin aria-hidden="true" />Актюбинская область<ArrowRight aria-hidden="true" /></span></span>
  </Link>;
}

function GenericSection({ section, locale }: { section: Homepage["sections"][number]; locale: Locale }) {
  const fallback = homeCopy[locale];
  const catalog = homeCatalogs[section.key];
  return <section className={styles.secondarySection} aria-labelledby={`home-${section.key}`}>
    <SectionHeading id={`home-${section.key}`} title={section.title || fallback.sections[section.key]} href={catalog ? `/${locale}/${catalog}` : undefined} link={copy[locale].all} />
    {section.items.length ? <div className={styles.compactGrid}>{section.items.map(item => <Link className={styles.compactCard} href={item.href} key={item.id}><span><BriefcaseBusiness aria-hidden="true" /></span><strong>{item.title}</strong>{item.summary ? <p>{item.summary}</p> : null}<ArrowRight aria-hidden="true" /></Link>)}</div> : <p className={styles.empty}>{fallback.empty}</p>}
  </section>;
}

export function PublicHomepage({ data, locale }: { data: Homepage; locale: Locale }) {
  const text = copy[locale], fallback = homeCopy[locale];
  const byKey = new Map(data.sections.map(section => [section.key, section]));
  const hero = byKey.get("hero");
  const research = byKey.get("featured_research");
  const support = byKey.get("scientist_support");
  const noConfiguredSections = data.sections.length === 0;
  const actionLimit = support?.display_limit ?? 4;
  const additional = data.sections.filter(section => !["hero", "featured_research", "scientist_support", "research_program", "mentorship", "opportunities"].includes(section.key));
  const supportLabels = supportCopy[locale].kinds;
  const dynamicActionTitles = [text.actions[0][0], supportLabels.research_proposal, supportLabels.it_request, text.actions[3][0]];
  return <div className={styles.site}>
    <HomeHeader locale={locale} siteName={data.settings.site_name} />
    <main>
      <section className={styles.hero} aria-labelledby="home-title"><div className={styles.heroInner}>
        <div className={styles.heroCopy}><p className={styles.eyebrow}>{getDictionary(locale).common.region}</p><h1 id="home-title">{hero?.title || text.heroTitle}</h1><p className={styles.heroIntro}>{text.heroIntro}</p>
          <div className={styles.heroActions}><Link className={styles.primaryButton} href={`/${locale}/scientists`}>{text.scientist}<Users aria-hidden="true" /></Link><Link className={styles.secondaryButton} href={`/${locale}/support/research_proposal`}>{text.propose}<Lightbulb aria-hidden="true" /></Link></div>
          <dl className={styles.stats}><div><dt>{data.stats.scientists}</dt><dd>{text.stats[0]}</dd></div><div><dt>{data.stats.researchProjects}</dt><dd>{text.stats[1]}</dd></div><div><dt>{data.stats.partners}</dt><dd>{text.stats[2]}</dd></div></dl>
        </div><HeroVisual />
      </div></section>

      <section className={styles.section}><SectionHeading title={support?.title || text.actionsTitle} /><div className={styles.actionGrid}>{text.actions.slice(0, Math.min(actionLimit, 4)).map((item, index) => { const Icon = actionIcons[index]; return <Link className={styles.actionCard} href={actionHrefs(locale)[index]} key={item[0]}><Icon aria-hidden="true" /><strong>{dynamicActionTitles[index]}</strong><p>{item[1]}</p><ArrowRight aria-hidden="true" /></Link>; })}</div></section>

      {(research || noConfiguredSections) ? <section className={styles.section} aria-labelledby="featured-research-title"><SectionHeading id="featured-research-title" title={research?.title || text.researchTitle} href={`/${locale}/research`} link={text.allResearch} />
        {research?.items.length ? <div className={styles.researchGrid}>{research.items.slice(0, 3).map((item, index) => <ResearchCard item={item} index={index} key={item.id} />)}</div> : <Link className={styles.researchEmpty} href={`/${locale}/research`}><FlaskConical aria-hidden="true" /><span><strong>{text.researchTitle}</strong><small>{text.researchEmpty}</small></span><ArrowRight aria-hidden="true" /></Link>}
      </section> : null}

      <section className={styles.section}><SectionHeading title={text.tasksTitle} href={`/${locale}/projects`} link={text.all} /><div className={styles.taskGrid}>{text.tasks.map((item, index) => { const Icon = taskIcons[index]; return <Link className={styles.taskCard} href={taskHrefs(locale)[index]} key={item[0]}><span className={styles.taskTop}><span className={styles.badge}>{index === 0 ? "Region" : index === 1 ? "Program" : "Community"}</span><Icon aria-hidden="true" /></span><strong>{item[0]}</strong><p>{item[1]}</p><span className={styles.cardLink}><MapPin aria-hidden="true" />{text.region}<ArrowRight aria-hidden="true" /></span></Link>; })}</div></section>

      <section className={styles.itBanner}><span className={styles.codeArt} aria-hidden="true"><Code2 /><i /><b /></span><div><h2>{text.itTitle}</h2><p>{text.itText}</p></div><Link href={`/${locale}/support/it_request`}>{text.itCta}<ArrowRight aria-hidden="true" /></Link></section>

      <section className={styles.section}><SectionHeading title={byKey.get("opportunities")?.title || text.opportunitiesTitle} href={`/${locale}/opportunities`} link={text.all} /><div className={styles.opportunityGrid}>{text.opportunities.map((item, index) => { const Icon = opportunityIcons[index]; return <Link className={styles.opportunityCard} href={`/${locale}/opportunities?type=${opportunityTypes[index]}`} key={item[0]}><Icon aria-hidden="true" /><span><strong>{item[0]}</strong><p>{item[1]}</p><small>{text.more}<ArrowRight aria-hidden="true" /></small></span></Link>; })}</div></section>

      {additional.map(section => <GenericSection section={section} locale={locale} key={section.key} />)}
    </main>
    <footer className={styles.footer}><div className={styles.footerGrid}><div><Brand locale={locale} /><p>{text.footerText}</p><div className={styles.socials}>{data.settings.social_links.map((link, index) => <a href={link.href} rel="noreferrer" key={index}>{link.label}</a>)}</div></div>
      <div><h2>{text.footerNav}</h2><Link href={`/${locale}`}>{fallback.home}</Link><Link href={`/${locale}/scientists`}>{text.nav.scientists}</Link><Link href={`/${locale}/research`}>{text.nav.research}</Link><Link href={`/${locale}/projects`}>{text.nav.projects}</Link><Link href={`/${locale}/opportunities`}>{text.nav.opportunities}</Link></div>
      <div><h2>{text.contacts}</h2><span><MapPin aria-hidden="true" />{text.region}</span>{data.settings.contact_email ? <a href={`mailto:${data.settings.contact_email}`}><Mail aria-hidden="true" />{data.settings.contact_email}</a> : <Link href={`/${locale}/pages/contacts`}><Mail aria-hidden="true" />{text.contacts}</Link>}</div>
      <div><h2>{text.connect}</h2><p>{text.connectText}</p><Link className={styles.footerCta} href={`/${locale}/support`}>{text.write}<Send aria-hidden="true" /></Link></div>
    </div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} {data.settings.site_name}</span><span>{text.made}</span></div></footer>
  </div>;
}
