import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  canEditArticle,
  canEditMedia,
  canPublishArticle,
  canReviewArticle,
} from "./permissions";
import type {
  AccessContext,
  PermissionCode,
  RoleCode,
} from "../../types/domain/auth";

function access(
  permissions: PermissionCode[],
  userId = "user-1",
): AccessContext {
  return {
    userId,
    roles: new Set<RoleCode>(),
    permissions: new Set(permissions),
  };
}

describe("permissions", () => {
  it("restricts a scientific reviewer to assigned articles", () => {
    const reviewer = access(["articles.review"]);
    expect(canReviewArticle(reviewer)).toBe(false);
    expect(canReviewArticle(reviewer, "user-2")).toBe(false);
    expect(canReviewArticle(reviewer, "user-1")).toBe(true);
    expect(canReviewArticle(access(["articles.review", "articles.edit_any"]))).toBe(true);
  });
  it("does not infer access from a hidden UI element", () => {
    expect(canAccessAdmin(access([]))).toBe(false);
  });

  it("allows an author to edit only their own article", () => {
    const author = access(["articles.edit_own"]);

    expect(canEditArticle(author, "user-1")).toBe(true);
    expect(canEditArticle(author, "user-2")).toBe(false);
  });

  it("keeps publishing separate from editing", () => {
    const editor = access(["articles.edit_any"]);

    expect(canEditArticle(editor, "user-2")).toBe(true);
    expect(canPublishArticle(editor)).toBe(false);
  });

  it("keeps media editing separate from media access", () => {
    const viewer = access(["media.view"]);

    expect(canEditMedia(viewer)).toBe(false);
  });
});
