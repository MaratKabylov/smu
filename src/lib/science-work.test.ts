import { describe, expect, it } from "vitest";
import { canChangeScienceWorkStatus, canManageScienceWork } from "./science-work";
import type { AccessContext, PermissionCode } from "../types/domain/auth";
const access = (...permissions: PermissionCode[]): AccessContext => ({ userId: "user", roles: new Set(), permissions: new Set(permissions) });
describe("science work access and publication", () => {
  it("keeps research and project management permissions separate", () => {
    expect(canManageScienceWork(access("projects.manage"), "research")).toBe(false);
    expect(canManageScienceWork(access("research.manage"), "project")).toBe(false);
    expect(canManageScienceWork(access("research.manage"), "research")).toBe(true);
    expect(canManageScienceWork(access("projects.manage"), "project")).toBe(true);
  });
  it("does not infer management from admin or scientist access", () => {
    expect(canManageScienceWork(access("admin.access", "scientists.edit"), "project")).toBe(false);
  });
  it("requires restoring an archived work to draft before publishing", () => {
    expect(canChangeScienceWorkStatus("archived", "published")).toBe(false);
    expect(canChangeScienceWorkStatus("archived", "draft")).toBe(true);
    expect(canChangeScienceWorkStatus("draft", "published")).toBe(true);
    expect(canChangeScienceWorkStatus("published", "draft")).toBe(true);
    expect(canChangeScienceWorkStatus("published", "archived")).toBe(true);
    expect(canChangeScienceWorkStatus("draft", "draft")).toBe(false);
  });
});
