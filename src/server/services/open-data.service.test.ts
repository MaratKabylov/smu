import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

const mocks = vi.hoisted(() => ({
  publicClient: vi.fn(),
  serverClient: vi.fn(),
  configured: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  listMetrics: vi.fn(),
  getMetricById: vi.fn(),
  saveMetric: vi.fn(),
  deleteMetric: vi.fn(),
  listCategories: vi.fn(),
  getCategoryById: vi.fn(),
  saveCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listUpdates: vi.fn(),
  getUpdateById: vi.fn(),
  saveUpdate: vi.fn(),
  deleteUpdate: vi.fn(),
  getPublicOverview: vi.fn(),
  getHomepageData: vi.fn(),
}));

vi.mock("@/lib/supabase/public", () => ({ createPublicSupabaseClient: mocks.publicClient }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: mocks.serverClient }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: mocks.configured }));

vi.mock("@/server/repositories/open-data.repository", () => ({
  OpenDataRepository: class {
    getSettings = mocks.getSettings;
    updateSettings = mocks.updateSettings;
    listMetrics = mocks.listMetrics;
    getMetricById = mocks.getMetricById;
    saveMetric = mocks.saveMetric;
    deleteMetric = mocks.deleteMetric;
    listCategories = mocks.listCategories;
    getCategoryById = mocks.getCategoryById;
    saveCategory = mocks.saveCategory;
    deleteCategory = mocks.deleteCategory;
    listUpdates = mocks.listUpdates;
    getUpdateById = mocks.getUpdateById;
    saveUpdate = mocks.saveUpdate;
    deleteUpdate = mocks.deleteUpdate;
    getPublicOverview = mocks.getPublicOverview;
    getHomepageData = mocks.getHomepageData;
  },
}));

import { OpenDataService, getPublicOpenData, getHomepageOpenData } from "./open-data.service";
import type { AccessContext } from "@/types/domain/auth";

const managerAccess: AccessContext = {
  userId: "00000000-0000-4000-a000-000000000001",
  roles: new Set(["admin"]),
  permissions: new Set(["admin.access", "open_data.manage"]),
};

const unauthorizedAccess: AccessContext = {
  userId: "00000000-0000-4000-a000-000000000002",
  roles: new Set(["user"]),
  permissions: new Set(),
};

describe("OpenDataService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.configured.mockReturnValue(true);
    mocks.publicClient.mockReturnValue({});
    mocks.serverClient.mockResolvedValue({});
  });

  it("denies administrative operations to unauthorized users", async () => {
    const service = new OpenDataService();
    await expect(service.getAdminData(unauthorizedAccess)).rejects.toThrow("forbidden");
    await expect(service.updateSettings(unauthorizedAccess, {})).rejects.toThrow("forbidden");
    await expect(service.getMetricById(unauthorizedAccess, "1")).rejects.toThrow("forbidden");
    await expect(service.listMetrics(unauthorizedAccess)).rejects.toThrow("forbidden");
    await expect(service.saveMetric(unauthorizedAccess, {})).rejects.toThrow("forbidden");
    await expect(service.deleteMetric(unauthorizedAccess, "1")).rejects.toThrow("forbidden");
    await expect(service.getCategoryById(unauthorizedAccess, "1")).rejects.toThrow("forbidden");
    await expect(service.listCategories(unauthorizedAccess)).rejects.toThrow("forbidden");
    await expect(service.saveCategory(unauthorizedAccess, {})).rejects.toThrow("forbidden");
    await expect(service.deleteCategory(unauthorizedAccess, "1")).rejects.toThrow("forbidden");
    await expect(service.getUpdateById(unauthorizedAccess, "1")).rejects.toThrow("forbidden");
    await expect(service.saveUpdate(unauthorizedAccess, {})).rejects.toThrow("forbidden");
    await expect(service.deleteUpdate(unauthorizedAccess, "1")).rejects.toThrow("forbidden");
  });

  it("allows administrative data retrieval for authorized users", async () => {
    mocks.getSettings.mockResolvedValue({ id: "1", title_ru: "Open Data" });
    mocks.listMetrics.mockResolvedValue([{ id: "m1", code: "datasets" }]);
    mocks.listCategories.mockResolvedValue([{ id: "c1", slug: "ecology" }]);
    mocks.listUpdates.mockResolvedValue([{ id: "u1", title_ru: "Air quality" }]);

    const service = new OpenDataService();
    const data = await service.getAdminData(managerAccess);

    expect(data.settings).toEqual({ id: "1", title_ru: "Open Data" });
    expect(data.metrics).toHaveLength(1);
    expect(data.categories).toHaveLength(1);
    expect(data.updates).toHaveLength(1);
  });

  it("fetches public overview and homepage data through public client", async () => {
    const mockOverview = {
      isPublished: true,
      showOnHomepage: true,
      title: "Open Data Aktobe",
      metrics: [],
      categories: [],
      latestUpdates: [],
    };
    mocks.getPublicOverview.mockResolvedValue(mockOverview);
    mocks.getHomepageData.mockResolvedValue(mockOverview);

    const publicData = await getPublicOpenData("ru");
    expect(publicData).toEqual(mockOverview);
    expect(mocks.getPublicOverview).toHaveBeenCalledWith("ru");

    const homeData = await getHomepageOpenData("kk");
    expect(homeData).toEqual(mockOverview);
    expect(mocks.getHomepageData).toHaveBeenCalledWith("kk");
  });

  it("returns null when supabase is not configured", async () => {
    mocks.configured.mockReturnValue(false);
    expect(await getPublicOpenData("ru")).toBeNull();
    expect(await getHomepageOpenData("ru")).toBeNull();
  });
});
