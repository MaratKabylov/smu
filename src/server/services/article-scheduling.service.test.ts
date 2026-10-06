import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleSupabaseClient: mocks.client }));
import { ArticleSchedulingService } from "./article-scheduling.service";
beforeEach(() => { vi.clearAllMocks(); mocks.client.mockReturnValue({ rpc: mocks.rpc }); });

describe("trusted scheduled publishing service", () => {
  it("uses a bounded atomic RPC through the service role", async () => {
    mocks.rpc.mockResolvedValue({ data: { published: 1, rejected: 2 }, error: null });
    expect(await new ArticleSchedulingService().publishDue()).toEqual({ published: 1, rejected: 2 });
    expect(mocks.rpc).toHaveBeenCalledWith("publish_scheduled_articles", { p_limit: 100 });
  });
  it("propagates RPC failures and rejects unexpected results", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "permission denied" } });
    await expect(new ArticleSchedulingService().publishDue()).rejects.toMatchObject({ message: "permission denied" });
    for (const data of [null, {}, { published: -1, rejected: 0 }, { published: 101, rejected: 0 }]) {
      mocks.rpc.mockResolvedValueOnce({ data, error: null });
      await expect(new ArticleSchedulingService().publishDue()).rejects.toThrow();
    }
  });
});
