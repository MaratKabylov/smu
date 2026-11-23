import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  list: vi.fn(),
  getById: vi.fn(),
  options: vi.fn(),
  applications: vi.fn(),
  participation: vi.fn(),
  save: vi.fn(),
  changeState: vi.fn(),
  updateApplication: vi.fn(),
  assignMentor: vi.fn(),
  listPage: vi.fn(),
  getBySlug: vi.fn(),
  getProjects: vi.fn(),
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
  canManageResearchProgram: (access: any) =>
    access?.permissions?.includes("programs.manage") || access?.role === "admin",
  canAccessAdmin: () => true,
}));

vi.mock("@/server/services/research-program.service", () => ({
  ResearchProgramService: class {
    list = mocks.list;
    getById = mocks.getById;
    options = mocks.options;
    applications = mocks.applications;
    participation = mocks.participation;
    save = mocks.save;
    changeState = mocks.changeState;
    updateApplication = mocks.updateApplication;
    assignMentor = mocks.assignMentor;
  },
  PublicResearchProgramService: class {
    listPage = mocks.listPage;
    getBySlug = mocks.getBySlug;
  },
  getPublicResearchProgram: (locale: string, slug: string) => mocks.getBySlug(locale, slug),
}));

vi.mock("@/server/services/research-program-projects.service", () => ({
  ResearchProgramProjectsService: class {
    get = mocks.getProjects;
  },
}));

vi.mock("@/server/actions/research-program.actions", () => ({
  saveResearchProgram: mocks.save,
  changeResearchProgram: mocks.changeState,
  updateResearchProgramApplication: mocks.updateApplication,
  assignResearchProgramMentor: mocks.assignMentor,
  submitResearchProgramApplication: vi.fn().mockResolvedValue({ code: "submitted" }),
}));

vi.mock("@/components/i18n/PublicHeader", () => ({
  PublicHeader: () => <header data-testid="public-header" />,
}));

vi.mock("./PublicProgramProjects", () => ({
  PublicProgramProjects: () => <div data-testid="public-program-projects" />,
}));

import {
  ResearchProgramAdminList,
  ResearchProgramAdminEditor,
  ResearchProgramApplicationQueue,
} from "./ResearchProgramAdmin";
import { ResearchProgramForm } from "./ResearchProgramForm";
import {
  PublicResearchProgramCatalog,
  PublicResearchProgramDetail,
} from "./PublicResearchProgram";
import type {
  ResearchProgram,
  ResearchProgramApplication,
} from "@/types/domain/research-program";
import type { ScienceWorkOptions } from "@/types/domain/science-work";

const testProgram: ResearchProgram = {
  id: "00000000-0000-4000-a000-000000000010",
  coordinatorId: "00000000-0000-4000-a000-000000000002",
  fieldId: "00000000-0000-4000-a000-000000000003",
  format: "hybrid",
  capacity: 25,
  applicationsOpenOn: "2026-12-01",
  applicationDeadline: "2026-12-20",
  startsOn: "2027-01-10",
  endsOn: "2027-06-30",
  status: "published",
  updatedAt: "2026-11-20T12:00:00Z",
  translations: [
    {
      locale: "ru",
      title: "Программа гидроэкологических исследований Актюбинской области",
      slug: "hydroecology-research-program",
      summary: "Шестимесячная междисциплинарная программа полевых и лабораторных исследований.",
      description:
        "Программа направлена на подготовку молодых специалистов в области оценки водных биоресурсов.",
      curriculum:
        "1. Теоретический блок и методы отбора проб. 2. Полевая практика. 3. Лабораторный анализ. 4. Подготовка публикации.",
      eligibility:
        "Магистранты и докторанты по специальностям «Экология», «Биология», «География».",
      outcomes:
        "Подготовленные научные статьи в рецензируемых изданиях, база замеров и сертификат участника.",
    },
    {
      locale: "kk",
      title: "Ақтөбе облысының гидроэкологиялық зерттеулер бағдарламасы",
      slug: "gidroekologiya-zertteu-bagdarlamasy",
      summary: "Далалық және зертханалық зерттеулердің алты айлық пәнаралық бағдарламасы.",
      description:
        "Бағдарлама су биоресурстарын бағалау саласындағы жас мамандарды даярлауға бағытталған.",
      curriculum:
        "1. Теориялық бөлім және сынама алу әдістері. 2. Далалық тәжірибе. 3. Зертханалық талдау. 4. Мақала дайындау.",
      eligibility:
        "«Экология», «Биология», «География» мамандықтары бойынша магистранттар мен докторанттар.",
      outcomes:
        "Рецензияланатын басылымдардағы ғылыми мақалалар, өлшеулер базасы және сертификат.",
    },
  ],
  coordinator: [
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

const testApplication: ResearchProgramApplication = {
  id: "00000000-0000-4000-a000-000000000020",
  programId: testProgram.id,
  locale: "ru",
  fullName: "Бакиров Даулет Маратович",
  email: "bakirov@example.kz",
  motivation:
    "Изучаю биоиндикацию малых рек, хочу освоить современные методы полевого отбора проб и публикации данных.",
  status: "accepted",
  managerNote: "Кандидат зачислен в основной состав программы.",
  createdAt: "2026-11-21T10:00:00Z",
  consentAt: "2026-11-21T10:00:00Z",
};

const testProjects = {
  graph: {
    version: 1,
    workIds: ["00000000-0000-4000-a000-000000000030"],
    participants: [],
    applications: [{ id: testApplication.id, name: testApplication.fullName, status: "accepted" as const }],
  },
  options: [
    {
      id: "00000000-0000-4000-a000-000000000030",
      title: "Экологический мониторинг бассейна реки Илек",
      status: "published" as const,
      members: [{ id: "00000000-0000-4000-a000-000000000002", name: "Асанов Серик Касымович" }],
    },
  ],
};

describe("ResearchProgram components and pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.access.mockResolvedValue({
      state: "allowed",
      access: { userId: "user-1", role: "admin", permissions: ["programs.manage"] },
    });
    mocks.list.mockResolvedValue([testProgram]);
    mocks.getById.mockResolvedValue(testProgram);
    mocks.options.mockResolvedValue(testOptions);
    mocks.applications.mockResolvedValue([testApplication]);
    mocks.participation.mockResolvedValue({
      status: "active",
      version: 1,
      mentorId: "00000000-0000-4000-a000-000000000002",
    });
    mocks.getProjects.mockResolvedValue(testProjects);
    mocks.listPage.mockResolvedValue({
      programs: [testProgram],
      taxonomy: { fields: testOptions.fields, organizations: [] },
      pagination: { page: 1, total: 1, totalPages: 1 },
    });
    mocks.getBySlug.mockResolvedValue(testProgram);
  });

  it("renders ResearchProgramForm with WordPress-style topbar, language tabs, curriculum and date inputs", () => {
    const html = renderToStaticMarkup(
      <ResearchProgramForm
        action={async () => {}}
        program={testProgram}
        options={testOptions}
        submitLabel="Сохранить программу"
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
    expect(html).toContain('name="curriculumRu"');
    expect(html).toContain('name="eligibilityRu"');
    expect(html).toContain('name="outcomesRu"');

    // Values prefilled
    expect(html).toContain("Программа гидроэкологических исследований Актюбинской области");
    expect(html).toContain("hydroecology-research-program");

    // Sidebar settings and dates
    expect(html).toContain('name="coordinatorId"');
    expect(html).toContain('name="fieldId"');
    expect(html).toContain('name="format"');
    expect(html).toContain('name="capacity"');
    expect(html).toContain('name="applicationsOpenOn"');
    expect(html).toContain('name="applicationDeadline"');
    expect(html).toContain('name="startsOn"');
    expect(html).toContain('name="endsOn"');
    expect(html).toContain("Асанов Серик Касымович");
    expect(html).toContain("Экология и природопользование");
    expect(html).toContain("Сохранить программу");
  });

  it("renders ResearchProgramAdminList with breadcrumbs, search toolbar, and table", async () => {
    const html = renderToStaticMarkup(
      await ResearchProgramAdminList({
        searchParams: Promise.resolve({ q: "гидроэкология" }),
      })
    );

    expect(html).toContain("Research Program");
    expect(html).toContain("Программы развития");
    expect(html).toContain("Все заявки");
    expect(html).toContain("Добавить программу");
    expect(html).toContain('name="q"');
    expect(html).toContain('name="status"');
    expect(html).toContain('name="format"');
    expect(html).toContain("Программа гидроэкологических исследований Актюбинской области");
    expect(html).toContain("Асанов Серик Касымович");
    expect(html).toContain("Смешанный формат");
    expect(html).toContain("Опубликовано");
  });

  it("renders ResearchProgramAdminEditor with status actions, form, projects editor, and applications", async () => {
    const html = renderToStaticMarkup(
      await ResearchProgramAdminEditor({
        id: testProgram.id,
        searchParams: Promise.resolve({ saved: "1" }),
      })
    );

    expect(html).toContain("Изменения программы сохранены.");
    expect(html).toContain("workflow-panel");
    expect(html).toContain("В архив");
    expect(html).toContain("В черновики");
    expect(html).toContain("Проекты и участники программы");
    expect(html).toContain("Заявки на участие");
    expect(html).toContain("Бакиров Даулет Маратович");
    expect(html).toContain("bakirov@example.kz");
    expect(html).toContain("Удалить программу");
  });

  it("renders ResearchProgramApplicationQueue with application cards and filters", async () => {
    const html = renderToStaticMarkup(
      await ResearchProgramApplicationQueue({
        searchParams: Promise.resolve({ status: "all" }),
      })
    );

    expect(html).toContain("Заявки на участие");
    expect(html).toContain("Очередь заявок молодых исследователей");
    expect(html).toContain("Бакиров Даулет Маратович");
    expect(html).toContain("Открыть программу →");
  });

  it("renders PublicResearchProgramCatalog with hero, filters, and cards", async () => {
    const html = renderToStaticMarkup(
      await PublicResearchProgramCatalog({
        params: Promise.resolve({ locale: "ru" }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(html).toContain("От идеи к исследованию");
    expect(html).toContain("Программа гидроэкологических исследований Актюбинской области");
    expect(html).toContain("Асанов Серик Касымович");
    expect(html).toContain("Программа и заявка →");
    expect(html).toContain("1 программ");
  });

  it("renders PublicResearchProgramDetail with curriculum, eligibility, outcomes, and coordinator", async () => {
    const html = renderToStaticMarkup(
      await PublicResearchProgramDetail({
        params: Promise.resolve({
          locale: "ru",
          slug: "hydroecology-research-program",
        }),
      })
    );

    expect(html).toContain("Программа гидроэкологических исследований Актюбинской области");
    expect(html).toContain("Асанов Серик Касымович");
    expect(html).toContain("О программе");
    expect(html).toContain("План и этапы");
    expect(html).toContain("Кто может участвовать");
    expect(html).toContain("Ожидаемые результаты");
    expect(html).toContain("← Все программы");
  });
});
