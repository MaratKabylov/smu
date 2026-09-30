import type {
  AccessContext,
  PermissionCode,
} from "../../types/domain/auth";

export function hasPermission(
  access: AccessContext,
  permission: PermissionCode,
) {
  return access.permissions.has(permission);
}

export const canAccessAdmin = (access: AccessContext) =>
  hasPermission(access, "admin.access");

export const canCreateArticle = (access: AccessContext) =>
  hasPermission(access, "articles.create");

export const canEditArticle = (
  access: AccessContext,
  articleAuthorId?: string,
) =>
  hasPermission(access, "articles.edit_any") ||
  (articleAuthorId === access.userId &&
    hasPermission(access, "articles.edit_own"));

export const canReviewArticle = (access: AccessContext) =>
  hasPermission(access, "articles.review");

export const canPublishArticle = (access: AccessContext) =>
  hasPermission(access, "articles.publish");

export const canDeleteArticle = (access: AccessContext) =>
  hasPermission(access, "articles.delete");

export const canEditScientist = (access: AccessContext) =>
  hasPermission(access, "scientists.edit");

export const canVerifyScientist = (access: AccessContext) =>
  hasPermission(access, "scientists.verify");

export const canManageProjects = (access: AccessContext) =>
  hasPermission(access, "projects.manage");

export const canManageResearch = (access: AccessContext) =>
  hasPermission(access, "research.manage");

export const canManageMentorship = (access: AccessContext) =>
  hasPermission(access, "mentorship.manage");

export const canManageUsers = (access: AccessContext) =>
  hasPermission(access, "users.manage");

export const canManageSettings = (access: AccessContext) =>
  hasPermission(access, "settings.manage");
