import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ path: vi.fn(), tag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path, revalidateTag: mocks.tag }));
import { revalidateLocalizedPath, invalidatePublicContent } from "./revalidation";
import { publicContentTag } from "@/lib/supabase/public-cache";
beforeEach(() => vi.clearAllMocks());
describe("public graph invalidation", () => {
  it.each(["/journal", "/scientists", "/research", "/projects", "/publications", "/mentorship", "/research-program", "/events"])("expires shared data for %s across all languages", path => {
    revalidateLocalizedPath(path);
    expect(mocks.tag).toHaveBeenCalledWith(publicContentTag, { expire: 0 });
    for (const locale of ["ru", "kk", "en"]) expect(mocks.path).toHaveBeenCalledWith("/" + locale + path, "layout");
    expect(mocks.path).toHaveBeenCalledTimes(3);
  });
  it("covers taxonomy and media mutations which only refresh administrative paths", () => {
    revalidateLocalizedPath("/admin/content/articles/taxonomy");
    revalidateLocalizedPath("/admin/content/media/id");
    expect(mocks.tag).toHaveBeenCalledTimes(2);
    expect(mocks.path).toHaveBeenCalledWith("/admin/content/articles/taxonomy");
  });
  it("supports service-role upload completion without invalidating an arbitrary route", () => {
    invalidatePublicContent();
    expect(mocks.tag).toHaveBeenCalledWith(publicContentTag, { expire: 0 });
    expect(mocks.path).not.toHaveBeenCalled();
  });
});
