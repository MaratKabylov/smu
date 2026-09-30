export const roleCodes = [
  "user",
  "scientist",
  "author",
  "editor",
  "scientific_reviewer",
  "content_manager",
  "scientist_manager",
  "project_manager",
  "admin",
  "super_admin",
] as const;

export type RoleCode = (typeof roleCodes)[number];

export const permissionCodes = [
  "admin.access",
  "articles.create",
  "articles.edit_own",
  "articles.edit_any",
  "articles.review",
  "articles.publish",
  "articles.delete",
  "scientists.edit",
  "scientists.verify",
  "projects.manage",
  "research.manage",
  "mentorship.manage",
  "users.manage",
  "roles.manage",
  "settings.manage",
  "audit.read",
  "audit.write",
] as const;

export type PermissionCode = (typeof permissionCodes)[number];

export type AccessContext = {
  userId: string;
  roles: ReadonlySet<RoleCode>;
  permissions: ReadonlySet<PermissionCode>;
};
