import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  options: vi.fn(),
  applications: vi.fn(),
  progress: vi.fn(),
  save: vi.fn(),
  changeState: vi.fn(),
  updateApplication: vi.fn(),
  changeRelation: vi.fn(),
  listPage: vi.fn(),
  getBySlug: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not_found");
  },
  redirect: (path: string) => {
    throw new Error("redirect:" + path);
  },
}));

vi.mock("@/server/services/access.service", () => ({
  getAdminAccess: mocks.access,
}));

vi.mock("@/lib/permissions/permissions", () => ({
  canManageMentorship: (access: any) =>
    access?.permissions?.includes("mentorship.manage") || access?.role === "admin",
  canAccessAdmin: () => true,
}));

vi.mock("@/server/services/mentorship.service", () => ({
  MentorshipService: class {
    list = mocks.list;
    getById = mocks.getById;
    options = mocks.options;
    applications = mocks.applications;
    progress = mocks.progress;
    save = mocks.save;
    changeState = mocks.changeState;
    updateApplication = mocks.updateApplication;
    changeRelation = mocks.changeRelation;
  },
  PublicMentorshipService: class {
    listPage = mocks.listPage;
    getBySlug = mocks.getBySlug;
  },
  getPublicMentorship: (locale: string, slug: string) => mocks.getBySlug(locale, slug),
}));

vi.mock("@/server/actions/mentorship.actions", () => ({
  saveMentorshipOffer: mocks.save,
  changeMentorshipOffer: mocks.changeState,
  updateMentorshipApplication: mocks.updateApplication,
  changeRelation: mocks.changeRelation,
  changeMentorshipRelation: mocks.changeRelation,
  submitMentorshipApplication: vi.fn().mockResolvedValue({ code: "submitted" }),
}));

vi.mock("@/components/i18n/PublicHeader", () => ({
  PublicHeader: () => <header data-testid="public-header" />,
}));

import {
  MentorshipAdminList,
  MentorshipAdminEditor,
  MentorshipApplicationQueue,
} from "./MentorshipAdmin";
import { MentorshipForm } from "./MentorshipForm";
import { PublicMentorshipCatalog, PublicMentorshipDetail } from "./PublicMentorship";
import type { MentorshipOffer, MentorshipApplication } from "@/types/domain/mentorship";
import type { ScienceWorkOptions } from "@/types/domain/science-work";

const testOffer: MentorshipOffer = {
  id: "00000000-0000-4000-a000-000000000010",
  scientistId: "00000000-0000-4000-a000-000000000002",
  fieldId: "00000000-0000-4000-a000-000000000003",
  format: "online",
  capacity: 4,
  status: "published",
  updatedAt: "2026-11-20T12:00:00Z",
  translations: [
    {
      locale: "ru",
      title: "Наставничество по геоэкологии и гидробиологии",
      slug: "geoecology-hydrobiology-mentorship",
      summary: "Практическое руководство для молодых учёных по оценке водных экосистем.",
      description:
        "Программа включает регулярные онлайн-консультации, помощь в формулировании методологии исследования и подготовку научных публикаций.",
    },
    {
      locale: "kk",
      title: "Геоэкология және гидробиология бойынша тәлімгерлік",
      slug: "geoekologiya-gidrobiologiya-talimgerlik",
      summary: "Су экожүйелерін бағалау бойынша жас ғалымдарға арналған практикалық жетекшілік.",
      description:
        "Бағдарлама тұрақты онлайн консультацияларды, зерттеу әдістемесін құруға көмекті және ғылыми жарияланымдарды дайындауды қамтиды.",
    },
  ],
  mentor: [
    {
      locale: "ru",
      fullName: "Асанов Серик Касымович",
      slug: "serik-asanov",
    },
    {
      locale: "kk",
      fullName: "Асанов Серік Қасымұлы",
      slug: "serik-asanov",
    },
  ],
  field: {
    id: "00000000-0000-4000-a000-000000000003",
    slug: "ecology",
    nameRu: "Экология и природопользование",
    nameKk: "Экология және табиғатты пайдалану",
    isActive: true,
    parentId: null,
    updatedAt: "2026-11-20T12:00:00Z",
  },
};

const testOptions: ScienceWorkOptions = {
  scientists: [
    { id: "00000000-0000-4000-a000-000000000002", name: "Асанов Серик Касымович" },
    { id: "00000000-0000-4000-a000-000000000005", name: "Иванова Елена Петровна" },
  ],
  fields: [
    {
      id: "00000000-0000-4000-a000-000000000003",
      slug: "ecology",
      nameRu: "Экология и природопользование",
      nameKk: "Экология және табиғатты пайдалану",
      isActive: true,
      parentId: null,
      updatedAt: "2026-11-20T12:00:00Z",
    },
  ],
  organizations: [],
};

const testApplication: MentorshipApplication = {
  id: "00000000-0000-4000-a000-000000000020",
  offerId: testOffer.id,
  locale: "ru",
  fullName: "Алиев Марат Нурланович",
  email: "aliev@example.kz",
  motivation:
    "Хочу освоить методы гидробиологического анализа и подготовить диссертационное исследование по малым рекам региона.",
  status: "new",
  managerNote: "Кандидат подходит по профилю, направить приглашение на собеседование.",
  createdAt: "2026-11-21T10:00:00Z",
  consentAt: "2026-11-21T10:00:00Z",
};

describe("Mentorship components and pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({
      state: "allowed",
      access: { userId: "user-1", role: "admin", permissions: ["mentorship.manage"] },
    });
    mocks.list.mockResolvedValue([testOffer]);
    mocks.getById.mockResolvedValue(testOffer);
    mocks.options.mockResolvedValue(testOptions);
    mocks.applications.mockResolvedValue([testApplication]);
    mocks.progress.mockResolvedValue(null);
    mocks.listPage.mockResolvedValue({
      offers: [testOffer],
      taxonomy: { fields: testOptions.fields, organizations: [] },
      pagination: { page: 1, total: 1, totalPages: 1 },
    });
    mocks.getBySlug.mockResolvedValue(testOffer);
  });

  it("renders MentorshipForm with WordPress-style topbar, language tabs and sidebar fields", () => {
    const html = renderToStaticMarkup(
      <MentorshipForm
        action={async () => {}}
        offer={testOffer}
        options={testOptions}
        submitLabel="Сохранить изменения"
      />
    );

    // Topbar & Language tabs
    expect(html).toContain("wp-editor-topbar");
    expect(html).toContain("wp-lang-tabs");
    expect(html).toContain("Русский");
    expect(html).toContain("Қазақша");
    expect(html).toContain("English");
    expect(html).toContain("wp-tab-optional");

    // Content inputs
    expect(html).toContain('name="titleRu"');
    expect(html).toContain('name="slugRu"');
    expect(html).toContain('name="summaryRu"');
    expect(html).toContain('name="descriptionRu"');
    expect(html).toContain('name="titleKk"');
    expect(html).toContain('name="slugKk"');

    // Values prefilled
    expect(html).toContain("Наставничество по геоэкологии и гидробиологии");
    expect(html).toContain("geoecology-hydrobiology-mentorship");

    // Sidebar fields
    expect(html).toContain('name="scientistId"');
    expect(html).toContain('name="fieldId"');
    expect(html).toContain('name="format"');
    expect(html).toContain('name="capacity"');
    expect(html).toContain("Асанов Серик Касымович");
    expect(html).toContain("Экология и природопользование");
    expect(html).toContain("Сохранить изменения");
  });

  it("renders MentorshipAdminList with breadcrumbs, search toolbar, and table", async () => {
    const html = renderToStaticMarkup(
      await MentorshipAdminList({
        searchParams: Promise.resolve({ q: "геоэкология" }),
      })
    );

    expect(html).toContain("Наставничество");
    expect(html).toContain("Программы развития");
    expect(html).toContain("Все заявки");
    expect(html).toContain("Добавить предложение");
    expect(html).toContain('name="q"');
    expect(html).toContain('name="status"');
    expect(html).toContain('name="format"');
    expect(html).toContain("Наставничество по геоэкологии и гидробиологии");
    expect(html).toContain("Асанов Серик Касымович");
    expect(html).toContain("Онлайн");
    expect(html).toContain("Опубликован");
  });

  it("renders MentorshipAdminEditor with status actions, form, and applications section", async () => {
    const html = renderToStaticMarkup(
      await MentorshipAdminEditor({
        id: testOffer.id,
        searchParams: Promise.resolve({ saved: "1" }),
      })
    );

    expect(html).toContain("Изменения предложения сохранены.");
    expect(html).toContain("workflow-panel");
    expect(html).toContain("В архив");
    expect(html).toContain("В черновики");
    expect(html).toContain("Заявки на участие");
    expect(html).toContain("Алиев Марат Нурланович");
    expect(html).toContain("aliev@example.kz");
    expect(html).toContain("Удалить предложение");
  });

  it("renders MentorshipApplicationQueue with application cards and filters", async () => {
    const html = renderToStaticMarkup(
      await MentorshipApplicationQueue({
        searchParams: Promise.resolve({ status: "all" }),
      })
    );

    expect(html).toContain("Заявки на участие");
    expect(html).toContain("Очередь заявок молодых исследователей");
    expect(html).toContain("Алиев Марат Нурланович");
    expect(html).toContain("Открыть предложение →");
  });

  it("renders PublicMentorshipCatalog with hero, filters, and offer cards", async () => {
    const html = renderToStaticMarkup(
      await PublicMentorshipCatalog({
        params: Promise.resolve({ locale: "ru" }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(html).toContain("Развивайтесь вместе с наставником");
    expect(html).toContain("Наставничество по геоэкологии и гидробиологии");
    expect(html).toContain("Асанов Серик Касымович");
    expect(html).toContain("Условия и заявка →");
    expect(html).toContain("1 предложений");
  });

  it("renders PublicMentorshipDetail with breadcrumbs, mentor info, and application form", async () => {
    const html = renderToStaticMarkup(
      await PublicMentorshipDetail({
        params: Promise.resolve({
          locale: "ru",
          slug: "geoecology-hydrobiology-mentorship",
        }),
      })
    );

    expect(html).toContain("Наставничество по геоэкологии и гидробиологии");
    expect(html).toContain("Асанов Серик Касымович");
    expect(html).toContain("О наставничестве");
    expect(html).toContain("Подать заявку");
    expect(html).toContain("← Все предложения");
  });
});
